import { requireToolContext, type ToolExecutionContext } from '../../../services/ToolExecutionContext.js';
import { BaseTool } from '../../base/BaseTool.js';
import { requireWebBrowsingService } from './webBrowsingToolSupport.js';

export class CrawlPagesTool extends BaseTool {
  readonly id = 'crawl_pages';
  readonly name = 'crawl_pages';
  readonly displayName = '抓取网页';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    '抓取一个或多个网页 URL 的可读正文（标题、摘要、正文文本）。已有确定链接时调用；' +
    '搜索未知信息用 web_search。提供 url（单页）或 urls（多页）；可选 limit（默认 5）。';
  readonly parameters = {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'Single page URL to crawl' },
      urls: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of page URLs to crawl',
      },
      limit: { type: 'number', description: 'Maximum pages to crawl when using urls (default 5)' },
    },
  };

  async handler(
    args: { url?: string; urls?: string[]; limit?: number },
    toolCtx?: ToolExecutionContext
  ) {
    const context = requireToolContext(toolCtx, this.id);
    const service = requireWebBrowsingService(context, this.id);
    const single = typeof args.url === 'string' ? args.url.trim() : '';
    const many = Array.isArray(args.urls) ? args.urls.map((u) => String(u)).filter(Boolean) : [];
    if (single && many.length === 0) {
      return service.crawlSinglePage(single);
    }
    const urls = single ? [single, ...many] : many;
    if (urls.length === 0) {
      throw new Error('Provide url or urls');
    }
    if (urls.length === 1) {
      return service.crawlSinglePage(urls[0]!);
    }
    return service.crawlMultiPages(urls, args.limit);
  }
}
