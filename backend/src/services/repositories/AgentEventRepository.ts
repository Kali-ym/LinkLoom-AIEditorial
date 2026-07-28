import type { AgentEvent } from '../agents/engine/AgentEvent.js';
import { BaseRepository } from './BaseRepository.js';

/**
 * Append-only persistence for {@link AgentEvent}s.
 *
 * One row per event keyed by `(run_id, seq)`. `appendEvent` is an O(1) single-row
 * INSERT — it never rewrites historical rows — replacing the old "serialize the whole
 * session and PUT 4 KV keys on every event" write-amplification path.
 */
export class AgentEventRepository extends BaseRepository {
  /**
   * Insert a single event with its current sequence. Idempotent on every unique key,
   * so replays / double-publishes do not duplicate rows or throw on duplicate event ids.
   * @returns true when a new row was written.
   */
  async appendEvent(event: AgentEvent): Promise<boolean> {
    const seq = typeof event.sequence === 'number' && Number.isFinite(event.sequence)
      ? event.sequence
      : (await this.nextSequence(event.runId));
    return this.insertEvent({ ...event, sequence: seq });
  }

  /**
   * Runtime append path. It preserves idempotency by event id, and when another process
   * wins the same `(run_id, seq)` first, it retries with the next table-backed sequence.
   */
  async appendEventAllocatingSequence(event: AgentEvent): Promise<AgentEvent> {
    return (await this.appendEventAllocatingSequenceWithResult(event)).event;
  }

  async appendEventAllocatingSequenceWithResult(event: AgentEvent): Promise<{ event: AgentEvent; inserted: boolean }> {
    const existing = await this.getByEventId(event.runId, event.id);
    if (existing) return { event: existing, inserted: false };

    let seq = typeof event.sequence === 'number' && Number.isFinite(event.sequence)
      ? event.sequence
      : await this.nextSequence(event.runId);

    for (let attempt = 0; attempt < 8; attempt++) {
      const candidate = { ...event, sequence: seq } as AgentEvent;
      if (await this.insertEvent(candidate)) return { event: candidate, inserted: true };

      const replayed = await this.getByEventId(event.runId, event.id);
      if (replayed) return { event: replayed, inserted: false };

      const maxSeq = await this.maxSequence(event.runId);
      seq = Math.max(maxSeq + 1, seq + 1);
    }

    throw new Error(`Failed to allocate sequence for agent event ${event.id} in run ${event.runId}`);
  }

  private async insertEvent(event: AgentEvent): Promise<boolean> {
    const seq = typeof event.sequence === 'number' && Number.isFinite(event.sequence)
      ? event.sequence
      : await this.nextSequence(event.runId);
    const storedEvent = { ...event, sequence: seq } as AgentEvent;
    const result = await this.db.run(
      `INSERT INTO agent_events (run_id, seq, event_id, session_id, type, payload, timestamp, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT DO NOTHING`,
      storedEvent.runId,
      seq,
      storedEvent.id,
      storedEvent.sessionId ?? null,
      storedEvent.type,
      JSON.stringify(storedEvent),
      storedEvent.timestamp ?? null,
      Date.now()
    );
    return result.changes > 0;
  }

  async getByEventId(runId: string, eventId: string): Promise<AgentEvent | null> {
    const row = await this.db.get<{ payload: unknown }>(
      'SELECT payload FROM agent_events WHERE run_id = ? AND event_id = ?',
      runId,
      eventId
    );
    return row ? this.parseJson<AgentEvent>(row.payload as any, null as any) : null;
  }

  /**
   * Replay events for a run in ascending sequence order. Optionally start strictly
   * after `afterSeq` for SSE last-seq resume (phase 3).
   */
  async listByRun(runId: string, afterSeq?: number, limit?: number): Promise<AgentEvent[]> {
    const params: any[] = [runId];
    let sql = 'SELECT payload FROM agent_events WHERE run_id = ?';
    if (typeof afterSeq === 'number' && Number.isFinite(afterSeq)) {
      sql += ' AND seq > ?';
      params.push(afterSeq);
    }
    sql += ' ORDER BY seq ASC';
    if (typeof limit === 'number' && Number.isFinite(limit) && limit > 0) {
      sql += ' LIMIT ?';
      params.push(Math.floor(limit));
    }
    const rows = await this.db.all<{ payload: unknown }>(sql, ...params);
    return rows.map((row) => this.parseJson<AgentEvent>(row.payload as any, {} as AgentEvent));
  }

  /** Highest persisted sequence for a run, or 0 when no events exist. */
  async maxSequence(runId: string): Promise<number> {
    const row = await this.db.get<{ max_seq: number | null }>(
      'SELECT MAX(seq) AS max_seq FROM agent_events WHERE run_id = ?',
      runId
    );
    const value = row?.max_seq;
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }

  /** Next sequence to assign for a run (MAX(seq) + 1). */
  async nextSequence(runId: string): Promise<number> {
    return (await this.maxSequence(runId)) + 1;
  }

  /** Number of persisted events for a run. */
  async countByRun(runId: string): Promise<number> {
    const row = await this.db.get<{ count: number }>(
      'SELECT COUNT(*) AS count FROM agent_events WHERE run_id = ?',
      runId
    );
    return Number(row?.count ?? 0);
  }

  async deleteByRun(runId: string): Promise<void> {
    await this.db.run('DELETE FROM agent_events WHERE run_id = ?', runId);
  }
}
