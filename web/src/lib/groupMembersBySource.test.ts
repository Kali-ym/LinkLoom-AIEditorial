import { describe, expect, it } from 'vitest';
import { groupMembersBySource } from './groupMembersBySource';
import type { HotEventMember } from './types';

function mem(partial: Partial<HotEventMember> & { itemId: string; title: string }): HotEventMember {
  return {
    permalink: `/items/${partial.itemId}`,
    sourceLabel: 'Source',
    role: 'secondary',
    publishedAt: '2026-07-21T12:00:00.000Z',
    ...partial
  };
}

describe('groupMembersBySource', () => {
  it('groups multiple posts from the same host into one source node', () => {
    const groups = groupMembersBySource([
      mem({
        itemId: '1',
        title: 'First',
        sourceLabel: 'OpenAI',
        url: 'https://openai.com/a',
        publishedAt: '2026-07-21T10:00:00.000Z'
      }),
      mem({
        itemId: '2',
        title: 'Second',
        sourceLabel: 'OpenAI Blog',
        url: 'https://www.openai.com/b',
        publishedAt: '2026-07-21T12:00:00.000Z',
        role: 'primary'
      }),
      mem({
        itemId: '3',
        title: 'Other',
        sourceLabel: 'TechCrunch',
        url: 'https://techcrunch.com/x'
      })
    ]);
    expect(groups).toHaveLength(2);
    const openai = groups.find((g) => g.id === 'host:openai.com');
    expect(openai?.members).toHaveLength(2);
    expect(openai?.role).toBe('primary');
    expect(openai?.latest.itemId).toBe('2');
  });

  it('falls back to sourceLabel when url is missing', () => {
    const groups = groupMembersBySource([
      mem({ itemId: 'a', title: 'A', sourceLabel: 'Alpha' }),
      mem({ itemId: 'b', title: 'B', sourceLabel: 'alpha' })
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].members).toHaveLength(2);
  });
});
