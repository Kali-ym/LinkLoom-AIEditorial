import { requireToolContext, type ToolExecutionContext } from '../../../services/ToolExecutionContext.js';
import { BaseTool } from '../../base/BaseTool.js';
import { requireWebBrowsingService } from './webBrowsingToolSupport.js';

export class CrawlMultiPagesTool extends BaseTool {
  readonly id = 'crawl_multi_pages';
  readonly name = 'crawl_multi_pages';
  readonly displayName = '抓取多页';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    '并发抓取多个网页 URL 的可读正文（标题、摘要、正文文本）。已有多个确定链接时调用；' +
    '单页用 crawl_single_page，搜索未知信息用 web_search。必填：urls（字符串数组）；可选 limit（默认 5）。';
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
    toolCtx?: ToolExecutionContext,
  ) {
    const context = requireToolContext(toolCtx, this.id);
    const service = requireWebBrowsingService(context, this.id);
    const urls = Array.isArray(args.urls) ? args.urls.map((url) => String(url)) : [];
    return service.crawlMultiPages(urls, args.limit);
  }
}
