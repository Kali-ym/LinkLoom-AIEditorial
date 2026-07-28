import type { HotEventMember } from './types';

/** Newest publishedAt first; invalid dates sink to the bottom. */
export function sortMembersNewestFirst(members: HotEventMember[]): HotEventMember[] {
  return [...members].sort((a, b) => {
    const ta = Date.parse(a.publishedAt);
    const tb = Date.parse(b.publishedAt);
    const aOk = Number.isFinite(ta);
    const bOk = Number.isFinite(tb);
    if (!aOk && !bOk) return 0;
    if (!aOk) return 1;
    if (!bOk) return -1;
    return tb - ta;
  });
}
