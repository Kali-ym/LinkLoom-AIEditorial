import { describe, expect, it } from 'vitest';
import { buildHotEvents, type HotClusterItem } from '../src/services/feed/hotEvents.js';

function item(partial: Partial<HotClusterItem> & Pick<HotClusterItem, 'id' | 'title'>): HotClusterItem {
  return {
    source: 'src',
    published_date: '2026-07-24T02:00:00.000Z',
    metadata: { ai_score: 80, event_signature: 'sig-a' },
    ...partial
  };
}

describe('buildHotEvents applyDecay + event_id grouping', () => {
  it('skips time decay when applyDecay is false', () => {
    const now = new Date('2026-07-24T10:00:00.000Z');
    const items = [
      item({
        id: '1',
        title: 'old',
        published_date: '2026-07-20T02:00:00.000Z',
        metadata: { ai_score: 80, event_signature: 'sig-old' }
      })
    ];
    const withDecay = buildHotEvents(items, now);
    const noDecay = buildHotEvents(items, now, { applyDecay: false });
    expect(withDecay[0]!.heat).toBeLessThan(80);
    expect(noDecay[0]!.heat).toBe(80);
  });

  it('groups by event_id so multi-source stories outrank high single scores without decay', () => {
    const now = new Date('2026-07-24T12:00:00.000Z');
    const items = [
      item({
        id: 'a',
        title: 'Health A',
        source: 'Verge',
        published_date: '2026-07-21T10:00:00.000Z',
        metadata: { ai_score: 80, event_id: 'evt_health' }
      }),
      item({
        id: 'b',
        title: 'Health B',
        source: 'OpenAI',
        published_date: '2026-07-23T10:00:00.000Z',
        metadata: { ai_score: 60, event_id: 'evt_health' }
      }),
      item({
        id: 'c',
        title: 'Singleton',
        source: 'Blog',
        published_date: '2026-07-23T12:00:00.000Z',
        metadata: { ai_score: 99, event_signature: 'solo-sig' }
      })
    ];
    const noDecay = buildHotEvents(items, now, { applyDecay: false });
    const withDecay = buildHotEvents(items, now, { applyDecay: true });
    expect(noDecay[0]!.id).toBe('evt_health');
    expect(noDecay[0]!.sourceCount).toBe(2);
    expect(noDecay[0]!.heat).toBeGreaterThan(withDecay[0]!.heat);
  });
});
