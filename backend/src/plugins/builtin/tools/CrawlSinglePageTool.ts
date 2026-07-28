import { requireToolContext, type ToolExecutionContext } from '../../../services/ToolExecutionContext.js';
import { BaseTool } from '../../base/BaseTool.js';
import { requireWebBrowsingService } from './webBrowsingToolSupport.js';

export class CrawlSinglePageTool extends BaseTool {
  readonly id = 'crawl_single_page';
  readonly name = 'crawl_single_page';
  readonly displayName = '抓取单页';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    '抓取单个网页 URL 的可读正文（标题、摘要、正文文本）。已有确定 URL 需读取全文时调用；' +
    '搜索页面用 web_search，多页用 crawl_multi_pages。必填：url。';
  readonly parameters = {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'Page URL to crawl' },
    },
    required: ['url'],
  };

  async handler(args: { url?: string }, toolCtx?: ToolExecutionContext) {
    const context = requireToolContext(toolCtx, this.id);
    const service = requireWebBrowsingService(context, this.id);
    return service.crawlSinglePage(String(args.url || ''));
  }
}
