import { describe, expect, it } from 'vitest';
import { buildHotEvents, type HotClusterItem } from '../src/services/feed/hotEvents.js';
import { resolveHotEventFilter } from '../src/services/feed/resolveHotEventFilter.js';

function item(partial: Partial<HotClusterItem> & { id: string; title: string }): HotClusterItem {
  return {
    source: 'Source',
    published_date: '2026-07-21T12:00:00.000Z',
    ...partial
  };
}

const NOW = new Date('2026-07-21T12:00:00.000Z');

describe('resolveHotEventFilter', () => {
  it('resolves sig events and member ids', () => {
    const events = buildHotEvents(
      [
        item({
          id: 'a',
          title: 'A',
          metadata: { event_signature: 'qwen-3-8-release', ai_source_type: 'official', ai_score: 9 }
        }),
        item({
          id: 'b',
          title: 'B',
          metadata: { event_signature: 'qwen-3-8-release', ai_source_type: 'media', ai_score: 7 }
        })
      ],
      NOW
    );
    const ev = events[0];
    const resolved = resolveHotEventFilter(events, ev.id);
    expect(resolved).not.toBeNull();
    expect(resolved!.memberIds.has('a')).toBe(true);
    expect(resolved!.memberIds.has('b')).toBe(true);
    expect(resolved!.title.length).toBeGreaterThan(0);
  });

  it('returns null for unknown id', () => {
    expect(resolveHotEventFilter([], 'sig:nope')).toBeNull();
  });
});
