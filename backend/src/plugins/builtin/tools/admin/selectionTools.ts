import {
  requireToolContext,
  type ToolExecutionContext,
} from '../../../../services/ToolExecutionContext.js';
import { FeedRouteService } from '../../../../services/api/FeedRouteService.js';
import { ContentRouteService } from '../../../../services/api/ContentRouteService.js';
import { PublishingRouteService } from '../../../../services/api/PublishingRouteService.js';
import type { ToolExecutionPolicy } from '../../../../types/agent.js';
import { BaseTool } from '../../../base/BaseTool.js';

const MEDIUM: ToolExecutionPolicy = { readonly: false, riskLevel: 'medium' };

class ListRawNewsTool extends BaseTool {
  readonly id = 'list_raw_news';
  readonly name = 'list_raw_news';
  readonly displayName = '列原始素材';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    '列出 Feed 原始素材时间线（与 /selection raw 同源）。' +
    '可选 date、rangeFrom、rangeTo、limit(默认 100)、offset。';
  readonly parameters = {
    type: 'object',
    properties: {
      date: { type: 'string', description: '采集日期 YYYY-MM-DD' },
      rangeFrom: { type: 'string', description: '发布日起 YYYY-MM-DD' },
      rangeTo: { type: 'string', description: '发布日止 YYYY-MM-DD' },
      limit: { type: 'number', description: '条数，默认 100，最大 200' },
      offset: { type: 'number', description: '偏移' },
    },
  };

  async handler(
    args: {
      date?: string;
      rangeFrom?: string;
      rangeTo?: string;
      limit?: number;
      offset?: number;
    },
    toolCtx?: ToolExecutionContext,
  ) {
    const { store, services } = requireToolContext(toolCtx, this.id);
    try {
      const feedService = new FeedRouteService(store, services);
      const result = await feedService.getRawTimeline(args);
      return { ok: true, ...result };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, errorCode: 'LIST_RAW_NEWS_FAILED', message };
    }
  }
}

class ImportOpmlTool extends BaseTool {
  readonly id = 'import_opml';
  readonly name = 'import_opml';
  readonly displayName = '导入 OPML';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly execution = MEDIUM;
  readonly description =
    '将 OPML 内容导入 RSS 适配器订阅源。必填 opmlContent；可选 adapterId。';
  readonly parameters = {
    type: 'object',
    properties: {
      opmlContent: { type: 'string', description: 'OPML XML 文本' },
      adapterId: { type: 'string', description: '目标 RSS 适配器 id（可选）' },
    },
    required: ['opmlContent'],
  };

  async handler(
    args: { opmlContent?: string; adapterId?: string },
    toolCtx?: ToolExecutionContext,
  ) {
    const { store, services } = requireToolContext(toolCtx, this.id);
    try {
      const service = new ContentRouteService(store, services);
      const result = await service.importOpml(args.opmlContent, args.adapterId);
      return { ok: true, result };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, errorCode: 'IMPORT_OPML_FAILED', message };
    }
  }
}

class ListProcessedNewsTool extends BaseTool {
  readonly id = 'list_processed_news';
  readonly name = 'list_processed_news';
  readonly displayName = '列已处理新闻';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    '列出已 AI 评分/处理过的新闻素材,支持按日期/主题/来源类型/是否入选筛选。' +
    '可选 date(ingestionDate)、topic、sourceType、picked(boolean)、limit(默认 20)。';
  readonly parameters = {
    type: 'object',
    properties: {
      date: { type: 'string', description: '采集日期 YYYY-MM-DD(可选)' },
      topic: { type: 'string', description: '主题筛选(可选)' },
      sourceType: { type: 'string', description: '来源类型筛选(可选)' },
      picked: { type: 'boolean', description: '是否已入选(可选)' },
      limit: { type: 'number', description: '返回条数,默认 20' },
    },
  };

  async handler(
    args: {
      date?: string;
      topic?: string;
      sourceType?: string;
      picked?: boolean;
      limit?: number;
    },
    toolCtx?: ToolExecutionContext,
  ) {
    const { store } = requireToolContext(toolCtx, this.id);
    try {
      const result = await store.repositories.sourceData.list({
        hasAiScored: true,
        aiTopic: args.topic,
        aiSourceTypes: args.sourceType ? [args.sourceType] : undefined,
        aiPicked: args.picked,
        ingestionDate: args.date,
        limit: args.limit ?? 20,
      });
      const items = (result?.items || []).map((it) => ({
        id: it.id,
        title: it.title,
        score: it.metadata?.ai_score,
        topic: it.metadata?.ai_topic,
        source: it.source,
        published_date: it.published_date,
      }));
      return { ok: true, count: items.length, items };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, errorCode: 'LIST_PROCESSED_NEWS_FAILED', message };
    }
  }
}

class GetSelectionStatsTool extends BaseTool {
  readonly id = 'get_selection_stats';
  readonly name = 'get_selection_stats';
  readonly displayName = '选题统计';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    '获取选题/Feed 管理 KPI(未评分/24h 处理量/通过率/最近日报时间等)。用户问选题概况或 selection 页面 KPI 时调用。';
  readonly parameters = { type: 'object', properties: {} };

  async handler(_args: Record<string, never>, toolCtx?: ToolExecutionContext) {
    const { store, services } = requireToolContext(toolCtx, this.id);
    try {
      const feedService = new FeedRouteService(store, services);
      const stats = await feedService.getAdminStats();
      return { ok: true, stats };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        errorCode: 'GET_SELECTION_STATS_FAILED',
        message,
        hint: '可在 /selection 页面查看统计',
      };
    }
  }
}

class QueryContinuationReportTool extends BaseTool {
  readonly id = 'query_continuation_report';
  readonly name = 'query_continuation_report';
  readonly displayName = '查续报报告';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    '查询日报续报/覆盖历史(publication continuation report)。' +
    '可选 asOfDate(YYYY-MM-DD)、lookbackDays、namespace(默认 default)。';
  readonly parameters = {
    type: 'object',
    properties: {
      asOfDate: { type: 'string', description: '基准日期 YYYY-MM-DD(可选,默认今日)' },
      lookbackDays: { type: 'number', description: '回溯天数(可选)' },
      namespace: { type: 'string', description: '命名空间(可选,默认 default)' },
    },
  };

  async handler(
    args: { asOfDate?: string; lookbackDays?: number; namespace?: string },
    toolCtx?: ToolExecutionContext,
  ) {
    const { store, services } = requireToolContext(toolCtx, this.id);
    try {
      const publishingService = new PublishingRouteService(store, services);
      const result = await publishingService.queryPublicationItems({
        asOfDate: args.asOfDate,
        lookbackDays: args.lookbackDays,
        namespace: args.namespace,
      });
      return { ok: true, ...result };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        errorCode: 'QUERY_CONTINUATION_REPORT_FAILED',
        message,
        hint: '可在 /generation 页面查看续报历史',
      };
    }
  }
}

export const selectionTools: BaseTool[] = [
  new ListRawNewsTool(),
  new ImportOpmlTool(),
  new ListProcessedNewsTool(),
  new GetSelectionStatsTool(),
  new QueryContinuationReportTool(),
];
