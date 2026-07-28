import { TOOLSET_IDS } from '../../../domain/constants/toolsetIdentifiers';
import type { ToolPayload, WebPage } from '../../../domain/types';

const WEB_SEARCH_APIS = new Set(['search', 'web_search']);
const WEB_CRAWL_APIS = new Set(['crawlSinglePage', 'crawlMultiPages']);

function normalizeToolName(toolName: string): string {
  return toolName.trim().toLowerCase().replace(/-/g, '_');
}

export function enrichWebBrowsingPluginState(
  toolName: string,
  pluginState: unknown,
  args?: Record<string, unknown>,
): unknown {
  const normalized = normalizeToolName(toolName);
  if (!pluginState || typeof pluginState !== 'object' || Array.isArray(pluginState)) {
    return pluginState;
  }

  const record = pluginState as Record<string, unknown>;

  if (normalized === 'web_search' || normalized === 'search') {
    const query =
      typeof record.query === 'string'
        ? record.query
        : typeof args?.query === 'string'
          ? args.query
          : typeof args?.q === 'string'
            ? args.q
            : undefined;
    return query ? { ...record, query } : record;
  }

  if (normalized === 'crawl_single_page' || normalized === 'crawl_multi_pages') {
    const pages = Array.isArray(record.pages)
      ? record.pages
      : Array.isArray(record.results)
        ? (record.results as Array<{ url?: string; title?: string }>)
            .filter((item) => item.url)
            .map((item) => ({ url: item.url, title: item.title || item.url }))
        : args?.url
          ? [{ url: String(args.url), title: String(args.title ?? args.url) }]
          : undefined;
    return pages ? { ...record, pages } : record;
  }

  return pluginState;
}

function mapPagesToWebPageItems(
  pages: Array<{ url?: string; title?: string }>,
  prefix: string,
): WebPage[] {
  const now = new Date().toISOString();
  return pages
    .filter((page) => page.url)
    .map((page, index) => ({
      id: `${prefix}-${index + 1}-${page.url}`,
      title: page.title || page.url || '网页',
      url: page.url!,
      updatedAt: now,
    }));
}

export function deriveWebPagesFromTools(tools: ToolPayload[]): WebPage[] {
  const merged = new Map<string, WebPage>();

  for (const tool of tools) {
    if (tool.state !== 'success') continue;
    if (tool.identifier !== TOOLSET_IDS.WEB_BROWSING) continue;

    const apiName = tool.apiName ?? tool.api;
    if (!apiName) continue;

    const pluginState =
      tool.pluginState && typeof tool.pluginState === 'object' && !Array.isArray(tool.pluginState)
        ? (tool.pluginState as Record<string, unknown>)
        : undefined;
    if (!pluginState) continue;

    if (WEB_SEARCH_APIS.has(apiName)) {
      const results = pluginState.results;
      if (Array.isArray(results)) {
        for (const page of mapPagesToWebPageItems(results, 'search')) {
          merged.set(page.url, page);
        }
      }
    }

    if (WEB_CRAWL_APIS.has(apiName)) {
      const pages = Array.isArray(pluginState.pages)
        ? pluginState.pages
        : Array.isArray(pluginState.results)
          ? pluginState.results
          : [];
      if (Array.isArray(pages)) {
        for (const page of mapPagesToWebPageItems(pages, apiName)) {
          merged.set(page.url, page);
        }
      }
    }
  }

  return [...merged.values()];
}
