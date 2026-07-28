/** Shared HTML escaping — ported from index.html IIFE `escapeHtml`. */
export function escapeHtml(str: string | null | undefined): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** @deprecated use getHostFromUrl from utils/url */
export { getHostFromUrl } from '../../utils/url';
