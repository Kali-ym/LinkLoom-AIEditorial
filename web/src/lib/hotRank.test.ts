import { describe, expect, it } from 'vitest';
import {
  formatShanghaiHourLabel,
  heatSeriesFromEvents,
  heatSeriesWindowStart,
  hotRankKind,
  sparklineDelta
} from './hotRank';
import type { HotEvent } from './types';

function ev(partial: Partial<HotEvent> & Pick<HotEvent, 'id' | 'heat' | 'members'>): HotEvent {
  return {
    title: partial.title ?? 't',
    sourceCount: partial.sourceCount ?? partial.members.length,
    ...partial
  };
}

describe('hotRankKind', () => {
  it('maps 1–3 and rest', () => {
    expect(hotRankKind(1)).toBe(1);
    expect(hotRankKind(2)).toBe(2);
    expect(hotRankKind(3)).toBe(3);
    expect(hotRankKind(4)).toBe('rest');
  });
});

describe('heatSeriesFromEvents', () => {
  it('builds 24 rolling-hour buckets and stacks mid-time heat', () => {
    const now = new Date('2026-07-22T12:00:00+08:00');
    const events = [
      ev({
        id: 'a',
        heat: 100,
        members: [
          {
            itemId: '1',
            permalink: '/1',
            sourceLabel: 'A',
            role: 'primary',
            title: 'x',
            // 10:00 CST
            publishedAt: '2026-07-22T02:00:00.000Z'
          },
          {
            itemId: '2',
            permalink: '/2',
            sourceLabel: 'B',
            role: 'secondary',
            title: 'y',
            // 12:00 CST
            publishedAt: '2026-07-22T04:00:00.000Z'
          }
        ]
      })
    ];
    const series = heatSeriesFromEvents(events, now);
    expect(series).toHaveLength(24);
    // mid ≈ 11:00 CST → near the end of the window (now=12:00)
    expect(series[22]!).toBeGreaterThan(series[0]!);
    expect(formatShanghaiHourLabel(heatSeriesWindowStart(now))).toBe('13:00');
    expect(sparklineDelta([10, 20])).toBe(10);
    expect(sparklineDelta([20, 10])).toBe(-10);
  });

  it('ignores events outside the 24h window', () => {
    const now = new Date('2026-07-22T12:00:00+08:00');
    const events = [
      ev({
        id: 'old',
        heat: 999,
        members: [
          {
            itemId: '1',
            permalink: '/1',
            sourceLabel: 'A',
            role: 'primary',
            title: 'x',
            publishedAt: '2026-07-20T04:00:00.000Z'
          }
        ]
      })
    ];
    const series = heatSeriesFromEvents(events, now);
    expect(series.every((v) => v === 0)).toBe(true);
  });
});
