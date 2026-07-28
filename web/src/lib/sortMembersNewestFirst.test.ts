import { describe, expect, it } from 'vitest';
import type { HotEventMember } from './types';
import { sortMembersNewestFirst } from './sortMembersNewestFirst';

function m(partial: Partial<HotEventMember> & { itemId: string; publishedAt: string }): HotEventMember {
  return {
    permalink: `/items/${partial.itemId}`,
    sourceLabel: 'Src',
    role: 'secondary',
    title: partial.itemId,
    ...partial
  };
}

describe('sortMembersNewestFirst', () => {
  it('orders by publishedAt descending', () => {
    const out = sortMembersNewestFirst([
      m({ itemId: 'a', publishedAt: '2026-07-22T01:00:00.000Z' }),
      m({ itemId: 'b', publishedAt: '2026-07-22T03:00:00.000Z' }),
      m({ itemId: 'c', publishedAt: '2026-07-22T02:00:00.000Z' })
    ]);
    expect(out.map((x) => x.itemId)).toEqual(['b', 'c', 'a']);
  });

  it('sinks invalid dates', () => {
    const out = sortMembersNewestFirst([
      m({ itemId: 'bad', publishedAt: 'not-a-date' }),
      m({ itemId: 'ok', publishedAt: '2026-07-22T01:00:00.000Z' })
    ]);
    expect(out.map((x) => x.itemId)).toEqual(['ok', 'bad']);
  });
});
