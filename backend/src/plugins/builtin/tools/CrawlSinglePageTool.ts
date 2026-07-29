import { requireToolContext, type ToolExecutionContext } from '../../../services/ToolExecutionContext.js';
import { BaseTool } from '../../base/BaseTool.js';
import { requireWebBrowsingService } from './webBrowsingToolSupport.js';

/** crawl_pages 别名（单 URL）。 */
export class CrawlSinglePageTool extends BaseTool {
  readonly id = 'crawl_single_page';
  readonly name = 'crawl_single_page';
  readonly displayName = '抓取单页';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description = 'crawl_pages 别名。抓取单个页面。必填 url。';
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
