import { describe, expect, it } from 'vitest';
import { groupFeedItemsByShanghaiDate } from './groupFeedByDate';

describe('groupFeedItemsByShanghaiDate', () => {
  it('groups by Shanghai calendar day and keeps order', () => {
    const items = [
      { id: 'a', publishedAt: '2026-07-22T07:00:00.000Z' }, // 15:00 CST
      { id: 'b', publishedAt: '2026-07-22T06:52:00.000Z' },
      { id: 'c', publishedAt: '2026-07-21T06:00:00.000Z' }
    ];
    const groups = groupFeedItemsByShanghaiDate(items);
    expect(groups.map((g) => g.dateKey)).toEqual(['2026-07-22', '2026-07-21']);
    expect(groups[0].items.map((i) => i.id)).toEqual(['a', 'b']);
    expect(groups[1].items.map((i) => i.id)).toEqual(['c']);
  });

  it('dedupes by id keeping first occurrence', () => {
    const items = [
      { id: 'a', publishedAt: '2026-07-22T07:00:00.000Z' },
      { id: 'a', publishedAt: '2026-07-21T07:00:00.000Z' }
    ];
    const groups = groupFeedItemsByShanghaiDate(items);
    expect(groups).toHaveLength(1);
    expect(groups[0].items).toHaveLength(1);
  });

  it('returns empty array for empty input', () => {
    expect(groupFeedItemsByShanghaiDate([])).toEqual([]);
  });
});
