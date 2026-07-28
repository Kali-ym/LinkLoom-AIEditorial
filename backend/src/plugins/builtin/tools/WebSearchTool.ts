import { requireToolContext, type ToolExecutionContext } from '../../../services/ToolExecutionContext.js';
import { BaseTool } from '../../base/BaseTool.js';
import { requireWebBrowsingService } from './webBrowsingToolSupport.js';

export class WebSearchTool extends BaseTool {
  readonly id = 'web_search';
  readonly name = 'web_search';
  readonly displayName = '网页搜索';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    '在互联网上搜索与查询词相关的网页链接与摘要。需要发现未知 URL 或获取最新公开信息时调用；' +
    '已知 URL 抓取用 crawl_single_page，读取页面正文用 crawl_multi_pages。必填：query（或 q 别名）；可选 limit（默认 5）。';
  readonly parameters = {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      q: { type: 'string', description: 'Alias of query' },
      limit: { type: 'number', description: 'Maximum number of results (default 5)' },
    },
    required: ['query'],
  };

  async handler(
    args: { query?: string; q?: string; limit?: number },
    toolCtx?: ToolExecutionContext,
  ) {
    const context = requireToolContext(toolCtx, this.id);
    const service = requireWebBrowsingService(context, this.id);
    const query = (args.query || args.q || '').trim();
    return service.search(query, args.limit);
  }
}
