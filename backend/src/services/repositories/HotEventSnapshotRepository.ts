import type { HotEvent, HotBoards } from '../../types/feed.js';
import {
  buildHotSnapshotPayload,
  parseHotSnapshotPayload,
  type ParsedHotSnapshot
} from '../feed/hotSnapshotPayload.js';
import { BaseRepository } from './BaseRepository.js';

export class HotEventSnapshotRepository extends BaseRepository {
  async save(input: {
    generatedAt: Date;
    boards: HotBoards;
    /** Optional alias — if boards omitted, treated as realtime-only. */
    events?: HotEvent[];
    meta?: Record<string, unknown>;
  }): Promise<void> {
    const boards: HotBoards =
      input.boards ??
      ({
        realtime: input.events ?? [],
        week: [],
        month: []
      } satisfies HotBoards);
    await this.db.run(
      `INSERT INTO hot_event_snapshot (generated_at, payload, meta) VALUES (?, ?, ?)`,
      input.generatedAt.toISOString(),
      JSON.stringify(buildHotSnapshotPayload(boards)),
      input.meta ? JSON.stringify(input.meta) : null
    );
  }

  async loadLatest(): Promise<(ParsedHotSnapshot & { generatedAt: string }) | null> {
    const row = await this.db.get<{
      generated_at: string | Date;
      payload: unknown;
    }>(
      `SELECT generated_at, payload FROM hot_event_snapshot ORDER BY generated_at DESC LIMIT 1`
    );
    if (!row) return null;
    const raw =
      typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
    const parsed = parseHotSnapshotPayload(raw);
    const generatedAt =
      row.generated_at instanceof Date
        ? row.generated_at.toISOString()
        : String(row.generated_at);
    return { generatedAt, ...parsed };
  }
}
