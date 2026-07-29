import { requireToolContext, type ToolExecutionContext } from '../../../services/ToolExecutionContext.js';
import { BaseTool } from '../../base/BaseTool.js';
import { requireWebBrowsingService } from './webBrowsingToolSupport.js';

/** @deprecated Prefer crawl_pages. Kept as compatibility alias. */
export class CrawlSinglePageTool extends BaseTool {
  readonly id = 'crawl_single_page';
  readonly name = 'crawl_single_page';
  readonly displayName = '抓取单页';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    '【兼容别名】请优先使用 crawl_pages。抓取单个网页 URL 的可读正文。必填：url。';
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
