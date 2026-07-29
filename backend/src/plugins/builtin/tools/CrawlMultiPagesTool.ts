import { requireToolContext, type ToolExecutionContext } from '../../../services/ToolExecutionContext.js';
import { BaseTool } from '../../base/BaseTool.js';
import { requireWebBrowsingService } from './webBrowsingToolSupport.js';

/** @deprecated Prefer crawl_pages. Kept as compatibility alias. */
export class CrawlMultiPagesTool extends BaseTool {
  readonly id = 'crawl_multi_pages';
  readonly name = 'crawl_multi_pages';
  readonly displayName = '抓取多页';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    '【兼容别名】请优先使用 crawl_pages。并发抓取多个网页。必填：urls；可选 limit。';
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
