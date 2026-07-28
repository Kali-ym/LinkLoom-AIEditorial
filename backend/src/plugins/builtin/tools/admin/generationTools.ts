import {
  requireToolContext,
  type ToolExecutionContext,
} from '../../../../services/ToolExecutionContext.js';
import type { ToolExecutionPolicy } from '../../../../types/agent.js';
import { ContentRouteService } from '../../../../services/api/ContentRouteService.js';
import { FeedRouteService } from '../../../../services/api/FeedRouteService.js';
import { WorkflowRunService } from '../../../../services/api/WorkflowRunService.js';
import { DigestContextService } from '../../../../services/editorial/DigestContextService.js';
import type { WorkflowRun } from '../../../../services/agents/WorkflowRun.js';
import { BaseTool } from '../../../base/BaseTool.js';

const MEDIUM: ToolExecutionPolicy = { readonly: false, riskLevel: 'medium' };

const DIGEST_PIPELINE_IDS = [
  'sched_hot_topics_digest',
  'sched_source_monitor_digest',
  'sched_topic_track_digest',
] as const;

function resolveToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function extractEditorialPlan(run: WorkflowRun): unknown | undefined {
  const plan = run.metadata?.editorialPlan;
  return plan === undefined ? undefined : plan;
}

function buildWorkflowRunPayload(run: WorkflowRun): Record<string, unknown> {
  const editorialPlan = extractEditorialPlan(run);
  return editorialPlan === undefined ? { ok: true, run } : { ok: true, run, editorialPlan };
}

class GetDailyReportJsonTool extends BaseTool {
  readonly id = 'get_daily_report_json';
  readonly name = 'get_daily_report_json';
  readonly displayName = '查日报 JSON';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    '读取 JSON 版日报(由 wf_ai_daily_report_json 工作流落地)。可选 date(YYYY-MM-DD,默认今日)。' +
    '用户要预览/检查结构化日报时调用。';
  readonly parameters = {
    type: 'object',
    properties: {
      date: { type: 'string', description: '日报日期 YYYY-MM-DD(可选,默认今日)' },
    },
  };

  async handler(args: { date?: string }, toolCtx?: ToolExecutionContext) {
    const { store, services } = requireToolContext(toolCtx, this.id);
    try {
      const feedService = new FeedRouteService(store, services);
      const result = await feedService.getReportJson({ date: args.date });
      if (!result) {
        return {
          ok: false,
          errorCode: 'NOT_FOUND',
          message: `未找到 ${args.date || '今日'} 的 JSON 日报`,
          hint: '调 list_report_json_dates 查看可用日期',
        };
      }
      return { ok: true, date: result.date, report: result.report };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        errorCode: 'GET_DAILY_REPORT_JSON_FAILED',
        message,
        hint: '可在 /generation 页面查看日报',
      };
    }
  }
}

class ListReportJsonDatesTool extends BaseTool {
  readonly id = 'list_report_json_dates';
  readonly name = 'list_report_json_dates';
  readonly displayName = '列日报 JSON 日期';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    '列出已有 JSON 版日报的可用日期(含 storyCount)。用户要选择日报日期或确认哪些日期已生成时调用。';
  readonly parameters = { type: 'object', properties: {} };

  async handler(_args: Record<string, never>, toolCtx?: ToolExecutionContext) {
    const { store, services } = requireToolContext(toolCtx, this.id);
    try {
      const feedService = new FeedRouteService(store, services);
      const dates = await feedService.getReportJsonDates();
      return { ok: true, dates };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, errorCode: 'LIST_REPORT_JSON_DATES_FAILED', message };
    }
  }
}

class GetDigestContextTool extends BaseTool {
  readonly id = 'get_digest_context';
  readonly name = 'get_digest_context';
  readonly displayName = '查摘要上下文';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    '读取 editorial digest 上下文(热点/源监控/主题追踪摘要)。可选 date(YYYY-MM-DD,默认今日)。';
  readonly parameters = {
    type: 'object',
    properties: {
      date: { type: 'string', description: '日期 YYYY-MM-DD(可选,默认今日)' },
    },
  };

  async handler(args: { date?: string }, toolCtx?: ToolExecutionContext) {
    const { store } = requireToolContext(toolCtx, this.id);
    try {
      const digestService = new DigestContextService(store);
      const date =
        typeof args.date === 'string' && args.date.trim()
          ? args.date.trim().slice(0, 10)
          : resolveToday();
      const context = await digestService.getDigestContext(date);
      return { ok: true, context };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        errorCode: 'GET_DIGEST_CONTEXT_FAILED',
        message,
        hint: '可在 /generation 页面查看 digest 上下文',
      };
    }
  }
}

class RefreshDigestContextTool extends BaseTool {
  readonly id = 'refresh_digest_context';
  readonly name = 'refresh_digest_context';
  readonly displayName = '刷新摘要上下文';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly execution = MEDIUM;
  readonly description =
    '手动触发 digest 管线定时任务(热点/源监控/主题追踪),刷新 editorial digest 上下文。' +
    '仅对已存在的 schedule 执行 runNow。无需参数。';
  readonly parameters = { type: 'object', properties: {} };

  async handler(_args: Record<string, never>, toolCtx?: ToolExecutionContext) {
    const { store, services } = requireToolContext(toolCtx, this.id);
    try {
      const schedulerService = services.schedulerService;
      if (!schedulerService) {
        return {
          ok: false,
          errorCode: 'SERVICE_UNAVAILABLE',
          message: 'SchedulerService 不可用',
        };
      }
      const triggered: string[] = [];
      for (const scheduleId of DIGEST_PIPELINE_IDS) {
        const schedule = await store.getSchedule(scheduleId);
        if (schedule) {
          await schedulerService.runNow(scheduleId);
          triggered.push(scheduleId);
        }
      }
      return { ok: true, triggered };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        errorCode: 'REFRESH_DIGEST_CONTEXT_FAILED',
        message,
        hint: '可在 /generation 页面手动刷新 digest',
      };
    }
  }
}

class GetAggregatedContentTool extends BaseTool {
  readonly id = 'get_aggregated_content';
  readonly name = 'get_aggregated_content';
  readonly displayName = '查聚合素材';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    '读取指定日期的聚合内容素材。可选 date(YYYY-MM-DD,默认今日)、rangeFrom/rangeTo 日期范围。';
  readonly parameters = {
    type: 'object',
    properties: {
      date: { type: 'string', description: '目标日期 YYYY-MM-DD(可选)' },
      rangeFrom: { type: 'string', description: '范围起始日期 YYYY-MM-DD(可选)' },
      rangeTo: { type: 'string', description: '范围结束日期 YYYY-MM-DD(可选)' },
    },
  };

  async handler(
    args: { date?: string; rangeFrom?: string; rangeTo?: string },
    toolCtx?: ToolExecutionContext,
  ) {
    const { store, services } = requireToolContext(toolCtx, this.id);
    try {
      const contentService = new ContentRouteService(store, services);
      const result = await contentService.getAggregatedContent({
        date: args.date,
        rangeFrom: args.rangeFrom,
        rangeTo: args.rangeTo,
      });
      return { ok: true, ...result };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        errorCode: 'GET_AGGREGATED_CONTENT_FAILED',
        message,
        hint: '可在 /generation 页面查看聚合素材',
      };
    }
  }
}

class GetWorkflowRunDetailTool extends BaseTool {
  readonly id = 'get_workflow_run_detail';
  readonly name = 'get_workflow_run_detail';
  readonly displayName = '查工作流运行详情';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    '查询单次工作流运行的完整详情,含步骤状态;若存在 editorialPlan 则一并返回。必填 runId。';
  readonly parameters = {
    type: 'object',
    properties: { runId: { type: 'string', description: '工作流运行 id' } },
    required: ['runId'],
  };

  async handler(args: { runId: string }, toolCtx?: ToolExecutionContext) {
    const { store, services } = requireToolContext(toolCtx, this.id);
    try {
      const service = new WorkflowRunService(store, services);
      const run = await service.getWorkflowRun(args.runId);
      return buildWorkflowRunPayload(run);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      const notFound = message.includes('not found');
      return {
        ok: false,
        errorCode: notFound ? 'NOT_FOUND' : 'GET_WORKFLOW_RUN_DETAIL_FAILED',
        message,
        hint: '调 list_workflow_runs 查看可用运行',
      };
    }
  }
}

export const generationTools: BaseTool[] = [
  new GetDailyReportJsonTool(),
  new ListReportJsonDatesTool(),
  new GetDigestContextTool(),
  new RefreshDigestContextTool(),
  new GetAggregatedContentTool(),
  new GetWorkflowRunDetailTool(),
];
