import { requireToolContext, type ToolExecutionContext } from '../../../services/ToolExecutionContext.js';
import { BaseTool } from '../../base/BaseTool.js';
import { requireWebBrowsingService } from './webBrowsingToolSupport.js';

/** crawl_pages 别名（多 URL）。 */
export class CrawlMultiPagesTool extends BaseTool {
  readonly id = 'crawl_multi_pages';
  readonly name = 'crawl_multi_pages';
  readonly displayName = '抓取多页';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description = 'crawl_pages 别名。抓取多个页面。必填 urls；可选 limit。';
  readonly parameters = {
    type: 'object',
    properties: {
      urls: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of page URLs to crawl',
      },
      limit: { type: 'number', description: 'Maximum pages to crawl (default 5)' },
    },
    required: ['urls'],
  };

  async handler(
    args: { urls?: string[]; limit?: number },
    toolCtx?: ToolExecutionContext
  ) {
    const context = requireToolContext(toolCtx, this.id);
    const service = requireWebBrowsingService(context, this.id);
    const urls = Array.isArray(args.urls) ? args.urls.map((url) => String(url)) : [];
    return service.crawlMultiPages(urls, args.limit);
  }
}
