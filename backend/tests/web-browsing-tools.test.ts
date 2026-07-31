import { describe, expect, it, vi } from 'vitest';

import { CrawlMultiPagesTool } from '../src/plugins/builtin/tools/CrawlMultiPagesTool.js';
import { CrawlSinglePageTool } from '../src/plugins/builtin/tools/CrawlSinglePageTool.js';
import { WebSearchTool } from '../src/plugins/builtin/tools/WebSearchTool.js';
import type { ToolExecutionContext } from '../src/services/ToolExecutionContext.js';
import { WebBrowsingService } from '../src/services/web/WebBrowsingService.js';

function createCtx(service: WebBrowsingService): ToolExecutionContext {
  return {
    store: {} as ToolExecutionContext['store'],
    settings: {} as ToolExecutionContext['settings'],
    taskService: {} as ToolExecutionContext['taskService'],
    agentService: null,
    logger: console as unknown as ToolExecutionContext['logger'],
    auditLogger: {} as ToolExecutionContext['auditLogger'],
    services: {
      webBrowsingService: service,
    } as ToolExecutionContext['services'],
  };
}

describe('WebBrowsingService', () => {
  it('crawls a single page via fetch fallback', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        '<html><head><title>Example</title><meta name="description" content="Demo page" /></head><body><p>Hello web</p></body></html>',
        { status: 200, headers: { 'content-type': 'text/html' } },
      ),
    );

    const service = new WebBrowsingService({ fetchImpl });
    const result = await service.crawlSinglePage('https://example.com/article');

    expect(result.results[0]).toMatchObject({
      url: 'https://example.com/article',
      title: 'Example',
      description: 'Demo page',
      crawler: 'fetch',
    });
    expect(result.pages).toEqual([{ url: 'https://example.com/article', title: 'Example' }]);
    expect(result.results[0]?.content).toContain('Hello web');
  });

  it('searches via duckduckgo html fallback', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        `
        <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fnews.example.com%2Fa">News A</a>
        <a class="result__snippet">Snippet A</a>
        <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fnews.example.com%2Fb">News B</a>
        `,
        { status: 200, headers: { 'content-type': 'text/html' } },
      ),
    );

    const service = new WebBrowsingService({ fetchImpl });
    const result = await service.search('linkloom agent', 2);

    expect(result.count).toBe(2);
    expect(result.results[0]).toMatchObject({
      title: 'News A',
      url: 'https://news.example.com/a',
    });
  });

  it('marks outbound network failures as non-retryable for the current run', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    const service = new WebBrowsingService({ fetchImpl });

    await expect(service.search('linkloom agent')).rejects.toMatchObject({
      name: 'WebSearchNetworkError',
      code: 'WEB_SEARCH_NETWORK_UNAVAILABLE',
      retryable: false,
    });
  });
});

describe('web browsing tools', () => {
  it('web_search delegates to WebBrowsingService', async () => {
    const search = vi.fn(async () => ({
      query: 'topic',
      results: [{ title: 'Hit', url: 'https://hit.example' }],
      count: 1,
      summary: '找到 1 条网页结果',
    }));
    const service = { search } as unknown as WebBrowsingService;
    const tool = new WebSearchTool();
    const result = await tool.handler({ query: 'topic' }, createCtx(service));

    expect(search).toHaveBeenCalledWith('topic', undefined);
    expect(result.count).toBe(1);
  });

  it('crawl_single_page returns pages for WebPageCardsRender', async () => {
    const crawlSinglePage = vi.fn(async () => ({
      url: 'https://example.com',
      results: [{ url: 'https://example.com', title: 'Example', content: 'Body' }],
      pages: [{ url: 'https://example.com', title: 'Example' }],
      summary: '已抓取 Example',
    }));
    const service = { crawlSinglePage } as unknown as WebBrowsingService;
    const tool = new CrawlSinglePageTool();
    const result = await tool.handler({ url: 'https://example.com' }, createCtx(service));

    expect(result.pages).toEqual([{ url: 'https://example.com', title: 'Example' }]);
  });

  it('crawl_multi_pages crawls multiple urls', async () => {
    const crawlMultiPages = vi.fn(async () => ({
      results: [
        { url: 'https://a.example', title: 'A' },
        { url: 'https://b.example', title: 'B' },
      ],
      pages: [
        { url: 'https://a.example', title: 'A' },
        { url: 'https://b.example', title: 'B' },
      ],
      count: 2,
      summary: '已抓取 2/2 个页面',
    }));
    const service = { crawlMultiPages } as unknown as WebBrowsingService;
    const tool = new CrawlMultiPagesTool();
    const result = await tool.handler(
      { urls: ['https://a.example', 'https://b.example'] },
      createCtx(service),
    );

    expect(result.count).toBe(2);
    expect(result.pages).toHaveLength(2);
  });
});
