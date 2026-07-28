import {
  requireToolContext,
  type ToolExecutionContext,
} from '../../../../services/ToolExecutionContext.js';
import type { WorkflowRunStatus } from '../../../../services/agents/WorkflowRun.js';
import { BaseTool } from '../../../base/BaseTool.js';

function parseDateRange(dateRange?: string): { publishedFrom?: string; publishedTo?: string } {
  if (!dateRange || !dateRange.includes('~')) return {};
  const [from, to] = dateRange.split('~').map((s) => s.trim());
  return { publishedFrom: from || undefined, publishedTo: to || undefined };
}

function parseScoreRange(scoreRange?: string): { minScore?: number } {
  if (!scoreRange) return {};
  const [min] = scoreRange.split('-').map((s) => Number(s.trim()));
  return Number.isFinite(min) ? { minScore: min } : {};
}

class ListSchedulesTool extends BaseTool {
  readonly id = 'list_schedules';
  readonly name = 'list_schedules';
  readonly displayName = '列定时任务';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    '列出所有定时任务(cron)。返回每个任务的 id/name/type/cronExpr/targetId/enabled。' +
    '可选 enabled(true/false) 按启用状态筛选。用户要查看/选择定时任务时调用。';
  readonly parameters = {
    type: 'object',
    properties: {
      enabled: { type: 'boolean', description: '按启用状态筛选(可选)' },
    },
  };

  async handler(args: { enabled?: boolean }, toolCtx?: ToolExecutionContext) {
    const { store } = requireToolContext(toolCtx, this.id);
    try {
      const all = await store.listSchedules();
      const items = (args.enabled === undefined ? all : all.filter((s) => !!s.enabled === args.enabled)).map(
        (s) => ({
          id: s.id,
          name: s.name,
          type: s.type,
          cronExpr: s.cronExpr,
          targetId: s.targetId,
          enabled: !!s.enabled,
        }),
      );
      return { ok: true, count: items.length, items };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        errorCode: 'LIST_SCHEDULES_FAILED',
        message,
        hint: '可在 /scheduling 页面直接查看',
      };
    }
  }
}

class ListAdaptersTool extends BaseTool {
  readonly id = 'list_adapters';
  readonly name = 'list_adapters';
  readonly displayName = '列采集适配器';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    '列出所有已配置的数据采集适配器,含 name/status/lastRun。创建 INGESTION 类型定时任务需选 targetId 时调用。';
  readonly parameters = { type: 'object', properties: {} };

  async handler(_args: Record<string, never>, toolCtx?: ToolExecutionContext) {
    const { taskService } = requireToolContext(toolCtx, this.id);
    try {
      const status = await taskService.getAdapterStatus();
      const items = Object.values(status || {}).map((a: any) => ({
        name: a.name,
        status: a.status,
        lastRun: a.lastRun,
      }));
      return { ok: true, count: items.length, items };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, errorCode: 'LIST_ADAPTERS_FAILED', message };
    }
  }
}

class ListWorkflowsTool extends BaseTool {
  readonly id = 'list_workflows';
  readonly name = 'list_workflows';
  readonly displayName = '列工作流';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    '列出所有工作流,含 id/name/description/steps 概要。创建 WORKFLOW 类型定时任务或运行工作流需选目标时调用。';
  readonly parameters = { type: 'object', properties: {} };

  async handler(_args: Record<string, never>, toolCtx?: ToolExecutionContext) {
    const { store } = requireToolContext(toolCtx, this.id);
    try {
      const all = await store.listWorkflows();
      const items = (all || []).map((w) => ({
        id: w.id,
        name: w.name,
        description: w.description,
        stepCount: Array.isArray(w.steps) ? w.steps.length : 0,
      }));
      return { ok: true, count: items.length, items };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, errorCode: 'LIST_WORKFLOWS_FAILED', message };
    }
  }
}

class ListUnevaluatedNewsTool extends BaseTool {
  readonly id = 'list_unevaluated_news';
  readonly name = 'list_unevaluated_news';
  readonly displayName = '列未评分新闻';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    '列出尚未 AI 评分的新闻素材(ai_scored_at 为空),返回数量与前 N 条样本。用户说"给未评分新闻评分"时先调用确认数量。可选 limit(默认 10)。';
  readonly parameters = {
    type: 'object',
    properties: { limit: { type: 'number', description: '返回样本条数,默认 10' } },
  };

  async handler(args: { limit?: number }, toolCtx?: ToolExecutionContext) {
    const { store } = requireToolContext(toolCtx, this.id);
    try {
      const limit = args.limit ?? 10;
      const result = await store.repositories.sourceData.list({ hasAiScored: false, limit });
      const items = (result?.items || []).map((it) => ({
        id: it.id,
        title: it.title,
        source: it.source,
        published_date: it.published_date,
      }));
      return { ok: true, total: result?.total ?? items.length, sampleCount: items.length, items };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, errorCode: 'LIST_UNEVALUATED_FAILED', message };
    }
  }
}

class ListScoredNewsTool extends BaseTool {
  readonly id = 'list_scored_news';
  readonly name = 'list_scored_news';
  readonly displayName = '列已评分新闻';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    '列出已 AI 评分的新闻素材,支持按日期区间/分数区间/主题筛选。用户要查看/选择已评分素材时调用。' +
    '可选 dateRange(YYYY-MM-DD~YYYY-MM-DD)、scoreRange(0-100)、topic、limit(默认 20)。';
  readonly parameters = {
    type: 'object',
    properties: {
      dateRange: { type: 'string', description: '日期区间 YYYY-MM-DD~YYYY-MM-DD(可选)' },
      scoreRange: { type: 'string', description: '分数区间如 60-100(可选)' },
      topic: { type: 'string', description: '主题筛选(可选)' },
      limit: { type: 'number', description: '返回条数,默认 20' },
    },
  };

  async handler(
    args: { dateRange?: string; scoreRange?: string; topic?: string; limit?: number },
    toolCtx?: ToolExecutionContext,
  ) {
    const { store } = requireToolContext(toolCtx, this.id);
    try {
      const result = await store.repositories.sourceData.list({
        hasAiScored: true,
        ...parseDateRange(args.dateRange),
        ...parseScoreRange(args.scoreRange),
        aiTopic: args.topic,
        limit: args.limit ?? 20,
      });
      const items = (result?.items || []).map((it) => ({
        id: it.id,
        title: it.title,
        score: it.metadata?.ai_score,
        topic: it.metadata?.ai_topic,
        published_date: it.published_date,
      }));
      return { ok: true, count: items.length, items };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, errorCode: 'LIST_SCORED_FAILED', message };
    }
  }
}

class GetNewsItemTool extends BaseTool {
  readonly id = 'get_news_item';
  readonly name = 'get_news_item';
  readonly displayName = '查新闻详情';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description = '查询单条新闻素材的详情(含 metadata 评分字段)。必填 id。';
  readonly parameters = {
    type: 'object',
    properties: { id: { type: 'string', description: '新闻条目 id' } },
    required: ['id'],
  };

  async handler(args: { id: string }, toolCtx?: ToolExecutionContext) {
    const { store } = requireToolContext(toolCtx, this.id);
    try {
      const it = await store.repositories.sourceData.get(args.id);
      if (!it) return { ok: false, errorCode: 'NOT_FOUND', message: `新闻 ${args.id} 不存在` };
      return {
        ok: true,
        item: {
          id: it.id,
          title: it.title,
          url: it.url,
          source: it.source,
          published_date: it.published_date,
          description: it.description,
          metadata: it.metadata,
        },
      };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, errorCode: 'GET_NEWS_FAILED', message };
    }
  }
}

class ListWorkflowRunsTool extends BaseTool {
  readonly id = 'list_workflow_runs';
  readonly name = 'list_workflow_runs';
  readonly displayName = '列工作流运行记录';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    '列出工作流运行记录,可选按 workflowId/status 筛选。用户要查看运行进度或选择待审批步骤时调用。' +
    '可选 workflowId、status(running/completed/failed/awaiting_approval)、limit(默认 20)。';
  readonly parameters = {
    type: 'object',
    properties: {
      workflowId: { type: 'string', description: '按工作流 id 筛选(可选)' },
      status: { type: 'string', description: '按状态筛选(可选)' },
      limit: { type: 'number', description: '返回条数,默认 20' },
    },
  };

  async handler(
    args: { workflowId?: string; status?: string; limit?: number },
    toolCtx?: ToolExecutionContext,
  ) {
    const { services } = requireToolContext(toolCtx, this.id);
    try {
      const limit = args.limit ?? 20;
      const filter: { workflowId?: string; status?: WorkflowRunStatus } = {};
      if (args.workflowId) filter.workflowId = args.workflowId;
      if (args.status) filter.status = args.status as WorkflowRunStatus;
      const page = await services.workflowRunRegistry.list(filter, 0, limit);
      return { ok: true, count: page.items.length, total: page.total, items: page.items };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, errorCode: 'LIST_RUNS_FAILED', message };
    }
  }
}

class GetSystemStatsTool extends BaseTool {
  readonly id = 'get_system_stats';
  readonly name = 'get_system_stats';
  readonly displayName = '系统统计';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    '获取系统 KPI 与统计(素材总数/已评分/待评分/适配器状态/最近发布)。用户问系统概况或调度中心 KPI 时调用。';
  readonly parameters = { type: 'object', properties: {} };

  async handler(_args: Record<string, never>, toolCtx?: ToolExecutionContext) {
    const { taskService, store } = requireToolContext(toolCtx, this.id);
    try {
      const stats = await taskService.getStats();
      const adapters = await taskService.getAdapterStatus();
      const schedules = await store.listSchedules();
      return {
        ok: true,
        stats,
        adapterCount: (adapters || []).length,
        scheduleCount: (schedules || []).length,
      };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, errorCode: 'GET_STATS_FAILED', message };
    }
  }
}

class ListRecentReportsTool extends BaseTool {
  readonly id = 'list_recent_reports';
  readonly name = 'list_recent_reports';
  readonly displayName = '列最近日报';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    '列出最近生成的日报内容记录(发布历史),含 id/date/渠道/状态。发布日报需选 contentId 时调用。' +
    '可选 date(YYYY-MM-DD)、limit(默认 10)。';
  readonly parameters = {
    type: 'object',
    properties: {
      date: { type: 'string', description: '指定日期(可选)' },
      limit: { type: 'number', description: '返回条数,默认 10' },
    },
  };

  async handler(args: { date?: string; limit?: number }, toolCtx?: ToolExecutionContext) {
    const { taskService, store } = requireToolContext(toolCtx, this.id);
    try {
      const limit = args.limit ?? 10;
      const history = await store.getCommitHistory({ limit, date: args.date });
      const items = (history?.records || []).map((rec) => ({
        id: rec.id,
        date: rec.date,
        title: rec.title,
        platform: rec.platform,
        status: rec.status,
      }));
      if (items.length > 0) {
        return { ok: true, count: items.length, items };
      }
      const dates = await taskService.getCommittedDates();
      const recent = (dates || []).slice(-limit).reverse();
      const fallbackItems = recent.map((d) => ({ date: d }));
      const filtered = args.date ? fallbackItems.filter((i) => i.date === args.date) : fallbackItems;
      return { ok: true, count: filtered.length, items: filtered };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        errorCode: 'LIST_REPORTS_FAILED',
        message,
        hint: '可在 /history 页面查看发布历史',
      };
    }
  }
}

export const queryTools: BaseTool[] = [
  new ListSchedulesTool(),
  new ListAdaptersTool(),
  new ListWorkflowsTool(),
  new ListUnevaluatedNewsTool(),
  new ListScoredNewsTool(),
  new GetNewsItemTool(),
  new ListWorkflowRunsTool(),
  new GetSystemStatsTool(),
  new ListRecentReportsTool(),
];
