import { describe, expect, it } from 'vitest';
import {
  buildHotBoardByClusterNewest,
  buildHotBoards,
  type HotClusterItem
} from '../src/services/feed/hotEvents.js';
import { startOfShanghaiCalendarMonth, startOfShanghaiCalendarWeek } from '../src/utils/shanghaiDate.js';

function item(partial: Partial<HotClusterItem> & Pick<HotClusterItem, 'id' | 'title'>): HotClusterItem {
  return {
    source: 'src',
    published_date: '2026-07-24T02:00:00.000Z',
    metadata: { ai_score: 80 },
    ...partial
  };
}

describe('buildHotBoardByClusterNewest', () => {
  it('keeps full cluster members when newest falls in the period', () => {
    const now = new Date('2026-08-02T12:00:00.000Z');
    const monthStart = startOfShanghaiCalendarMonth(now);
    const events = buildHotBoardByClusterNewest(
      [
        item({
          id: 'old',
          title: 'July member',
          source: 'A',
          published_date: '2026-07-31T10:00:00.000Z',
          metadata: { ai_score: 70, event_id: 'evt_cross' }
        }),
        item({
          id: 'new',
          title: 'August tip',
          source: 'B',
          published_date: '2026-08-01T08:00:00.000Z',
          metadata: { ai_score: 80, event_id: 'evt_cross' }
        })
      ],
      { periodStart: monthStart, periodEnd: now, now, applyDecay: false }
    );

    expect(events).toHaveLength(1);
    expect(events[0]!.id).toBe('evt_cross');
    expect(events[0]!.sourceCount).toBe(2);
    expect(events[0]!.members.map((m) => m.itemId).sort()).toEqual(['new', 'old']);
  });

  it('drops clusters whose newest tip is before the period', () => {
    const now = new Date('2026-08-02T12:00:00.000Z');
    const monthStart = startOfShanghaiCalendarMonth(now);
    const events = buildHotBoardByClusterNewest(
      [
        item({
          id: 'july-only',
          title: 'Stale',
          source: 'A',
          published_date: '2026-07-20T10:00:00.000Z',
          metadata: { ai_score: 90, event_id: 'evt_july' }
        })
      ],
      { periodStart: monthStart, periodEnd: now, now, applyDecay: false }
    );
    expect(events).toHaveLength(0);
  });

  it('ignores unsigned items on period boards', () => {
    const now = new Date('2026-07-25T12:00:00.000Z');
    const weekStart = startOfShanghaiCalendarWeek(now);
    const events = buildHotBoardByClusterNewest(
      [
        item({
          id: 'solo',
          title: 'No event id',
          published_date: '2026-07-24T10:00:00.000Z',
          metadata: { ai_score: 99, event_signature: 'solo' }
        })
      ],
      { periodStart: weekStart, periodEnd: now, now, applyDecay: false }
    );
    expect(events).toHaveLength(0);
  });
});

describe('buildHotBoards period filter wiring', () => {
  it('uses newest-time filter for week/month while realtime still groups in-pool', () => {
    const now = new Date('2026-08-02T12:00:00.000Z');
    const weekStart = startOfShanghaiCalendarWeek(now);
    const monthStart = startOfShanghaiCalendarMonth(now);
    const boards = buildHotBoards(
      {
        realtime: [
          item({
            id: 'r1',
            title: 'Realtime',
            published_date: '2026-08-02T10:00:00.000Z',
            metadata: { ai_score: 80, event_id: 'evt_r' }
          })
        ],
        week: [
          item({
            id: 'w-old',
            title: 'Earlier week member',
            source: 'A',
            published_date: '2026-07-28T10:00:00.000Z',
            metadata: { ai_score: 70, event_id: 'evt_w' }
          }),
          item({
            id: 'w-new',
            title: 'Week tip',
            source: 'B',
            published_date: '2026-08-01T10:00:00.000Z',
            metadata: { ai_score: 75, event_id: 'evt_w' }
          })
        ],
        month: [
          item({
            id: 'm-old',
            title: 'July',
            source: 'A',
            published_date: '2026-07-31T10:00:00.000Z',
            metadata: { ai_score: 70, event_id: 'evt_m' }
          }),
          item({
            id: 'm-new',
            title: 'August',
            source: 'B',
            published_date: '2026-08-01T10:00:00.000Z',
            metadata: { ai_score: 75, event_id: 'evt_m' }
          })
        ]
      },
      now,
      { weekStart, monthStart }
    );

    expect(boards.realtime[0]?.id).toBe('evt_r');
    expect(boards.week[0]?.members).toHaveLength(2);
    expect(boards.month[0]?.members).toHaveLength(2);
    expect(boards.month[0]?.sourceCount).toBe(2);
  });
});
