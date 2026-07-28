import { describe, expect, it } from 'vitest';
import {
  hotBoardsNeedLivePeriodFill,
  parseHotSnapshotPayload,
  HOT_SNAPSHOT_SCHEMA_VERSION
} from '../src/services/feed/hotSnapshotPayload.js';
import type { HotEvent } from '../src/types/feed.js';

const sample = (id: string, heat: number): HotEvent => ({
  id,
  title: id,
  heat,
  sourceCount: 1,
  members: []
});

describe('parseHotSnapshotPayload', () => {
  it('treats legacy array payload as realtime-only boards', () => {
    const events = [sample('a', 10)];
    const parsed = parseHotSnapshotPayload(events);
    expect(parsed.boards.realtime).toEqual(events);
    expect(parsed.boards.week).toEqual([]);
    expect(parsed.boards.month).toEqual([]);
    expect(parsed.schemaVersion).toBe(1);
  });

  it('reads multi-board object and schema version', () => {
    const realtime = [sample('r', 9)];
    const week = [sample('w', 8)];
    const month = [sample('m', 7)];
    const parsed = parseHotSnapshotPayload({
      version: HOT_SNAPSHOT_SCHEMA_VERSION,
      boards: { realtime, week, month }
    });
    expect(parsed.boards).toEqual({ realtime, week, month });
    expect(parsed.events).toEqual(realtime);
    expect(parsed.schemaVersion).toBe(HOT_SNAPSHOT_SCHEMA_VERSION);
  });
});

describe('hotBoardsNeedLivePeriodFill', () => {
  it('requires live fill for old schema or empty period boards', () => {
    const boards = {
      realtime: [sample('r', 1)],
      week: [sample('w', 1)],
      month: [sample('m', 1)]
    };
    expect(hotBoardsNeedLivePeriodFill(boards, 2)).toBe(true);
    expect(hotBoardsNeedLivePeriodFill(boards, HOT_SNAPSHOT_SCHEMA_VERSION)).toBe(false);
    expect(
      hotBoardsNeedLivePeriodFill(
        { ...boards, week: [] },
        HOT_SNAPSHOT_SCHEMA_VERSION
      )
    ).toBe(true);
  });
});
