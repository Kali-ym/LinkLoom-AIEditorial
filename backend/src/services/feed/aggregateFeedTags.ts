export type FeedTagCount = {
  tag: string;
  count: number;
};

type TagSource = {
  metadata?: {
    ai_tags?: unknown;
  } | null;
};

/**
 * Aggregate distinct `metadata.ai_tags` from scored feed items.
 * Keeps first-seen casing; sorts by count desc then zh locale.
 */
export function aggregateFeedTags(
  items: TagSource[],
  opts?: { limit?: number }
): FeedTagCount[] {
  const counts = new Map<string, { tag: string; count: number }>();

  for (const item of items) {
    const tags = item.metadata?.ai_tags;
    if (!Array.isArray(tags)) continue;
    for (const raw of tags) {
      if (typeof raw !== 'string') continue;
      const tag = raw.trim();
      if (!tag) continue;
      const key = tag.toLowerCase();
      const existing = counts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(key, { tag, count: 1 });
      }
    }
  }

  const limit = Math.min(500, Math.max(1, opts?.limit ?? 200));
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'zh-CN'))
    .slice(0, limit);
}
