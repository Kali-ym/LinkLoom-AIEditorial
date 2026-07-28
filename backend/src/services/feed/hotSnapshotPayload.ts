import type { HotEvent, HotBoards, HotBoardPeriod } from '../../types/feed.js';

/** Payload schema for multi-board snapshots (realtime + week + month). */
/** v4: week/month filter whole clusters by newest-member time (not item-window cuts). */
export const HOT_SNAPSHOT_SCHEMA_VERSION = 4;

export type { HotBoardPeriod, HotBoards };

export interface ParsedHotSnapshot {
  events: HotEvent[];
  boards: HotBoards;
  schemaVersion: number;
}

export function emptyHotBoards(): HotBoards {
  return { realtime: [], week: [], month: [] };
}

export function buildHotSnapshotPayload(boards: HotBoards): {
  version: number;
  boards: HotBoards;
} {
  return { version: HOT_SNAPSHOT_SCHEMA_VERSION, boards };
}

/** Accept legacy HotEvent[] or `{ version, boards }`. */
export function parseHotSnapshotPayload(raw: unknown): ParsedHotSnapshot {
  if (Array.isArray(raw)) {
    const realtime = raw as HotEvent[];
    return {
      events: realtime,
      boards: { realtime, week: [], month: [] },
      schemaVersion: 1
    };
  }
  if (raw && typeof raw === 'object') {
    const obj = raw as { version?: unknown; boards?: Partial<HotBoards> };
    const boards = obj.boards;
    if (boards && typeof boards === 'object') {
      const realtime = Array.isArray(boards.realtime) ? boards.realtime : [];
      const week = Array.isArray(boards.week) ? boards.week : [];
      const month = Array.isArray(boards.month) ? boards.month : [];
      const schemaVersion =
        typeof obj.version === 'number' && Number.isFinite(obj.version) ? obj.version : 2;
      return {
        events: realtime,
        boards: { realtime, week, month },
        schemaVersion
      };
    }
  }
  return { events: [], boards: emptyHotBoards(), schemaVersion: 0 };
}

export function normalizeHotPeriod(raw: unknown): HotBoardPeriod {
  if (raw === 'week' || raw === 'month' || raw === 'realtime') return raw;
  return 'realtime';
}

/** True when snapshot is missing period boards or predates unified builder. */
export function hotBoardsNeedLivePeriodFill(
  boards: HotBoards,
  schemaVersion: number
): boolean {
  if (schemaVersion < HOT_SNAPSHOT_SCHEMA_VERSION) return true;
  return boards.week.length === 0 || boards.month.length === 0;
}
