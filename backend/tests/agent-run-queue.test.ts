import { describe, expect, it, vi } from 'vitest';
import { AgentRunQueueRepository } from '../src/services/repositories/AgentRunQueueRepository.js';
import { AgentRunQueueManager } from '../src/services/agents/managers/AgentRunQueueManager.js';
import type { AgentRunSpec } from '../src/services/agents/engine/AgentRunSpec.js';

/**
 * In-memory fake of {@link PgConnection} covering the agent_run_queue SQL. Models the
 * SKIP LOCKED claim + stale-lease reset + attempts/backoff semantics with plain JS rows.
 */
class FakeQueueConnection {
  rows = new Map<string, any>();

  private norm(sql: string): string {
    return sql.replace(/\s+/g, ' ').trim();
  }

  async run(sql: string, ...params: any[]): Promise<{ lastID: number; changes: number }> {
    const s = this.norm(sql);

    if (s.startsWith('INSERT INTO agent_run_queue')) {
      const [run_id, session_id, kind, priority, max_attempts, available_at, payload, created_at, updated_at] = params;
      // Mirror the production ON CONFLICT (run_id) DO UPDATE ... WHERE status
      // IN ('failed', 'cancelled'): revive terminal rows to fresh pending, but
      // leave pending/running rows untouched so a second enqueue cannot clobber
      // a lease another worker already holds.
      if (this.rows.has(run_id)) {
        const existing = this.rows.get(run_id);
        if (existing.status === 'failed' || existing.status === 'cancelled') {
          this.rows.set(run_id, {
            ...existing,
            run_id,
            session_id,
            kind,
            status: 'pending',
            priority,
            attempts: 0,
            max_attempts,
            available_at,
            payload,
            lease_owner: null,
            locked_at: null,
            last_error: null,
            updated_at
          });
          return { lastID: 0, changes: 1 };
        }
        return { lastID: 0, changes: 0 };
      }
      this.rows.set(run_id, {
        run_id,
        session_id,
        kind,
        status: 'pending',
        priority,
        attempts: 0,
        max_attempts,
        available_at,
        lease_owner: null,
        locked_at: null,
        last_error: null,
        payload,
        created_at,
        updated_at
      });
      return { lastID: 0, changes: 1 };
    }

    if (s.startsWith("UPDATE agent_run_queue SET locked_at")) {
      // heartbeat
      const [, , run_id, owner] = params;
      const row = this.rows.get(run_id);
      if (row && row.status === 'running' && row.lease_owner === owner) {
        row.locked_at = params[0];
        row.updated_at = params[1];
        return { lastID: 0, changes: 1 };
      }
      return { lastID: 0, changes: 0 };
    }

    if (s.startsWith("UPDATE agent_run_queue SET status = 'succeeded'")) {
      const row = this.rows.get(params[1]);
      if (row) Object.assign(row, { status: 'succeeded', lease_owner: null, locked_at: null, last_error: null, updated_at: params[0] });
      return { lastID: 0, changes: row ? 1 : 0 };
    }

    if (s.startsWith('UPDATE agent_run_queue SET status = ?, last_error')) {
      const [status, error, available_at, updated_at, run_id] = params;
      const row = this.rows.get(run_id);
      if (row) Object.assign(row, { status, last_error: error, lease_owner: null, locked_at: null, available_at, updated_at });
      return { lastID: 0, changes: row ? 1 : 0 };
    }

    if (s.startsWith("UPDATE agent_run_queue SET status = 'cancelled'")) {
      const row = this.rows.get(params[1]);
      if (row && (row.status === 'pending' || row.status === 'running')) {
        Object.assign(row, { status: 'cancelled', lease_owner: null, locked_at: null, updated_at: params[0] });
        return { lastID: 0, changes: 1 };
      }
      return { lastID: 0, changes: 0 };
    }

    if (s.startsWith("UPDATE agent_run_queue SET status = 'pending', lease_owner = NULL, locked_at = NULL, last_error = NULL, attempts = GREATEST(attempts - 1, 0)")) {
      const [updated_at, run_id] = params;
      const row = this.rows.get(run_id);
      if (row) {
        Object.assign(row, {
          status: 'pending',
          lease_owner: null,
          locked_at: null,
          last_error: null,
          attempts: Math.max(row.attempts - 1, 0),
          updated_at
        });
        return { lastID: 0, changes: 1 };
      }
      return { lastID: 0, changes: 0 };
    }

    if (s.startsWith("UPDATE agent_run_queue SET status = 'pending', lease_owner = NULL, locked_at = NULL, last_error = NULL, updated_at")) {
      const [updated_at, run_id] = params;
      const row = this.rows.get(run_id);
      if (row) {
        Object.assign(row, { status: 'pending', lease_owner: null, locked_at: null, last_error: null, updated_at });
        return { lastID: 0, changes: 1 };
      }
      return { lastID: 0, changes: 0 };
    }

    if (s.startsWith("UPDATE agent_run_queue SET status = 'pending', lease_owner = NULL, locked_at = NULL")) {
      // resetStaleLeases
      const [updated_at, before] = params;
      let changes = 0;
      for (const row of this.rows.values()) {
        if (row.status === 'running' && row.locked_at != null && row.locked_at < before) {
          Object.assign(row, { status: 'pending', lease_owner: null, locked_at: null, attempts: Math.max(row.attempts - 1, 0), updated_at });
          changes++;
        }
      }
      return { lastID: 0, changes };
    }

    throw new Error(`FakeQueueConnection.run: unhandled SQL: ${s}`);
  }

  async get<T = any>(sql: string, ...params: any[]): Promise<T | undefined> {
    const s = this.norm(sql);
    if (s.startsWith('SELECT attempts, max_attempts FROM agent_run_queue')) {
      const row = this.rows.get(params[0]);
      return row ? ({ attempts: row.attempts, max_attempts: row.max_attempts } as T) : undefined;
    }
    if (s.startsWith('SELECT COUNT(*) AS count FROM agent_run_queue')) {
      const count = [...this.rows.values()].filter((r) => r.status === params[0]).length;
      return { count } as T;
    }
    if (s.startsWith('SELECT * FROM agent_run_queue WHERE run_id')) {
      return this.rows.get(params[0]) as T;
    }
    throw new Error(`FakeQueueConnection.get: unhandled SQL: ${s}`);
  }

  async all<T = any>(sql: string, ...params: any[]): Promise<T[]> {
    const s = this.norm(sql);

    // claim(owner, limit): generic SKIP LOCKED batch claim
    if (s.includes("WHERE status = 'pending'") && s.includes('AND attempts < max_attempts') && s.includes("SET status = 'running'")) {
      const [now, limit, owner] = params;
      const eligible = [...this.rows.values()]
        .filter((r) => r.status === 'pending' && r.attempts < r.max_attempts && r.available_at <= now)
        .sort((a, b) => b.priority - a.priority || a.available_at - b.available_at || a.updated_at - b.updated_at)
        .slice(0, limit);
      for (const row of eligible) {
        Object.assign(row, { status: 'running', attempts: row.attempts + 1, lease_owner: owner, locked_at: params[3], updated_at: params[4] });
      }
      return eligible as T[];
    }

    // claimRun(runId, owner): single named claim
    if (s.includes('WHERE run_id = ?') && s.includes("AND status = 'pending'") && s.includes('AND attempts < max_attempts') && s.includes('AND available_at <= ?') && s.includes("SET status = 'running'")) {
      const [run_id, now, owner, locked_at, updated_at] = params;
      const row = this.rows.get(run_id);
      if (!row || row.status !== 'pending' || row.attempts >= row.max_attempts || row.available_at > now) return [] as T[];
      Object.assign(row, { status: 'running', attempts: row.attempts + 1, lease_owner: owner, locked_at, updated_at });
      return [row] as T[];
    }

    if (s.startsWith('SELECT * FROM agent_run_queue WHERE status = ?')) {
      return [...this.rows.values()].filter((r) => r.status === params[0]) as T[];
    }

    throw new Error(`FakeQueueConnection.all: unhandled SQL: ${s}`);
  }
}

function makeSpec(id: string): AgentRunSpec {
  return {
    runId: `run_${id}`,
    sessionId: `session_${id}`,
    source: 'api',
    input: { prompt: 'hi', messages: [{ role: 'user', content: 'hi' }] }
  } as AgentRunSpec;
}

describe('AgentRunQueueRepository', () => {
  it('claims a single named run and marks it running with a lease', async () => {
    const conn = new FakeQueueConnection();
    const repo = new AgentRunQueueRepository(conn as any);

    await repo.enqueue({ runId: 'run_a', sessionId: 'sess_a', maxAttempts: 3 });
    const claimed = await repo.claimRun('run_a', 'worker-1');

    expect(claimed?.status).toBe('running');
    expect(claimed?.leaseOwner).toBe('worker-1');
    expect(claimed?.attempts).toBe(1);

    // A second worker cannot claim the same already-running job.
    expect(await repo.claimRun('run_a', 'worker-2')).toBeNull();
  });

  it('completes a claimed run', async () => {
    const conn = new FakeQueueConnection();
    const repo = new AgentRunQueueRepository(conn as any);
    await repo.enqueue({ runId: 'run_done' });
    await repo.claimRun('run_done', 'worker-1');
    await repo.complete('run_done');
    expect((await repo.get('run_done'))?.status).toBe('succeeded');
  });

  it('re-queues a failed run for retry while attempts remain, then terminally fails', async () => {
    const conn = new FakeQueueConnection();
    const repo = new AgentRunQueueRepository(conn as any);
    await repo.enqueue({ runId: 'run_retry', maxAttempts: 2 });

    await repo.claimRun('run_retry', 'worker-1');
    expect(await repo.fail('run_retry', 'boom', 0)).toBe('pending'); // attempt 1 of 2

    // Becomes available again and can be re-claimed.
    const reclaimed = await repo.claimRun('run_retry', 'worker-1');
    expect(reclaimed?.attempts).toBe(2);
    expect(await repo.fail('run_retry', 'boom again', 0)).toBe('failed'); // attempts exhausted
  });

  it('does not claim a named run before its retry backoff is available', async () => {
    const conn = new FakeQueueConnection();
    const repo = new AgentRunQueueRepository(conn as any);
    await repo.enqueue({ runId: 'run_backoff', maxAttempts: 2 });

    await repo.claimRun('run_backoff', 'worker-1');
    expect(await repo.fail('run_backoff', 'wait', 60_000)).toBe('pending');
    expect(await repo.claimRun('run_backoff', 'worker-1')).toBeNull();

    conn.rows.get('run_backoff').available_at = Date.now() - 1;
    expect((await repo.claimRun('run_backoff', 'worker-1'))?.status).toBe('running');
  });

  it('reclaims stale running leases (restart recovery)', async () => {
    const conn = new FakeQueueConnection();
    const repo = new AgentRunQueueRepository(conn as any);
    await repo.enqueue({ runId: 'run_stale' });
    await repo.claimRun('run_stale', 'dead-worker');

    // Force the lease to look stale.
    conn.rows.get('run_stale').locked_at = Date.now() - 120_000;

    const reclaimed = await repo.resetStaleLeases(60_000);
    expect(reclaimed).toBe(1);
    expect((await repo.get('run_stale'))?.status).toBe('pending');

    // The reclaimed job can be picked up again.
    const claimed = await repo.claimRun('run_stale', 'fresh-worker');
    expect(claimed?.status).toBe('running');
  });

  it('cancels a pending or running run', async () => {
    const conn = new FakeQueueConnection();
    const repo = new AgentRunQueueRepository(conn as any);
    await repo.enqueue({ runId: 'run_cancel' });
    expect(await repo.cancel('run_cancel')).toBe(true);
    expect((await repo.get('run_cancel'))?.status).toBe('cancelled');
  });

  it('requeueForResume decrements attempts so permission resume can reclaim with maxAttempts=1', async () => {
    const conn = new FakeQueueConnection();
    const repo = new AgentRunQueueRepository(conn as any);
    await repo.enqueue({ runId: 'run_perm_pause', maxAttempts: 1 });

    const first = await repo.claimRun('run_perm_pause', 'worker-1');
    expect(first?.attempts).toBe(1);

    await repo.requeueForResume('run_perm_pause');
    expect((await repo.get('run_perm_pause'))?.status).toBe('pending');
    expect((await repo.get('run_perm_pause'))?.attempts).toBe(0);

    const resumed = await repo.claimRun('run_perm_pause', 'worker-1');
    expect(resumed?.status).toBe('running');
    expect(resumed?.attempts).toBe(1);
  });
});

describe('AgentRunQueueManager (durable backend)', () => {
  it('enqueues + claims on lease acquire and completes on release', async () => {
    const conn = new FakeQueueConnection();
    const repo = new AgentRunQueueRepository(conn as any);
    const manager = new AgentRunQueueManager({ backend: repo as any, owner: 'worker-1', heartbeatIntervalMs: 60_000 });

    const lease = await manager.acquire(makeSpec('lease'));
    expect((await repo.get('run_lease'))?.status).toBe('running');

    await lease.release();
    expect((await repo.get('run_lease'))?.status).toBe('succeeded');
  });

  it('marks the durable job failed when the lease fails', async () => {
    const conn = new FakeQueueConnection();
    const repo = new AgentRunQueueRepository(conn as any);
    const manager = new AgentRunQueueManager({ backend: repo as any, owner: 'worker-1', heartbeatIntervalMs: 60_000, maxAttempts: 1 });

    const lease = await manager.acquire(makeSpec('fail'));

    await lease.fail(new Error('execution exploded'));
    const row = await repo.get('run_fail');
    expect(row?.status).toBe('failed');
    expect(row?.lastError).toContain('execution exploded');
  });

  it('revives a failed/cancelled durable row on re-enqueue instead of leaving it stuck', async () => {
    const conn = new FakeQueueConnection();
    const repo = new AgentRunQueueRepository(conn as any);
    const manager = new AgentRunQueueManager({ backend: repo as any, owner: 'worker-1', heartbeatIntervalMs: 60_000, maxAttempts: 1 });

    // First run fails terminally — row is now 'failed' with attempts == maxAttempts.
    const firstLease = await manager.acquire(makeSpec('revive'));
    await firstLease.fail(new Error('first attempt exploded'));
    expect((await repo.get('run_revive'))?.status).toBe('failed');

    // Re-enqueue must reset the row to pending so a new run with the same runId
    // can be claimed. Previously ON CONFLICT DO NOTHING left it failed and the
    // next acquire raised `Agent run queue claim rejected`.
    await repo.enqueue({ runId: 'run_revive', maxAttempts: 1 });
    const revived = await repo.get('run_revive');
    expect(revived?.status).toBe('pending');
    expect(revived?.attempts).toBe(0);
    expect(revived?.leaseOwner).toBeUndefined();
    expect(revived?.lastError).toBeUndefined();

    // And the manager can now acquire it cleanly.
    const secondLease = await manager.acquire(makeSpec('revive'));
    expect((await repo.get('run_revive'))?.status).toBe('running');
    await secondLease.release();
    expect((await repo.get('run_revive'))?.status).toBe('succeeded');
  });

  it('rejects execution when durable claim is already owned elsewhere', async () => {
    const conn = new FakeQueueConnection();
    const repo = new AgentRunQueueRepository(conn as any);
    const manager = new AgentRunQueueManager({ backend: repo as any, owner: 'worker-1', heartbeatIntervalMs: 60_000 });

    await repo.enqueue({ runId: 'run_contended' });
    await repo.claimRun('run_contended', 'worker-2');

    await expect(manager.acquire(makeSpec('contended'))).rejects.toMatchObject({
      name: 'AgentRunQueueClaimError'
    });
    expect(manager.snapshot.activeRuns).toBe(0);
    expect((await repo.get('run_contended'))?.leaseOwner).toBe('worker-2');
  });

  it('claims orphaned pending durable rows through the background worker', async () => {
    const conn = new FakeQueueConnection();
    const repo = new AgentRunQueueRepository(conn as any);
    const manager = new AgentRunQueueManager({ backend: repo as any, owner: 'worker-recover', heartbeatIntervalMs: 60_000 });
    const processed: string[] = [];

    await repo.enqueue({ runId: 'run_worker_recover', sessionId: 'session_worker_recover', payload: { agentId: 'agent-1' } });

    const claimed = await manager.runWorkerOnce(async (job) => {
      processed.push(job.runId);
      expect(job.sessionId).toBe('session_worker_recover');
      expect(job.payload?.agentId).toBe('agent-1');
    });

    expect(claimed).toBe(1);
    expect(processed).toEqual(['run_worker_recover']);
    expect((await repo.get('run_worker_recover'))?.status).toBe('succeeded');
  });

  it('reclaims a stale lease and lets a fresh worker continue it', async () => {
    const conn = new FakeQueueConnection();
    const repo = new AgentRunQueueRepository(conn as any);
    await repo.enqueue({ runId: 'run_restart_recover', sessionId: 'session_restart_recover' });
    await repo.claimRun('run_restart_recover', 'dead-worker');
    conn.rows.get('run_restart_recover').locked_at = Date.now() - 120_000;
    await repo.resetStaleLeases(60_000);

    const manager = new AgentRunQueueManager({ backend: repo as any, owner: 'fresh-worker', heartbeatIntervalMs: 60_000 });
    const processed: string[] = [];
    await manager.runWorkerOnce(async (job) => {
      processed.push(job.runId);
    });

    expect(processed).toEqual(['run_restart_recover']);
    const row = await repo.get('run_restart_recover');
    expect(row?.status).toBe('succeeded');
    expect(row?.leaseOwner).toBeUndefined();
  });

  it('does not process cancelled queued rows in the worker', async () => {
    const conn = new FakeQueueConnection();
    const repo = new AgentRunQueueRepository(conn as any);
    const manager = new AgentRunQueueManager({ backend: repo as any, owner: 'worker-1', heartbeatIntervalMs: 60_000 });
    const processed: string[] = [];

    await repo.enqueue({ runId: 'run_worker_cancelled' });
    await repo.cancel('run_worker_cancelled');
    const claimed = await manager.runWorkerOnce(async (job) => {
      processed.push(job.runId);
    });

    expect(claimed).toBe(0);
    expect(processed).toEqual([]);
    expect((await repo.get('run_worker_cancelled'))?.status).toBe('cancelled');
  });

  it('marks worker-claimed jobs failed when recovery execution fails', async () => {
    const conn = new FakeQueueConnection();
    const repo = new AgentRunQueueRepository(conn as any);
    const manager = new AgentRunQueueManager({ backend: repo as any, owner: 'worker-1', heartbeatIntervalMs: 60_000, maxAttempts: 1 });

    await repo.enqueue({ runId: 'run_worker_failed', maxAttempts: 1 });
    await manager.runWorkerOnce(async () => {
      throw new Error('recover failed');
    });

    const row = await repo.get('run_worker_failed');
    expect(row?.status).toBe('failed');
    expect(row?.lastError).toContain('recover failed');
  });

  it('still works as a pure in-memory semaphore without a backend', async () => {
    const manager = new AgentRunQueueManager({ maxConcurrentRuns: 1 });
    const first = await manager.acquire(makeSpec('a'));
    expect(manager.snapshot.activeRuns).toBe(1);
    expect(manager.snapshot.durable).toBe(false);

    let secondAcquired = false;
    const secondPromise = manager.acquire(makeSpec('b')).then((lease) => {
      secondAcquired = true;
      return lease;
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(secondAcquired).toBe(false); // blocked behind the single slot

    await first.release();
    const second = await secondPromise;
    expect(secondAcquired).toBe(true);
    await second.release();
  });
});
