import type { ToolExecutionContext } from '../../../services/ToolExecutionContext.js';
import { BaseTool } from '../../base/BaseTool.js';
import { QueryPublicationHistoryTool } from './QueryPublicationHistoryTool.js';

/** query_publication_history 别名（workflow 响应形态）。 */
export class QueryCoverageIndexTool extends BaseTool {
  readonly id = 'query_coverage_index';
  readonly name = 'query_coverage_index';
  readonly displayName = '历史覆盖检查';
  readonly scope = 'workflow' as const;
  readonly description =
    'query_publication_history 别名。检查候选条目近期是否已覆盖。';
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
      titleThreshold: { type: 'number' },
    },
  };

  private readonly delegate = new QueryPublicationHistoryTool();

  async handler(args: Record<string, unknown>, toolCtx?: ToolExecutionContext) {
    return this.delegate.handler(
      { ...args, workflowShape: true } as Parameters<QueryPublicationHistoryTool['handler']>[0],
      toolCtx
    );
  }
}
