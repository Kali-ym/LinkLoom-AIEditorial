import type { Dispatcher } from 'undici';

import { AppError } from '../../domain/errors.js';
import { LogService } from '../LogService.js';

export interface WebSearchResultItem {
  title: string;
  url: string;
  snippet?: string;
  score?: number;
}

export interface CrawlPageResult {
  url: string;
  title?: string;
  description?: string;
  siteName?: string;
  content?: string;
  rawContent?: string;
  wordCount?: number;
  crawler?: string;
  error?: string;
}

export type WebFetch = typeof fetch;

export interface WebBrowsingServiceOptions {
  jinaApiKey?: string;
  userAgent?: string;
  fetchImpl?: WebFetch;
  maxContentChars?: number;
  /** Undici dispatcher (e.g. ProxyAgent) for outbound search/crawl requests. */
  dispatcher?: Dispatcher;
}

const DEFAULT_USER_AGENT =
  'LinkLoom-WebBrowsing/1.0 (+https://github.com/linkloom; agent-console)';

function normalizeHttpUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new AppError(400, 'URL is required');
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new AppError(400, `Invalid URL: ${trimmed}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new AppError(400, `Only http/https URLs are supported: ${trimmed}`);
  }
  return url.toString();
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function stripHtmlToText(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

function extractTitleFromHtml(html: string, fallback: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return decodeHtmlEntities(match?.[1]?.trim() || fallback);
}

function extractMetaDescription(html: string): string | undefined {
  const match = html.match(
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i,
  );
  return match?.[1] ? decodeHtmlEntities(match[1].trim()) : undefined;
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function truncateContent(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n\n…`;
}

function toPageCard(page: CrawlPageResult) {
  return {
    url: page.url,
    title: page.title || page.url,
  };
}

export class WebBrowsingService {
  private readonly fetchImpl: WebFetch;
  private readonly maxContentChars: number;
  private readonly dispatcher?: Dispatcher;

  constructor(private readonly options: WebBrowsingServiceOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.maxContentChars = options.maxContentChars ?? 12_000;
    this.dispatcher = options.dispatcher;
  }

  private request(url: string, init?: RequestInit): Promise<Response> {
    if (!this.dispatcher) {
      return this.fetchImpl(url, init);
    }
    return this.fetchImpl(url, { ...init, dispatcher: this.dispatcher } as RequestInit);
  }

  async search(query: string, limit = 5) {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      throw new AppError(400, 'Search query is required');
    }
    const cappedLimit = Math.max(1, Math.min(limit, 10));
    let results: WebSearchResultItem[];
    try {
      results = this.options.jinaApiKey
        ? await this.searchWithJina(normalizedQuery, cappedLimit)
        : await this.searchWithDuckDuckGo(normalizedQuery, cappedLimit);
    } catch (error) {
      if (isNetworkFetchError(error)) {
        const message = error instanceof Error ? error.message : String(error);
        const networkError = new Error(
          `网页搜索暂不可用：${message}。请稍后重试，或配置 JINA_API_KEY/HTTPS 代理。`
        ) as Error & { code?: string; retryable?: boolean };
        networkError.name = 'WebSearchNetworkError';
        networkError.code = 'WEB_SEARCH_NETWORK_UNAVAILABLE';
        networkError.retryable = false;
        throw networkError;
      }
      throw error;
    }

    return {
      query: normalizedQuery,
      results,
      count: results.length,
      summary: results.length > 0 ? `找到 ${results.length} 条网页结果` : '未找到相关网页',
    };
  }

  async crawlSinglePage(urlInput: string): Promise<{
    url: string;
    results: CrawlPageResult[];
    pages: Array<{ url: string; title: string }>;
    summary: string;
  }> {
    const page = await this.crawlPage(urlInput);
    const pages = [toPageCard(page)];
    return {
      url: page.url,
      results: [page],
      pages,
      summary: page.error ? `抓取失败：${page.error}` : `已抓取 ${page.title || page.url}`,
    };
  }

  async crawlMultiPages(urlsInput: string[], limit = 5) {
    const urls = [...new Set(urlsInput.map((url) => normalizeHttpUrl(url)))].slice(
      0,
      Math.max(1, Math.min(limit, 8)),
    );
    if (!urls.length) {
      throw new AppError(400, 'At least one URL is required');
    }

    const results = await Promise.all(urls.map((url) => this.crawlPage(url)));
    const pages = results.map((page) => toPageCard(page));
    const successCount = results.filter((page) => !page.error).length;

    return {
      results,
      pages,
      count: results.length,
      summary:
        successCount > 0
          ? `已抓取 ${successCount}/${results.length} 个页面`
          : '全部页面抓取失败',
    };
  }

  private async crawlPage(urlInput: string): Promise<CrawlPageResult> {
    const url = normalizeHttpUrl(urlInput);
    try {
      if (this.options.jinaApiKey) {
        return await this.crawlWithJina(url);
      }
      return await this.crawlWithFetch(url);
    } catch (error: any) {
      LogService.warn(`[WebBrowsing] crawl failed for ${url}: ${error?.message || error}`);
      return {
        url,
        title: url,
        error: error?.message || String(error),
        content: '',
        rawContent: '',
        wordCount: 0,
        crawler: 'fetch',
      };
    }
  }

  private async crawlWithJina(url: string): Promise<CrawlPageResult> {
    const response = await this.request(`https://r.jina.ai/${encodeURIComponent(url)}`, {
      headers: {
        Authorization: `Bearer ${this.options.jinaApiKey}`,
        Accept: 'text/plain',
        'X-Return-Format': 'markdown',
      },
    });
    const rawContent = await response.text();
    if (!response.ok) {
      throw new AppError(response.status, rawContent || `Jina reader failed (${response.status})`);
    }

    const title = response.headers.get('x-title') || extractTitleFromMarkdown(rawContent, url);
    const description = response.headers.get('x-description') || undefined;
    const siteName = response.headers.get('x-site-name') || undefined;
    const content = truncateContent(rawContent.trim(), this.maxContentChars);

    return {
      url,
      title,
      description,
      siteName: siteName || undefined,
      content,
      rawContent,
      wordCount: countWords(content),
      crawler: 'jina',
    };
  }

  private async crawlWithFetch(url: string): Promise<CrawlPageResult> {
    const response = await this.request(url, {
      headers: {
        'User-Agent': this.options.userAgent || DEFAULT_USER_AGENT,
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
    });
    const rawContent = await response.text();
    if (!response.ok) {
      throw new AppError(response.status, `HTTP ${response.status} for ${url}`);
    }

    const title = extractTitleFromHtml(rawContent, url);
    const description = extractMetaDescription(rawContent);
    const content = truncateContent(stripHtmlToText(rawContent), this.maxContentChars);

    return {
      url,
      title,
      description,
      siteName: new URL(url).hostname,
      content,
      rawContent: truncateContent(rawContent, this.maxContentChars),
      wordCount: countWords(content),
      crawler: 'fetch',
    };
  }

  private async searchWithJina(query: string, limit: number): Promise<WebSearchResultItem[]> {
    const response = await this.request(
      `https://s.jina.ai/?q=${encodeURIComponent(query)}`,
      {
        headers: {
          Authorization: `Bearer ${this.options.jinaApiKey}`,
          Accept: 'application/json',
        },
      },
    );
    const body = await response.text();
    if (!response.ok) {
      throw new AppError(response.status, body || `Jina search failed (${response.status})`);
    }

    try {
      const parsed = JSON.parse(body) as { data?: Array<Record<string, unknown>> };
      const rows = Array.isArray(parsed.data) ? parsed.data : [];
      return rows.slice(0, limit).map((row, index) => ({
        title: String(row.title || row.name || `Result ${index + 1}`),
        url: String(row.url || row.link || ''),
        snippet: typeof row.description === 'string' ? row.description : undefined,
        score: typeof row.score === 'number' ? row.score : undefined,
      })).filter((item) => item.url);
    } catch {
      return this.parseJinaSearchMarkdown(body, limit);
    }
  }

  private parseJinaSearchMarkdown(body: string, limit: number): WebSearchResultItem[] {
    const results: WebSearchResultItem[] = [];
    const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
    let match: RegExpExecArray | null;
    while ((match = linkPattern.exec(body)) && results.length < limit) {
      results.push({
        title: match[1].trim(),
        url: match[2].trim(),
      });
    }
    return results;
  }

  private async searchWithDuckDuckGo(query: string, limit: number): Promise<WebSearchResultItem[]> {
    const response = await this.request('https://html.duckduckgo.com/html/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': this.options.userAgent || DEFAULT_USER_AGENT,
      },
      body: new URLSearchParams({ q: query }).toString(),
    });
    const html = await response.text();
    if (!response.ok) {
      throw new AppError(response.status, `DuckDuckGo search failed (${response.status})`);
    }

    const results: WebSearchResultItem[] = [];
    const resultPattern =
      /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>)?/gi;
    let match: RegExpExecArray | null;
    while ((match = resultPattern.exec(html)) && results.length < limit) {
      const url = decodeDuckDuckGoRedirect(match[1]);
      if (!url) continue;
      results.push({
        title: stripHtmlToText(match[2]),
        url,
        snippet: match[3] ? stripHtmlToText(match[3]) : undefined,
        score: Math.max(0.5, 1 - results.length * 0.08),
      });
    }
    return results;
  }
}

function isNetworkFetchError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    error instanceof TypeError ||
    message.includes('fetch failed') ||
    message.includes('network') ||
    message.includes('econn') ||
    message.includes('enotfound') ||
    message.includes('timed out')
  );
}

function decodeDuckDuckGoRedirect(href: string): string | undefined {
  try {
    const absolute = href.startsWith('http')
      ? href
      : `https://duckduckgo.com${href.startsWith('/') ? '' : '/'}${href}`;
    const url = new URL(absolute);
    const uddg = url.searchParams.get('uddg');
    if (uddg) return decodeURIComponent(uddg);
    if (url.hostname.includes('duckduckgo.com')) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function extractTitleFromMarkdown(content: string, fallback: string): string {
  const heading = content.match(/^#\s+(.+)$/m);
  if (heading?.[1]) return heading[1].trim();
  const titleLine = content.match(/^Title:\s*(.+)$/m);
  if (titleLine?.[1]) return titleLine[1].trim();
  return fallback;
}
