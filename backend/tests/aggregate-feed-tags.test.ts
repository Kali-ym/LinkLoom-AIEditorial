import { describe, expect, it } from 'vitest';
import { aggregateFeedTags } from '../src/services/feed/aggregateFeedTags.js';

describe('aggregateFeedTags', () => {
  it('counts and dedupes case-insensitively while keeping first casing', () => {
    const tags = aggregateFeedTags([
      { metadata: { ai_tags: ['智能体', '产品更新'] } },
      { metadata: { ai_tags: ['智能体', '开源生态'] } },
      { metadata: { ai_tags: ['产品更新'] } }
    ]);
    expect(tags.map((t) => ({ tag: t.tag, count: t.count }))).toEqual([
      { tag: '产品更新', count: 2 },
      { tag: '智能体', count: 2 },
      { tag: '开源生态', count: 1 }
    ]);
  });

  it('ignores empty / non-array tags and respects limit', () => {
    const tags = aggregateFeedTags(
      [
        { metadata: { ai_tags: ['Alpha', '', 12 as unknown as string] } },
        { metadata: null },
        { metadata: {} },
        { metadata: { ai_tags: ['Beta', 'Gamma'] } }
      ],
      { limit: 2 }
    );
    expect(tags).toHaveLength(2);
    expect(tags.every((t) => typeof t.tag === 'string' && t.count === 1)).toBe(true);
  });

  it('returns empty for empty input', () => {
    expect(aggregateFeedTags([])).toEqual([]);
  });
});
