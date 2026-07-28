import {
  requireToolContext,
  type ToolExecutionContext,
} from '../../../../services/ToolExecutionContext.js';
import type { ToolExecutionPolicy } from '../../../../types/agent.js';
import { BaseTool } from '../../../base/BaseTool.js';

const MEDIUM: ToolExecutionPolicy = { readonly: false, riskLevel: 'medium' };
const HIGH: ToolExecutionPolicy = { readonly: false, riskLevel: 'high' };

const SCORE_FIELDS = [
  'ai_score',
  'ai_summary',
  'ai_summary_short',
  'ai_topic',
  'ai_tags',
  'ai_picked',
  'ai_scored_at',
];

function resolveReportDate(date?: string): string {
  if (!date || date === 'today') return new Date().toISOString().slice(0, 10);
  if (date === 'yesterday') {
    return new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  }
  return date;
}

function extractRunMeta(result: unknown): { runId?: string; status: string } {
  if (!result || typeof result !== 'object') {
    return { status: 'succeeded' };
  }
  const record = result as Record<string, unknown>;
  if (typeof record.workflowRunId === 'string') {
    return { runId: record.workflowRunId, status: String(record.status ?? 'running') };
  }
  return { status: 'succeeded' };
}

class UpdateNewsScoreTool extends BaseTool {
  readonly id = 'update_news_score';
  readonly name = 'update_news_score';
  readonly displayName = '重置/手动改分';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly execution = MEDIUM;
  readonly description =
    '重置或手动修改单条新闻的 AI 评分。必填 newsId + action(reset|patch);action=patch 时需 score(0-100)。' +
    'reset 清空评分字段使其重新进入未评分队列;patch 手动设置分数。调用前应先调 list_scored_news 或 list_unevaluated_news 让用户确认 newsId。';
  readonly parameters = {
    type: 'object',
    properties: {
      newsId: { type: 'string', description: '新闻条目 id' },
      action: { type: 'string', enum: ['reset', 'patch'], description: 'reset=清空评分, patch=手动设置分数' },
      score: { type: 'number', description: '手动设置的分数(0-100),action=patch 时必填' },
    },
    required: ['newsId', 'action'],
  };

  async handler(
    args: { newsId: string; action: 'reset' | 'patch'; score?: number },
    toolCtx?: ToolExecutionContext,
  ) {
    const { store } = requireToolContext(toolCtx, this.id);
    try {
      const existing = await store.repositories.sourceData.get(args.newsId);
      if (!existing) {
        return { ok: false, errorCode: 'NOT_FOUND', message: `新闻 ${args.newsId} 不存在` };
      }
      const oldScore = existing.metadata?.ai_score;
      let newMetadata: Record<string, unknown>;
      if (args.action === 'reset') {
        const cleared: Record<string, null> = {};
        for (const field of SCORE_FIELDS) cleared[field] = null;
        newMetadata = { ...existing.metadata, ...cleared };
      } else {
        if (args.score === undefined || args.score < 0 || args.score > 100) {
          return { ok: false, errorCode: 'INVALID_SCORE', message: 'patch 需要 0-100 的 score' };
        }
        newMetadata = {
          ...existing.metadata,
          ai_score: args.score,
          ai_scored_at: new Date().toISOString(),
        };
      }
      await store.updateSourceDataMetadata(args.newsId, newMetadata);
      return {
        ok: true,
        newsId: args.newsId,
        title: existing.title,
        oldScore,
        newScore: args.action === 'patch' ? args.score : null,
      };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, errorCode: 'UPDATE_SCORE_FAILED', message };
    }
  }
}

class DeleteNewsTool extends BaseTool {
  readonly id = 'delete_news';
  readonly name = 'delete_news';
  readonly displayName = '删除新闻';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly execution = HIGH;
  readonly description =
    '删除一条新闻素材(高危,不可撤销)。必填 newsId。删除前应先调 list_scored_news/list_unevaluated_news 让用户确认。';
  readonly parameters = {
    type: 'object',
    properties: { newsId: { type: 'string', description: '要删除的新闻 id' } },
    required: ['newsId'],
  };

  async handler(args: { newsId: string }, toolCtx?: ToolExecutionContext) {
    const { taskService } = requireToolContext(toolCtx, this.id);
    try {
      await taskService.deleteSourceData(args.newsId);
      return { ok: true, deleted: args.newsId };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, errorCode: 'DELETE_NEWS_FAILED', message };
    }
  }
}

class GenerateDailyReportTool extends BaseTool {
  readonly id = 'generate_daily_report';
  readonly name = 'generate_daily_report';
  readonly displayName = '生成日报';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly execution = MEDIUM;
  readonly description =
    '生成指定日期的日报(运行日报工作流)。可选 date(YYYY-MM-DD 或 today/yesterday,默认 today);' +
    '可选 workflowId(日报工作流 id,默认 ai-daily-report-json-from-summary,可选 from-raw 变体)。返回 runId。';
  readonly parameters = {
    type: 'object',
    properties: {
      date: { type: 'string', description: '日报日期(YYYY-MM-DD 或 today/yesterday),默认 today' },
      workflowId: { type: 'string', description: '日报工作流 id(可选,默认 ai-daily-report-json-from-summary)' },
    },
  };

  async handler(args: { date?: string; workflowId?: string }, toolCtx?: ToolExecutionContext) {
    const { services } = requireToolContext(toolCtx, this.id);
    try {
      const orchestration = services.workflowOrchestrationService;
      if (!orchestration) {
        return { ok: false, errorCode: 'SERVICE_UNAVAILABLE', message: '工作流引擎未初始化' };
      }
      const workflowId = args.workflowId || 'ai-daily-report-json-from-summary';
      const resolvedDate = resolveReportDate(args.date);
      const result = await orchestration.run({
        workflowId,
        input: { date: resolvedDate },
        date: resolvedDate,
        source: 'api',
      });
      const meta = extractRunMeta(result);
      return {
        ok: true,
        workflowId,
        date: resolvedDate,
        runId: meta.runId,
        status: meta.status,
        hint: '进度可调 list_workflow_runs,结果在 /generation 查看',
      };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, errorCode: 'GENERATE_REPORT_FAILED', message };
    }
  }
}

class PublishReportTool extends BaseTool {
  readonly id = 'publish_report';
  readonly name = 'publish_report';
  readonly displayName = '发布日报';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly execution = HIGH;
  readonly description =
    '发布已生成的日报到指定渠道(高危)。必填 contentId(日报内容 id,可从 list_recent_reports 取);' +
    '可选 channels(渠道 id 数组如 local_site/github/wechat,默认使用历史记录平台或 local_site)。';
  readonly parameters = {
    type: 'object',
    properties: {
      contentId: { type: 'string', description: '要发布的日报内容 id' },
      channels: {
        type: 'array',
        items: { type: 'string' },
        description: '发布渠道列表,默认使用历史记录平台或 local_site',
      },
    },
    required: ['contentId'],
  };

  async handler(args: { contentId: string; channels?: string[] }, toolCtx?: ToolExecutionContext) {
    const { store, taskService } = requireToolContext(toolCtx, this.id);
    try {
      const history = await store.getCommitHistoryById(Number(args.contentId));
      if (!history) {
        return {
          ok: false,
          errorCode: 'NOT_FOUND',
          message: `日报内容 ${args.contentId} 不存在`,
          hint: '调 list_recent_reports 查看可用日报',
        };
      }
      const content = history.fullContent || history.content || history.html || history.markdown;
      if (!content) {
        return { ok: false, errorCode: 'NO_CONTENT', message: '该日报记录无可发布内容' };
      }
      const channels =
        args.channels && args.channels.length > 0
          ? args.channels
          : history.platform
            ? [history.platform]
            : ['local_site'];
      const results: Array<{ channel: string; ok: boolean; error?: string }> = [];
      for (const channel of channels) {
        try {
          await taskService.publish(channel, content, {
            date: history.date,
            title: history.commitMessage || history.title || `日报 ${history.date}`,
          });
          results.push({ channel, ok: true });
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : String(e);
          results.push({ channel, ok: false, error: message });
        }
      }
      const allOk = results.every((item) => item.ok);
      return {
        ok: allOk,
        contentId: args.contentId,
        date: history.date,
        results,
        hint: allOk ? '可在 /history 查看发布记录' : '部分渠道失败,见 results',
      };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, errorCode: 'PUBLISH_REPORT_FAILED', message };
    }
  }
}

export const newsReportTools: BaseTool[] = [
  new UpdateNewsScoreTool(),
  new DeleteNewsTool(),
  new GenerateDailyReportTool(),
  new PublishReportTool(),
];
