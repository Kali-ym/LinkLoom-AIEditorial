export type WebSearchEffectiveMode = 'off' | 'app' | 'provider';
export type GeminiBuiltinSearchMode = 'off' | 'full';
export interface WebSearchPolicy {
  effectiveMode: WebSearchEffectiveMode;
  injectToolIds: string[];
  stripToolIds: string[];
  enableProviderBuiltinSearch: boolean;
  degradedFromProvider: boolean;
}
export const WEB_BROWSING_TOOL_IDS = [
  'web_search',
  'crawl_pages',
  'crawl_single_page',
  'crawl_multi_pages',
  'fetch_data',
] as const;
export const CRAWL_TOOL_IDS = [
  'crawl_pages',
  'crawl_single_page',
  'crawl_multi_pages',
  'fetch_data',
] as const;
