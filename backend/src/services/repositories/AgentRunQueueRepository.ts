import { BaseRepository } from './BaseRepository.js';

export type AgentRunQueueStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface AgentRunQueueRow {
  runId: string;
  sessionId?: string;
  kind: string;
  status: AgentRunQueueStatus;
  priority: number;
  attempts: number;
  maxAttempts: number;
  availableAt: number;
  leaseOwner?: string;
  lockedAt?: number;
  lastError?: string;
  payload?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface EnqueueAgentRunInput {
  runId: string;
  sessionId?: string;
  kind?: string;
  priority?: number;
  maxAttempts?: number;
  payload?: Record<string, unknown>;
}

/**
 * Durable run queue backed by `agent_run_queue`. Coordination follows the exact same
 * PostgreSQL `FOR UPDATE SKIP LOCKED` claim + stale-lease reset + attempts/backoff
 * pattern as `rag_embedding_jobs`, so multiple processes can share one queue without
 * Redis and queued/running work survives a restart.
 */
export class AgentRunQueueRepository extends BaseRepository {
  /**
   * Enqueue (or re-enqueue) a run as pending. Idempotent on fresh inserts; on
   * conflict revives the row only when it is in a terminal state
   * (`failed` / `cancelled`) — re-enqueuing a `pending` or `running` row is a
   * no-op so a second `acquire` cannot clobber a lease another worker already
   * holds on the same runId.
   *
   * The original `ON CONFLICT DO NOTHING` left failed/cancelled rows stuck: a
   * second `enqueue` with the same `run_id` was a no-op, so `claimRun` then
   * returned null and the manager raised `Agent run queue claim rejected:
   * <runId>`, leaving that runId permanently unusable. Reviving terminal rows
   * on re-enqueue is the signal that a fresh run is starting.
   */
  async enqueue(input: EnqueueAgentRunInput): Promise<void> {
    const now = Date.now();
    await this.db.run(
      `INSERT INTO agent_run_queue
        (run_id, session_id, kind, status, priority, attempts, max_attempts, available_at, payload, created_at, updated_at)
       VALUES (?, ?, ?, 'pending', ?, 0, ?, ?, ?, ?, ?)
       ON CONFLICT (run_id) DO UPDATE SET
         session_id = excluded.session_id,
         kind = excluded.kind,
         status = 'pending',
         priority = excluded.priority,
         attempts = 0,
         max_attempts = excluded.max_attempts,
         available_at = excluded.available_at,
         payload = excluded.payload,
         lease_owner = NULL,
         locked_at = NULL,
         last_error = NULL,
         updated_at = excluded.updated_at
       WHERE agent_run_queue.status IN ('failed', 'cancelled')`,
      input.runId,
      input.sessionId ?? null,
      input.kind ?? 'run',
      Math.floor(input.priority ?? 0),
      Math.max(1, Math.floor(input.maxAttempts ?? 1)),
      now,
      input.payload ? JSON.stringify(input.payload) : null,
      now,
      now
    );
  }

  /**
   * Atomically claim up to `limit` runnable jobs for `owner`, marking them running and
   * stamping a lease. Skips jobs already locked by other workers.
   */
  async claim(owner: string, limit: number): Promise<AgentRunQueueRow[]> {
    const now = Date.now();
    const rows = await this.db.all(
      `WITH picked AS (
        SELECT run_id
        FROM agent_run_queue
        WHERE status = 'pending'
          AND attempts < max_attempts
          AND available_at <= ?
        ORDER BY priority DESC, available_at ASC, updated_at ASC
        LIMIT ?
        FOR UPDATE SKIP LOCKED
      )
      UPDATE agent_run_queue q
      SET status = 'running',
          attempts = q.attempts + 1,
          lease_owner = ?,
          locked_at = ?,
          updated_at = ?
      FROM picked
      WHERE q.run_id = picked.run_id
      RETURNING q.*`,
      now,
      Math.max(1, Math.floor(limit)),
      owner,
      now,
      now
    );
    return rows.map((row: any) => this.mapRow(row));
  }

  /**
   * Atomically claim a single named run for `owner`, marking it running and stamping a
   * lease. Used by the inline queue manager, which already knows the run it executes.
   * Returns the claimed row, or null when the run is missing / already claimed elsewhere.
   */
  async claimRun(runId: string, owner: string): Promise<AgentRunQueueRow | null> {
    const now = Date.now();
    const rows = await this.db.all(
      `WITH picked AS (
        SELECT run_id
        FROM agent_run_queue
        WHERE run_id = ?
          AND status = 'pending'
          AND attempts < max_attempts
          AND available_at <= ?
        FOR UPDATE SKIP LOCKED
      )
      UPDATE agent_run_queue q
      SET status = 'running',
          attempts = q.attempts + 1,
          lease_owner = ?,
          locked_at = ?,
          updated_at = ?
      FROM picked
      WHERE q.run_id = picked.run_id
      RETURNING q.*`,
      runId,
      now,
      owner,
      now,
      now
    );
    return rows.length ? this.mapRow(rows[0]) : null;
  }

  /** Renew a running lease so a stale-reset sweep does not reclaim it. */
  async heartbeat(runId: string, owner: string): Promise<boolean> {
    const result = await this.db.run(
      `UPDATE agent_run_queue
       SET locked_at = ?, updated_at = ?
       WHERE run_id = ? AND status = 'running' AND lease_owner = ?`,
      Date.now(),
      Date.now(),
      runId,
      owner
    );
    return result.changes > 0;
  }

  async complete(runId: string): Promise<void> {
    await this.db.run(
      `UPDATE agent_run_queue
       SET status = 'succeeded', lease_owner = NULL, locked_at = NULL, last_error = NULL, updated_at = ?
       WHERE run_id = ?`,
      Date.now(),
      runId
    );
  }

  /** Put a paused run back on the queue so resume can reclaim it. */
  async requeueForResume(runId: string): Promise<void> {
    await this.db.run(
      `UPDATE agent_run_queue
       SET status = 'pending',
           lease_owner = NULL,
           locked_at = NULL,
           last_error = NULL,
           attempts = GREATEST(attempts - 1, 0),
           updated_at = ?
       WHERE run_id = ?`,
      Date.now(),
      runId
    );
  }

  /**
   * Mark a claimed job failed. Re-queues for retry with linear backoff while attempts
   * remain; otherwise terminally fails. Mirrors `failEmbeddingJob`.
   */
  async fail(runId: string, error: string, backoffMs = 5_000): Promise<AgentRunQueueStatus> {
    const row = await this.db.get<{ attempts: number; max_attempts: number }>(
      'SELECT attempts, max_attempts FROM agent_run_queue WHERE run_id = ?',
      runId
    );
    const attempts = Number(row?.attempts ?? 0);
    const maxAttempts = Number(row?.max_attempts ?? 1);
    const willRetry = attempts < maxAttempts;
    const status: AgentRunQueueStatus = willRetry ? 'pending' : 'failed';
    const now = Date.now();
    const availableAt = willRetry ? now + Math.max(0, backoffMs) * Math.max(1, attempts) : now;
    await this.db.run(
      `UPDATE agent_run_queue
       SET status = ?, last_error = ?, lease_owner = NULL, locked_at = NULL, available_at = ?, updated_at = ?
       WHERE run_id = ?`,
      status,
      error,
      availableAt,
      now,
      runId
    );
    return status;
  }

  /** Mark a job cancelled regardless of its current state. */
  async cancel(runId: string): Promise<boolean> {
    const result = await this.db.run(
      `UPDATE agent_run_queue
       SET status = 'cancelled', lease_owner = NULL, locked_at = NULL, updated_at = ?
       WHERE run_id = ? AND status IN ('pending', 'running')`,
      Date.now(),
      runId
    );
    return result.changes > 0;
  }

  /**
   * Re-queue running jobs whose lease has gone stale (worker crash / restart). Returns
   * the number of reclaimed jobs. Direct analog of `resetStaleJobs`.
   */
  async resetStaleLeases(staleMs: number): Promise<number> {
    const before = Date.now() - Math.max(1, staleMs);
    const result = await this.db.run(
      `UPDATE agent_run_queue
       SET status = 'pending', lease_owner = NULL, locked_at = NULL, attempts = GREATEST(attempts - 1, 0), updated_at = ?
       WHERE status = 'running' AND locked_at IS NOT NULL AND locked_at < ?`,
      Date.now(),
      before
    );
    return result.changes;
  }

  async get(runId: string): Promise<AgentRunQueueRow | null> {
    const row = await this.db.get('SELECT * FROM agent_run_queue WHERE run_id = ?', runId);
    return row ? this.mapRow(row) : null;
  }

  async countByStatus(status: AgentRunQueueStatus): Promise<number> {
    const row = await this.db.get<{ count: number }>(
      'SELECT COUNT(*) AS count FROM agent_run_queue WHERE status = ?',
      status
    );
    return Number(row?.count ?? 0);
  }

  async listByStatus(status: AgentRunQueueStatus, limit = 100): Promise<AgentRunQueueRow[]> {
    const rows = await this.db.all(
      'SELECT * FROM agent_run_queue WHERE status = ? ORDER BY updated_at DESC LIMIT ?',
      status,
      Math.max(1, Math.min(500, limit))
    );
    return rows.map((row: any) => this.mapRow(row));
  }

  private mapRow(row: any): AgentRunQueueRow {
    return {
      runId: row.run_id,
      sessionId: row.session_id ?? undefined,
      kind: row.kind,
      status: row.status,
      priority: Number(row.priority ?? 0),
      attempts: Number(row.attempts ?? 0),
      maxAttempts: Number(row.max_attempts ?? 1),
      availableAt: Number(row.available_at ?? 0),
      leaseOwner: row.lease_owner ?? undefined,
      lockedAt: row.locked_at != null ? Number(row.locked_at) : undefined,
      lastError: row.last_error ?? undefined,
      payload: this.parseJson<Record<string, unknown> | undefined>(row.payload, undefined),
      createdAt: Number(row.created_at ?? 0),
      updatedAt: Number(row.updated_at ?? 0)
    };
  }
}
