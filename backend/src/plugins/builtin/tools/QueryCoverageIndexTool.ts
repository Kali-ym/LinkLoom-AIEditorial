import type { ToolExecutionContext } from '../../../services/ToolExecutionContext.js';
import { BaseTool } from '../../base/BaseTool.js';
import { QueryPublicationHistoryTool } from './QueryPublicationHistoryTool.js';

/** @deprecated Prefer query_publication_history. Kept as workflow compatibility alias. */
export class QueryCoverageIndexTool extends BaseTool {
  readonly id: string = 'query_coverage_index';
  readonly name: string = 'query_coverage_index';
  readonly displayName = '历史覆盖检查';
  readonly scope = 'workflow' as const;
  readonly description: string =
    '【兼容别名】请优先使用 query_publication_history。检查候选素材在近期历史日报中的覆盖情况。';
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

  private readonly delegate = new QueryPublicationHistoryTool();

  async handler(args: Record<string, unknown>, toolCtx?: ToolExecutionContext) {
    return this.delegate.handler(
      { ...args, workflowShape: true } as Parameters<QueryPublicationHistoryTool['handler']>[0],
      toolCtx
    );
  }
}
