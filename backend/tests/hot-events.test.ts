import { describe, expect, it } from 'vitest';
import { buildHotEvents, type HotClusterItem } from '../src/services/feed/hotEvents.js';

function item(partial: Partial<HotClusterItem> & { id: string; title: string }): HotClusterItem {
  return {
    source: 'Source',
    published_date: '2026-07-21T12:00:00.000Z',
    ...partial
  };
}

const NOW = new Date('2026-07-21T12:00:00.000Z');

describe('buildHotEvents', () => {
  it('merges items with the same event_signature', () => {
    const events = buildHotEvents(
      [
        item({
          id: 'a',
          title: 'A official',
          source: 'OpenAI',
          metadata: {
            event_signature: 'openai-gpt5-release',
            ai_source_type: 'official',
            ai_score: 9,
            ai_picked: true,
            ai_recommendation: '重大发布'
          }
        }),
        item({
          id: 'b',
          title: 'B media',
          source: 'TechCrunch',
          metadata: {
            event_signature: 'openai-gpt5-release',
            ai_source_type: 'media',
            ai_score: 7
          }
        })
      ],
      NOW
    );

    expect(events).toHaveLength(1);
    expect(events[0].id).toBe(`sig:${encodeURIComponent('openai-gpt5-release')}`);
    expect(events[0].sourceCount).toBe(2);
    expect(events[0].title).toBe('A official');
    expect(events[0].why).toBe('重大发布');
    expect(events[0].members).toHaveLength(2);
  });

  it('merges unsigned items via ai_related_ids union-find', () => {
    const events = buildHotEvents(
      [
        item({
          id: 'x1',
          title: 'X1',
          source: 'Alpha',
          metadata: { ai_related_ids: ['x2'], ai_score: 8 }
        }),
        item({
          id: 'x2',
          title: 'X2',
          source: 'Beta',
          metadata: { ai_related_ids: ['x1'], ai_score: 6 }
        }),
        item({
          id: 'solo',
          title: 'Solo',
          source: 'Gamma',
          metadata: { ai_score: 9, ai_picked: true }
        })
      ],
      NOW
    );

    const related = events.find((e) => e.id === 'rel:x1');
    expect(related).toBeDefined();
    expect(related!.sourceCount).toBe(2);
    expect(related!.members.map((m) => m.itemId).sort()).toEqual(['x1', 'x2']);

    // With similar scores, multi-source quality×log boost still ranks related first
    expect(events[0].id).toBe('rel:x1');
  });

  it('ranks high-score singleton above weak multi-source by heat', () => {
    const events = buildHotEvents(
      [
        item({
          id: 'weak1',
          title: 'Weak A',
          source: 'S1',
          metadata: { event_signature: 'weak-multi', ai_score: 10 }
        }),
        item({
          id: 'weak2',
          title: 'Weak B',
          source: 'S2',
          metadata: { event_signature: 'weak-multi', ai_score: 25 }
        }),
        item({
          id: 'strong',
          title: 'Strong solo',
          source: 'SoloSrc',
          metadata: { ai_score: 88 }
        })
      ],
      NOW
    );

    expect(events[0].id).toBe('rel:strong');
    expect(events[0].heat).toBeGreaterThan(
      events.find((e) => e.id.startsWith('sig:'))!.heat
    );
  });

  it('maps official/academic to primary role, others secondary', () => {
    const events = buildHotEvents(
      [
        item({
          id: 'o',
          title: 'Official',
          source: 'Org',
          metadata: {
            event_signature: 'sig-role',
            ai_source_type: 'official'
          }
        }),
        item({
          id: 'a',
          title: 'Academic',
          source: 'Uni',
          metadata: {
            event_signature: 'sig-role',
            ai_source_type: 'academic'
          }
        }),
        item({
          id: 'm',
          title: 'Media',
          source: 'News',
          metadata: {
            event_signature: 'sig-role',
            ai_source_type: 'media'
          }
        })
      ],
      NOW
    );

    const byId = Object.fromEntries(events[0].members.map((m) => [m.itemId, m.role]));
    expect(byId.o).toBe('primary');
    expect(byId.a).toBe('primary');
    expect(byId.m).toBe('secondary');
  });

  it('orders by heat descending including high-heat singletons in Top 10', () => {
    const multiFresh = item({
      id: 'm1',
      title: 'Multi A',
      source: 'S1',
      published_date: '2026-07-21T11:00:00.000Z',
      metadata: { event_signature: 'multi-hot', ai_score: 8 }
    });
    const multiFresh2 = item({
      id: 'm2',
      title: 'Multi B',
      source: 'S2',
      published_date: '2026-07-21T11:00:00.000Z',
      metadata: { event_signature: 'multi-hot', ai_score: 7 }
    });
    const oldMulti = item({
      id: 'o1',
      title: 'Old multi',
      source: 'S3',
      published_date: '2026-07-20T00:00:00.000Z',
      metadata: { event_signature: 'old-multi', ai_score: 5 }
    });
    const oldMulti2 = item({
      id: 'o2',
      title: 'Old multi 2',
      source: 'S4',
      published_date: '2026-07-20T00:00:00.000Z',
      metadata: { event_signature: 'old-multi', ai_score: 4 }
    });
    const hotSolo = item({
      id: 'solo1',
      title: 'Hot solo',
      source: 'SoloSrc',
      published_date: '2026-07-21T12:00:00.000Z',
      metadata: { ai_score: 10, ai_picked: true }
    });

    const events = buildHotEvents(
      [multiFresh, multiFresh2, oldMulti, oldMulti2, hotSolo],
      NOW
    );

    expect(events.length).toBeGreaterThanOrEqual(2);
    expect(events[0].heat).toBeGreaterThanOrEqual(events[1].heat);
    expect(events.some((e) => e.sourceCount >= 2)).toBe(true);
    expect(events.some((e) => e.id === 'rel:solo1')).toBe(true);
  });

  it('dedupes tags and caps at 8', () => {
    const events = buildHotEvents(
      [
        item({
          id: 't1',
          title: 'T1',
          source: 'A',
          metadata: {
            event_signature: 'tag-event',
            ai_tags: ['a', 'b', 'c', 'd', 'e']
          }
        }),
        item({
          id: 't2',
          title: 'T2',
          source: 'B',
          metadata: {
            event_signature: 'tag-event',
            ai_tags: ['c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']
          }
        })
      ],
      NOW
    );

    expect(events[0].tags).toBeDefined();
    expect(events[0].tags!.length).toBeLessThanOrEqual(8);
    expect(new Set(events[0].tags!).size).toBe(events[0].tags!.length);
  });
});

describe('event title and member summary from AI fields', () => {
  it('uses ai_summary_short for HotEvent.title when present', () => {
    const events = buildHotEvents(
      [
        item({
          id: 'a',
          title: 'RT Ash Lewis: raw english dump',
          source: 'X',
          metadata: {
            event_signature: 'title-short',
            ai_score: 9,
            ai_picked: true,
            ai_summary_short: 'OpenAI 发布 GPT-5',
            ai_summary: 'OpenAI 今日正式发布 GPT-5，性能与安全能力同步升级。'
          }
        })
      ],
      NOW
    );

    expect(events).toHaveLength(1);
    expect(events[0].title).toBe('OpenAI 发布 GPT-5');
    expect(events[0].members[0].title).toBe('RT Ash Lewis: raw english dump');
    expect(events[0].members[0].summary).toBe(
      'OpenAI 今日正式发布 GPT-5，性能与安全能力同步升级。'
    );
  });

  it('truncates ai_summary to 40 code points when short summary missing', () => {
    const long =
      '一二三四五六七八九十一二三四五六七八九十一二三四五六七八九十一二三四五六七八九十多余';
    const events = buildHotEvents(
      [
        item({
          id: 'b',
          title: 'Raw title only',
          source: 'News',
          metadata: {
            event_signature: 'title-trunc',
            ai_score: 8,
            ai_summary: long
          }
        })
      ],
      NOW
    );

    expect([...events[0].title].length).toBe(41); // 40 + …
    expect(events[0].title.endsWith('…')).toBe(true);
    expect([...events[0].title.slice(0, -1)].length).toBe(40);
    expect(events[0].members[0].summary).toBe(long);
  });

  it('falls back to raw title when no AI summaries', () => {
    const events = buildHotEvents(
      [
        item({
          id: 'c',
          title: 'Plain headline',
          source: 'Wire',
          metadata: { event_signature: 'title-raw', ai_score: 5 }
        })
      ],
      NOW
    );

    expect(events[0].title).toBe('Plain headline');
    expect(events[0].members[0].summary).toBeUndefined();
  });

  it('prefers full ai_summary over ai_summary_short for member.summary', () => {
    const events = buildHotEvents(
      [
        item({
          id: 'd',
          title: 'Headline',
          source: 'Desk',
          metadata: {
            event_signature: 'member-sum',
            ai_summary_short: '短摘要',
            ai_summary: '这是完整长摘要，应出现在成员卡上。'
          }
        })
      ],
      NOW
    );

    expect(events[0].members[0].summary).toBe('这是完整长摘要，应出现在成员卡上。');
  });

  it('trims whitespace-only ai_summary_short and continues fallback', () => {
    const events = buildHotEvents(
      [
        item({
          id: 'e',
          title: 'Keep me',
          source: 'Desk',
          metadata: {
            event_signature: 'title-trim',
            ai_summary_short: '   ',
            ai_summary: '短事件句够不够四十码点'
          }
        })
      ],
      NOW
    );

    expect(events[0].title).toBe('短事件句够不够四十码点');
  });

  it('passes metadata.source_image through to members', () => {
    const events = buildHotEvents(
      [
        item({
          id: 'avatar-1',
          title: 'Tweet',
          url: 'https://x.com/sama/status/1',
          source: 'Twitter @Sam Altman',
          metadata: {
            event_signature: 'avatar-sig',
            source_image: 'https://pbs.twimg.com/profile_images/x.jpg',
            ai_score: 8
          }
        })
      ],
      NOW
    );

    expect(events[0].members[0].sourceImage).toBe('https://pbs.twimg.com/profile_images/x.jpg');
  });
});
