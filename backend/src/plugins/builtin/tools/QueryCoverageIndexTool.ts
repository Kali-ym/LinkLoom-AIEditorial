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

export class QueryCoverageIndexTool extends BaseTool {
  readonly id: string = 'query_coverage_index';
  readonly name: string = 'query_coverage_index';
  readonly displayName = '历史覆盖检查';
  readonly scope = 'workflow' as const;
  readonly description: string =
    '检查候选素材在近期历史日报中的标题/URL 覆盖情况，避免重复报道。工作流策划阶段批量检查调用。' +
    '必填：items，或通过 input + itemsPath 提供素材列表；可选 namespace（如 ai-daily）、lookbackDays、asOfDate。';
  readonly parameters = {
    type: 'object',
    properties: {
      namespace: { type: 'string', description: 'Coverage namespace, e.g. ai-daily or ai-weekly' },
      lookbackDays: { type: 'number' },
      items: { type: 'array' },
      input: { description: 'Optional object containing items' },
      itemsPath: { type: 'string', description: 'Path inside input, default $.items' },
      urlField: { type: 'string', description: 'URL field name, default url' },
      titleField: { type: 'string', description: 'Title field name, default title' },
      date: { type: 'string' },
      asOfDate: { type: 'string' },
      titleThreshold: { type: 'number' }
    }
  };

  async handler(
    args: {
      namespace?: string;
      lookbackDays?: number;
      items?: Array<Record<string, unknown>>;
      input?: unknown;
      itemsPath?: string;
      urlField?: string;
      titleField?: string;
      date?: string;
      asOfDate?: string;
      titleThreshold?: number;
    },
    _toolCtx?: ToolExecutionContext
  ) {
    const sourceItems = args.items || readPath(args.input, args.itemsPath || '$.items');
    const items = Array.isArray(sourceItems) ? (sourceItems as Array<Record<string, unknown>>) : [];
    const urlField = args.urlField || 'url';
    const titleField = args.titleField || 'title';
    const asOfDate = args.asOfDate || args.date || new Date().toISOString().slice(0, 10);

    const candidates = items.map((item, index) => ({
      index: Number(item.index ?? index + 1),
      title: String(item[titleField] ?? item.title ?? ''),
      url: String(item[urlField] ?? item.url ?? '')
    }));

    const context = requireToolContext(_toolCtx, this.id).services;
    const configService = await ConfigService.getInstance(context.localStore);
    const orchestrator = new DailyCoverageOrchestrator(
      context.localStore,
      configService.getSettings()
    );
    const result = await orchestrator.queryPublicationHistory({
      namespace: args.namespace || 'default',
      asOfDate,
      lookbackDays: args.lookbackDays,
      items: candidates,
      titleThreshold: args.titleThreshold
    });

    const rawMatches = Array.isArray((result as any)?.matches) ? (result as any).matches : [];
    const historicalUrls = rawMatches
      .map(
        (match: any) => match.url || match.matched_url || match.archive_url || match.canonical_url
      )
      .filter(Boolean);
    return {
      success: true,
      namespace: args.namespace || 'default',
      content: JSON.stringify(result),
      coverage: result,
      historicalUrls,
      coveredUrls: historicalUrls
    };
  }
}
