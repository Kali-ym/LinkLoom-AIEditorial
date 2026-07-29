import { ConfigService } from '../../../services/ConfigService.js';
import { DailyCoverageOrchestrator } from '../../../services/editorial/DailyCoverageOrchestrator.js';
import {
  requireToolContext,
  type ToolExecutionContext
} from '../../../services/ToolExecutionContext.js';
import { BaseTool } from '../../base/BaseTool.js';

function readPath(source: unknown, path?: string): unknown {
  if (!path) return source;
  const clean = path.replace(/^\$\.?/, '');
  return clean
    .split('.')
    .filter(Boolean)
    .reduce((cur: any, part) => cur?.[part], source as any);
}

export class QueryPublicationHistoryTool extends BaseTool {
  readonly id = 'query_publication_history';
  readonly name = 'query_publication_history';
  readonly displayName = '查询发布历史';
  readonly scope = 'both' as const;
  readonly description =
    '查询历史存档中的发布覆盖明细，判断候选标题或 URL 是否在近期已发布。' +
    'Agent 去重或工作流批量覆盖检查均可调用。' +
    '可直接传 items，或通过 input + itemsPath 提供素材列表；可选 asOfDate、lookbackDays、namespace。';
  readonly parameters = {
    type: 'object',
    properties: {
      namespace: { type: 'string', description: 'Coverage namespace, e.g. ai-daily' },
      asOfDate: {
        type: 'string',
        description: '当前判断日期，格式 YYYY-MM-DD'
      },
      date: { type: 'string', description: 'Alias of asOfDate' },
      lookbackDays: {
        type: 'number',
        description: '回看天数，默认使用系统跨日配置'
      },
      items: {
        type: 'array',
        description: '候选素材列表'
      },
      input: { description: 'Optional object containing items' },
      itemsPath: { type: 'string', description: 'Path inside input, default $.items' },
      urlField: { type: 'string', description: 'URL field name, default url' },
      titleField: { type: 'string', description: 'Title field name, default title' },
      titleThreshold: {
        type: 'number',
        description: '标题相似度阈值，默认使用系统跨日配置'
      },
      workflowShape: {
        type: 'boolean',
        description: '若为 true，返回工作流兼容字段（historicalUrls 等）'
      }
    }
  };

  async handler(
    args: {
      namespace?: string;
      asOfDate?: string;
      date?: string;
      lookbackDays?: number;
      items?: Array<Record<string, unknown> | { index?: number; title?: string; url?: string }>;
      input?: unknown;
      itemsPath?: string;
      urlField?: string;
      titleField?: string;
      titleThreshold?: number;
      workflowShape?: boolean;
    },
    _toolCtx?: ToolExecutionContext
  ) {
    const sourceItems = args.items || readPath(args.input, args.itemsPath || '$.items');
    const rawItems = Array.isArray(sourceItems) ? sourceItems : [];
    const urlField = args.urlField || 'url';
    const titleField = args.titleField || 'title';
    const asOfDate = args.asOfDate || args.date || new Date().toISOString().slice(0, 10);
    const namespace = args.namespace || 'default';

    const candidates = rawItems.map((item, index) => {
      const row = item as Record<string, unknown>;
      return {
        index: Number(row.index ?? index + 1),
        title: String(row[titleField] ?? row.title ?? ''),
        url: String(row[urlField] ?? row.url ?? ''),
      };
    });

    const context = requireToolContext(_toolCtx, this.id).services;
    const configService = await ConfigService.getInstance(context.localStore);
    const orchestrator = new DailyCoverageOrchestrator(
      context.localStore,
      configService.getSettings()
    );
    const result = await orchestrator.queryPublicationHistory({
      namespace,
      asOfDate,
      lookbackDays: args.lookbackDays,
      items: candidates,
      titleThreshold: args.titleThreshold
    });

    const useWorkflowShape =
      args.workflowShape === true ||
      Boolean(args.input || args.itemsPath || args.urlField || args.titleField || args.namespace);

    if (!useWorkflowShape) {
      return result;
    }

    const rawMatches = Array.isArray((result as any)?.matches) ? (result as any).matches : [];
    const historicalUrls = rawMatches
      .map(
        (match: any) => match.url || match.matched_url || match.archive_url || match.canonical_url
      )
      .filter(Boolean);
    return {
      success: true,
      namespace,
      content: JSON.stringify(result),
      coverage: result,
      historicalUrls,
      coveredUrls: historicalUrls
    };
  }
}
