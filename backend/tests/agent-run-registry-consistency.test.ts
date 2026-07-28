import { describe, expect, it } from 'vitest';
import { AgentRunRepository } from '../src/services/repositories/AgentRunRepository.js';
import { LocalStoreAgentRunRegistry } from '../src/services/agents/engine/AgentRunRegistry.js';
import type { AgentRun } from '../src/services/agents/engine/AgentRun.js';
import type { AgentRunSpec } from '../src/services/agents/engine/AgentRunSpec.js';

/**
 * In-memory fake of {@link PgConnection} for the agent_runs table, including the
 * optimistic `version` column and the conditional UPDATE used by saveIfVersion.
 */
class FakeRunsConnection {
  rows = new Map<string, any>();
  queueRows = new Map<string, { status: string; locked_at?: number | null; updated_at?: number | null }>();

  private norm(sql: string): string {
    return sql.replace(/\s+/g, ' ').trim();
  }

  async run(sql: string, ...params: any[]): Promise<{ lastID: number; changes: number }> {
    const s = this.norm(sql);

    if (s.startsWith('INSERT INTO agent_runs')) {
      const [run_id, session_id, thread_id, agent_id, workflow_id, source, status, data, created_at, updated_at] = params;
      const prev = this.rows.get(run_id);
      this.rows.set(run_id, {
        run_id, session_id, thread_id, agent_id, workflow_id, source, status, data,
        version: prev ? prev.version + 1 : 0,
        created_at: prev?.created_at ?? created_at,
        updated_at
      });
      return { lastID: 0, changes: 1 };
    }

    if (s.startsWith('UPDATE agent_runs SET session_id') && s.includes('WHERE run_id = ? AND version = ?')) {
      const [session_id, thread_id, agent_id, workflow_id, source, status, data, updated_at, run_id, version] = params;
      const row = this.rows.get(run_id);
      if (!row || row.version !== version) return { lastID: 0, changes: 0 };
      Object.assign(row, { session_id, thread_id, agent_id, workflow_id, source, status, data, updated_at, version: row.version + 1 });
      return { lastID: 0, changes: 1 };
    }

    throw new Error(`FakeRunsConnection.run: unhandled SQL: ${s}`);
  }

  async get<T = any>(sql: string, ...params: any[]): Promise<T | undefined> {
    const s = this.norm(sql);
    if (s.startsWith('SELECT data FROM agent_runs WHERE run_id')) {
      const row = this.rows.get(params[0]);
      return row ? ({ data: row.data } as T) : undefined;
    }
    if (s.startsWith('SELECT version FROM agent_runs WHERE run_id')) {
      const row = this.rows.get(params[0]);
      return row ? ({ version: row.version } as T) : undefined;
    }
    if (s.startsWith('SELECT COUNT(*) AS count FROM agent_runs')) {
      return { count: this.matching(s, params).length } as T;
    }
    throw new Error(`FakeRunsConnection.get: unhandled SQL: ${s}`);
  }

  async all<T = any>(sql: string, ...params: any[]): Promise<T[]> {
    const s = this.norm(sql);
    if (s.startsWith('SELECT r.run_id, r.data FROM agent_runs r')) {
      const hasPendingCutoff = s.includes("q.status = 'pending' AND q.updated_at >= ?");
      const pendingQueueCutoff = hasPendingCutoff ? Number(params[0] ?? 0) : null;
      const activeLeaseCutoff = Number(params[hasPendingCutoff ? 1 : 0] ?? 0);
      return [...this.rows.values()]
        .filter((r) => ['queued', 'running', 'paused', 'cancelling'].includes(r.status))
        .filter((r) => {
          const lease = this.queueRows.get(r.run_id);
          if (!lease) return true;
          if (lease.status === 'pending') {
            if (pendingQueueCutoff == null) return false;
            return Number(lease.updated_at ?? 0) < pendingQueueCutoff;
          }
          if (lease.status === 'running' && lease.locked_at != null && lease.locked_at >= activeLeaseCutoff) {
            return false;
          }
          return true;
        })
        .map((r) => ({ run_id: r.run_id, data: r.data })) as T[];
    }
    if (s.startsWith('SELECT data FROM agent_runs')) {
      const matched = this.matching(s, params);
      // Honor LIMIT/OFFSET (last two params) for pagination assertions.
      const limit = params[params.length - 2];
      const offset = params[params.length - 1];
      const sorted = matched.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      return sorted.slice(offset, offset + limit).map((r) => ({ data: r.data })) as T[];
    }
    throw new Error(`FakeRunsConnection.all: unhandled SQL: ${s}`);
  }

  private matching(sql: string, params: any[]): any[] {
    let rows = [...this.rows.values()];
    if (sql.includes('status IN')) {
      // The status filter params come first; pull the ones that look like statuses.
      const statuses = params.filter((p) => typeof p === 'string' && ['queued', 'running', 'paused', 'cancelling', 'succeeded', 'failed', 'cancelled', 'archived'].includes(p));
      if (statuses.length) rows = rows.filter((r) => statuses.includes(r.status));
    }
    return rows;
  }
}

function createStore(conn: FakeRunsConnection) {
  return {
    repositories: { agentRuns: new AgentRunRepository(conn as any) },
    get: async () => null,
    put: async () => undefined
  };
}

function makeSpec(id: string): AgentRunSpec {
  return {
    runId: `run_${id}`,
    sessionId: `session_${id}`,
    source: 'api',
    input: { prompt: 'hi', messages: [{ role: 'user', content: 'hi' }] }
  } as AgentRunSpec;
}

describe('AgentRunRepository optimistic writes', () => {
  it('rejects a stale-version write (no regression of newer state)', async () => {
    const conn = new FakeRunsConnection();
    const repo = new AgentRunRepository(conn as any);
    const run: AgentRun = {
      runId: 'run_opt', sessionId: 's', source: 'api', status: 'running',
      createdAt: '2026-06-10T00:00:00.000Z', updatedAt: '2026-06-10T00:00:00.000Z',
      roundCount: 0, toolCallCount: 0, artifactCount: 0, checkpointCount: 0
    };
    await repo.save(run); // version 0

    // Instance A reads version 0, instance B reads version 0.
    const versionA = await repo.getVersion('run_opt');
    const versionB = await repo.getVersion('run_opt');

    // Instance A writes 'succeeded' first.
    expect(await repo.saveIfVersion({ ...run, status: 'succeeded' }, versionA)).toBe(true);
    // Instance B's stale 'running' write must be rejected.
    expect(await repo.saveIfVersion({ ...run, status: 'running' }, versionB)).toBe(false);

    expect((await repo.get('run_opt'))?.status).toBe('succeeded');
  });

  it('recovers interrupted non-terminal runs as retryable failures, skipping active ones', async () => {
    const conn = new FakeRunsConnection();
    const repo = new AgentRunRepository(conn as any);
    const base = { sessionId: 's', source: 'api' as const, createdAt: '2026-06-10T00:00:00.000Z', updatedAt: '2026-06-10T00:00:00.000Z', roundCount: 0, toolCallCount: 0, artifactCount: 0, checkpointCount: 0 };
    await repo.save({ runId: 'run_running', status: 'running', ...base });
    await repo.save({ runId: 'run_active', status: 'running', ...base });
    await repo.save({ runId: 'run_done', status: 'succeeded', ...base });

    const recovered = await repo.recoverInterruptedRuns(['run_active']);

    expect(recovered).toEqual(['run_running']);
    const recoveredRun = await repo.get('run_running');
    expect(recoveredRun?.status).toBe('failed');
    expect(recoveredRun?.metadata?.interrupted).toBe(true);
    expect(recoveredRun?.metadata?.retryable).toBe(true);
    expect((await repo.get('run_active'))?.status).toBe('running');
    expect((await repo.get('run_done'))?.status).toBe('succeeded');
  });

  it('does not recover runs with a fresh queue lease from another worker', async () => {
    const conn = new FakeRunsConnection();
    const repo = new AgentRunRepository(conn as any);
    const base = { sessionId: 's', source: 'api' as const, createdAt: '2026-06-10T00:00:00.000Z', updatedAt: '2026-06-10T00:00:00.000Z', roundCount: 0, toolCallCount: 0, artifactCount: 0, checkpointCount: 0 };
    await repo.save({ runId: 'run_foreign', status: 'running', ...base });
    await repo.save({ runId: 'run_orphan', status: 'running', ...base });
    conn.queueRows.set('run_foreign', { status: 'running', locked_at: Date.now() });

    const recovered = await repo.recoverInterruptedRuns();

    expect(recovered).toEqual(['run_orphan']);
    expect((await repo.get('run_foreign'))?.status).toBe('running');
    expect((await repo.get('run_orphan'))?.status).toBe('failed');
  });

  it('recovers queued runs whose pending queue row is stale beyond the recovery cutoff', async () => {
    const conn = new FakeRunsConnection();
    const repo = new AgentRunRepository(conn as any);
    const base = { sessionId: 's', source: 'api' as const, createdAt: '2026-06-10T00:00:00.000Z', updatedAt: '2026-06-10T00:00:00.000Z', roundCount: 0, toolCallCount: 0, artifactCount: 0, checkpointCount: 0 };
    await repo.save({ runId: 'run_pending_fresh', status: 'queued', ...base });
    await repo.save({ runId: 'run_pending_stale', status: 'queued', ...base });
    conn.queueRows.set('run_pending_fresh', { status: 'pending', updated_at: Date.now() });
    conn.queueRows.set('run_pending_stale', { status: 'pending', updated_at: Date.now() - 120_000 });

    const recovered = await repo.recoverInterruptedRuns([], { pendingQueueStaleMs: 60_000 });

    expect(recovered).toEqual(['run_pending_stale']);
    expect((await repo.get('run_pending_fresh'))?.status).toBe('queued');
    expect((await repo.get('run_pending_stale'))?.status).toBe('failed');
  });

  it('recovers runs whose queue lease is stale', async () => {
    const conn = new FakeRunsConnection();
    const repo = new AgentRunRepository(conn as any);
    const base = { sessionId: 's', source: 'api' as const, createdAt: '2026-06-10T00:00:00.000Z', updatedAt: '2026-06-10T00:00:00.000Z', roundCount: 0, toolCallCount: 0, artifactCount: 0, checkpointCount: 0 };
    await repo.save({ runId: 'run_stale_lease', status: 'running', ...base });
    conn.queueRows.set('run_stale_lease', { status: 'running', locked_at: Date.now() - 120_000 });

    const recovered = await repo.recoverInterruptedRuns();

    expect(recovered).toEqual(['run_stale_lease']);
    expect((await repo.get('run_stale_lease'))?.status).toBe('failed');
  });
});

describe('LocalStoreAgentRunRegistry (table-authoritative)', () => {
  it('persists and reads back through the table', async () => {
    const conn = new FakeRunsConnection();
    const registry = new LocalStoreAgentRunRegistry(createStore(conn) as any);

    await registry.register(makeSpec('a'));
    const fetched = await registry.get('run_a');
    expect(fetched?.runId).toBe('run_a');
    expect(fetched?.status).toBe('queued');
    expect(conn.rows.has('run_a')).toBe(true);
  });

  it('reflects authoritative table state across separate registry instances', async () => {
    const conn = new FakeRunsConnection();
    const writer = new LocalStoreAgentRunRegistry(createStore(conn) as any);
    await writer.register(makeSpec('shared'));
    await writer.update('run_shared', { status: 'running' });

    // A second instance reading the same DB sees the latest state (cache is per-instance).
    const reader = new LocalStoreAgentRunRegistry(createStore(conn) as any);
    expect((await reader.get('run_shared'))?.status).toBe('running');
  });

  it('hydrates the authoritative row before patch updates from a stale instance', async () => {
    const conn = new FakeRunsConnection();
    const staleWriter = new LocalStoreAgentRunRegistry(createStore(conn) as any);
    await staleWriter.register(makeSpec('stale_patch'));

    const latestWriter = new LocalStoreAgentRunRegistry(createStore(conn) as any);
    await latestWriter.update('run_stale_patch', { status: 'running' });
    await latestWriter.update('run_stale_patch', { status: 'succeeded' });
    await staleWriter.update('run_stale_patch', { metadata: { patchedBy: 'stale-writer' } });

    const reader = new LocalStoreAgentRunRegistry(createStore(conn) as any);
    const run = await reader.get('run_stale_patch');
    expect(run?.status).toBe('succeeded');
    expect(run?.metadata?.patchedBy).toBe('stale-writer');
  });

  it('rejects direct illegal status regressions from table-backed updates', async () => {
    const conn = new FakeRunsConnection();
    const registry = new LocalStoreAgentRunRegistry(createStore(conn) as any);
    await registry.register(makeSpec('status_guard'));
    await registry.update('run_status_guard', { status: 'running' });
    await registry.update('run_status_guard', { status: 'succeeded' });

    await registry.update('run_status_guard', { status: 'running' });

    const run = await registry.get('run_status_guard');
    expect(run?.status).toBe('succeeded');
    expect((run?.metadata?.runControl as any)?.rejectedTransitions?.at(-1)).toMatchObject({
      from: 'succeeded',
      to: 'running',
      trigger: 'manual_status_update'
    });
  });

  it('delegates list pagination to the table', async () => {
    const conn = new FakeRunsConnection();
    const registry = new LocalStoreAgentRunRegistry(createStore(conn) as any);
    for (let i = 0; i < 5; i++) {
      await registry.register(makeSpec(`p${i}`));
    }
    const page = await registry.list(undefined, undefined, 0, 2);
    expect(page.items).toHaveLength(2);
    expect(page.total).toBe(5);
    expect(page.limit).toBe(2);
  });

  it('exposes interrupted-run recovery', async () => {
    const conn = new FakeRunsConnection();
    const registry = new LocalStoreAgentRunRegistry(createStore(conn) as any);
    await registry.register(makeSpec('crash'));
    await registry.update('run_crash', { status: 'running' });

    const recovered = await registry.recoverInterruptedRuns();
    expect(recovered).toEqual(['run_crash']);
    expect((await registry.get('run_crash'))?.status).toBe('failed');
  });
});
