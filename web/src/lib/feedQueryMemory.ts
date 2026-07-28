const FEED_QUERY_MEMORY_KEY = 'linkloom.web.feedQuery.v1';
export const FEED_QUERY_CHANGED_EVENT = 'linkloom:feed-query';

/** Build `/feed` or `/feed?…` from a query string (with or without leading `?`). */
export function feedHrefFromQuery(qs: string | null | undefined): string {
  const trimmed = (qs || '').replace(/^\?/, '').trim();
  return trimmed ? `/feed?${trimmed}` : '/feed';
}

/** Persist the current feed search string for nav / detail back links. */
export function rememberFeedQuery(qs: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(FEED_QUERY_MEMORY_KEY, qs.replace(/^\?/, ''));
    window.dispatchEvent(new Event(FEED_QUERY_CHANGED_EVENT));
  } catch {
    // private mode / quota — ignore
  }
}

export function loadRememberedFeedQuery(): string {
  if (typeof window === 'undefined') return '';
  try {
    return sessionStorage.getItem(FEED_QUERY_MEMORY_KEY) || '';
  } catch {
    return '';
  }
}

export function rememberedFeedHref(): string {
  return feedHrefFromQuery(loadRememberedFeedQuery());
}
