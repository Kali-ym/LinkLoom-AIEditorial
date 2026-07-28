import { describe, expect, it } from 'vitest';
import { AgentEventRepository } from '../src/services/repositories/AgentEventRepository.js';
import { AgentRunRepository } from '../src/services/repositories/AgentRunRepository.js';
import { AgentSessionRepository } from '../src/services/repositories/AgentSessionRepository.js';
import { LocalStoreAgentSessionStore } from '../src/services/agents/engine/AgentSessionStore.js';
import type { AgentEvent } from '../src/services/agents/engine/AgentEvent.js';
import type { AgentRunSpec } from '../src/services/agents/engine/AgentRunSpec.js';

/**
 * In-memory fake of {@link PgConnection} covering exactly the SQL the agent runtime
 * repositories issue. Stores rows in JS structures and records every write so tests can
 * assert the append-only / no-rewrite contract.
 */
class FakePgConnection {
  events = new Map<string, Array<{ seq: number; event_id: string; payload: string; session_id: string | null; type: string; timestamp: string | null; created_at: number }>>();
  sessions = new Map<string, any>();
  runs = new Map<string, any>();
  checkpoints = new Map<string, Map<string, any>>();
  artifacts = new Map<string, Map<string, any>>();
  writeLog: Array<{ sql: string; params: any[] }> = [];

  private norm(sql: string): string {
    return sql.replace(/\s+/g, ' ').trim();
  }

  async run(sql: string, ...params: any[]): Promise<{ lastID: number; changes: number }> {
    const s = this.norm(sql);
    this.writeLog.push({ sql: s, params });

    if (s.startsWith('INSERT INTO agent_events')) {
      const [run_id, seq, event_id, session_id, type, payload, timestamp, created_at] = params;
      const rows = this.events.get(run_id) ?? [];
      if (rows.some((r) => r.seq === seq || r.event_id === event_id)) {
        return { lastID: 0, changes: 0 }; // ON CONFLICT DO NOTHING
      }
      rows.push({ seq, event_id, payload, session_id, type, timestamp, created_at });
      this.events.set(run_id, rows);
      return { lastID: 0, changes: 1 };
    }

    if (s.startsWith('INSERT INTO agent_sessions')) {
      const [run_id, session_id, thread_id, source, status, head, last_seq, created_at, updated_at] = params;
      const prev = this.sessions.get(run_id);
      const mergedLastSeq = prev ? Math.max(prev.last_seq ?? 0, last_seq) : last_seq;
      this.sessions.set(run_id, { run_id, session_id, thread_id, source, status, head, last_seq: mergedLastSeq, created_at: prev?.created_at ?? created_at, updated_at });
      return { lastID: 0, changes: 1 };
    }

    if (s.startsWith('UPDATE agent_sessions SET last_seq')) {
      const [seq, run_id] = params;
      const row = this.sessions.get(run_id);
      if (row) row.last_seq = Math.max(row.last_seq ?? 0, seq);
      return { lastID: 0, changes: row ? 1 : 0 };
    }

    if (s.startsWith('INSERT INTO agent_runs')) {
      const [run_id, session_id, thread_id, agent_id, workflow_id, source, status, data] = params;
      const prev = this.runs.get(run_id);
      this.runs.set(run_id, {
        run_id, session_id, thread_id, agent_id, workflow_id, source, status, data,
        version: prev ? prev.version + 1 : 0,
        created_at: prev?.created_at ?? params[8],
        updated_at: params[9]
      });
      return { lastID: 0, changes: 1 };
    }

    if (s.startsWith('INSERT INTO agent_checkpoints')) {
      const [run_id, checkpoint_id, session_id, status, data, created_at] = params;
      const byRun = this.checkpoints.get(run_id) ?? new Map();
      byRun.set(checkpoint_id, { run_id, checkpoint_id, session_id, status, data, created_at });
      this.checkpoints.set(run_id, byRun);
      return { lastID: 0, changes: 1 };
    }

    if (s.startsWith('INSERT INTO agent_artifacts')) {
      const [run_id, artifact_id, session_id, kind, data, created_at] = params;
      const byRun = this.artifacts.get(run_id) ?? new Map();
      byRun.set(artifact_id, { run_id, artifact_id, session_id, kind, data, created_at });
      this.artifacts.set(run_id, byRun);
      return { lastID: 0, changes: 1 };
    }

    if (s.startsWith('DELETE FROM agent_events')) {
      this.events.delete(params[0]);
      return { lastID: 0, changes: 1 };
    }
    if (s.startsWith('DELETE FROM agent_runs')) {
      this.runs.delete(params[0]);
      return { lastID: 0, changes: 1 };
    }

    throw new Error(`FakePgConnection.run: unhandled SQL: ${s}`);
  }

  async get<T = any>(sql: string, ...params: any[]): Promise<T | undefined> {
    const s = this.norm(sql);

    if (s.startsWith('SELECT payload FROM agent_events WHERE run_id = ? AND event_id = ?')) {
      const rows = this.events.get(params[0]) ?? [];
      const row = rows.find((r) => r.event_id === params[1]);
      return row ? ({ payload: row.payload } as T) : undefined;
    }
    if (s.startsWith('SELECT MAX(seq) AS max_seq FROM agent_events')) {
      const rows = this.events.get(params[0]) ?? [];
      const max = rows.reduce((m, r) => Math.max(m, r.seq), 0);
      return { max_seq: rows.length ? max : null } as T;
    }
    if (s.startsWith('SELECT COUNT(*) AS count FROM agent_events')) {
      const rows = this.events.get(params[0]) ?? [];
      return { count: rows.length } as T;
    }
    if (s.startsWith('SELECT head FROM agent_sessions')) {
      const row = this.sessions.get(params[0]);
      return row ? ({ head: row.head } as T) : undefined;
    }
    if (s.startsWith('SELECT last_seq FROM agent_sessions')) {
      const row = this.sessions.get(params[0]);
      return row ? ({ last_seq: row.last_seq } as T) : undefined;
    }
    if (s.startsWith('SELECT data FROM agent_runs')) {
      const row = this.runs.get(params[0]);
      return row ? ({ data: row.data } as T) : undefined;
    }
    if (s.startsWith('SELECT COUNT(*) AS count FROM agent_runs')) {
      return { count: this.runs.size } as T;
    }

    throw new Error(`FakePgConnection.get: unhandled SQL: ${s}`);
  }

  async all<T = any>(sql: string, ...params: any[]): Promise<T[]> {
    const s = this.norm(sql);

    if (s.startsWith('SELECT payload FROM agent_events')) {
      const rows = [...(this.events.get(params[0]) ?? [])].sort((a, b) => a.seq - b.seq);
      const afterSeq = s.includes('AND seq > ?') ? params[1] : undefined;
      const filtered = typeof afterSeq === 'number' ? rows.filter((r) => r.seq > afterSeq) : rows;
      return filtered.map((r) => ({ payload: r.payload })) as T[];
    }
    if (s.startsWith('SELECT run_id FROM agent_sessions WHERE session_id')) {
      return [...this.sessions.values()]
        .filter((r) => r.session_id === params[0])
        .map((r) => ({ run_id: r.run_id })) as T[];
    }
    if (s.startsWith('SELECT run_id FROM agent_sessions WHERE thread_id')) {
      return [...this.sessions.values()]
        .filter((r) => r.thread_id === params[0])
        .map((r) => ({ run_id: r.run_id })) as T[];
    }
    if (s.startsWith('SELECT run_id FROM agent_sessions ORDER BY')) {
      return [...this.sessions.values()].map((r) => ({ run_id: r.run_id })) as T[];
    }
    if (s.startsWith('SELECT data FROM agent_checkpoints')) {
      const byRun = this.checkpoints.get(params[0]) ?? new Map();
      return [...byRun.values()].map((r) => ({ data: r.data })) as T[];
    }
    if (s.startsWith('SELECT data FROM agent_artifacts')) {
      const byRun = this.artifacts.get(params[0]) ?? new Map();
      return [...byRun.values()].map((r) => ({ data: r.data })) as T[];
    }
    if (s.startsWith('SELECT data FROM agent_runs')) {
      return [...this.runs.values()].map((r) => ({ data: r.data })) as T[];
    }

    throw new Error(`FakePgConnection.all: unhandled SQL: ${s}`);
  }
}

function createRepos(conn: FakePgConnection) {
  return {
    agentEvents: new AgentEventRepository(conn as any),
    agentRuns: new AgentRunRepository(conn as any),
    agentSessions: new AgentSessionRepository(conn as any)
  };
}

function createFakeStore(conn: FakePgConnection) {
  const kv = new Map<string, any>();
  return {
    repositories: createRepos(conn),
    get: async (key: string) => kv.get(key) ?? null,
    put: async (key: string, value: any) => {
      kv.set(key, value);
    }
  };
}

function makeEvent(runId: string, sessionId: string, seq: number, type: AgentEvent['type'], extra: Record<string, unknown> = {}): AgentEvent {
  return {
    id: `${runId}-evt-${seq}`,
    type,
    runId,
    sessionId,
    timestamp: new Date(2026, 5, 10, 0, 0, seq).toISOString(),
    sequence: seq,
    payload: {},
    ...extra
  } as AgentEvent;
}

function makeSpec(id = 'p1'): AgentRunSpec {
  return {
    runId: `run_${id}`,
    sessionId: `session_${id}`,
    threadId: `thread_${id}`,
    source: 'api',
    input: { prompt: 'hi', messages: [{ role: 'user', content: 'hi' }] }
  } as AgentRunSpec;
}

describe('AgentEventRepository', () => {
  it('appends each event as a single INSERT and never rewrites history', async () => {
    const conn = new FakePgConnection();
    const repo = new AgentEventRepository(conn as any);
    const runId = 'run_append';

    for (let seq = 1; seq <= 25; seq++) {
      await repo.appendEvent(makeEvent(runId, 'session_append', seq, 'model_delta'));
    }

    const inserts = conn.writeLog.filter((entry) => entry.sql.startsWith('INSERT INTO agent_events'));
    expect(inserts).toHaveLength(25);
    expect(conn.writeLog.some((entry) => entry.sql.startsWith('UPDATE agent_events'))).toBe(false);
    expect(await repo.countByRun(runId)).toBe(25);
    expect(await repo.maxSequence(runId)).toBe(25);
    expect(conn.events.get(runId)).toHaveLength(25);
  });

  it('replays events in ascending sequence order', async () => {
    const conn = new FakePgConnection();
    const repo = new AgentEventRepository(conn as any);
    const runId = 'run_replay';

    // Append out of order; storage must still replay by seq.
    for (const seq of [3, 1, 2, 5, 4]) {
      await repo.appendEvent(makeEvent(runId, 'session_replay', seq, 'model_delta'));
    }

    const replayed = await repo.listByRun(runId);
    expect(replayed.map((event) => event.sequence)).toEqual([1, 2, 3, 4, 5]);
  });

  it('dedupes events with a duplicate sequence (ON CONFLICT DO NOTHING)', async () => {
    const conn = new FakePgConnection();
    const repo = new AgentEventRepository(conn as any);
    const runId = 'run_dedupe';

    expect(await repo.appendEvent(makeEvent(runId, 'session_dedupe', 1, 'run_started'))).toBe(true);
    expect(await repo.appendEvent(makeEvent(runId, 'session_dedupe', 1, 'run_started'))).toBe(false);

    expect(await repo.countByRun(runId)).toBe(1);
  });

  it('returns the existing row for duplicate event ids without throwing', async () => {
    const conn = new FakePgConnection();
    const repo = new AgentEventRepository(conn as any);
    const runId = 'run_event_id_dedupe';
    const first = makeEvent(runId, 'session_event_id_dedupe', 1, 'model_delta');
    const duplicate = { ...makeEvent(runId, 'session_event_id_dedupe', 2, 'model_delta'), id: first.id } as AgentEvent;

    const inserted = await repo.appendEventAllocatingSequence(first);
    const replayed = await repo.appendEventAllocatingSequence(duplicate);

    expect(inserted.sequence).toBe(1);
    expect(replayed.sequence).toBe(1);
    expect(await repo.countByRun(runId)).toBe(1);
  });

  it('retries sequence allocation when another event already owns the candidate sequence', async () => {
    const conn = new FakePgConnection();
    const repo = new AgentEventRepository(conn as any);
    const runId = 'run_seq_retry';

    await repo.appendEvent(makeEvent(runId, 'session_seq_retry', 1, 'run_started'));
    const persisted = await repo.appendEventAllocatingSequence(
      makeEvent(runId, 'session_seq_retry', 1, 'model_delta', { id: 'run_seq_retry_evt_new' })
    );

    expect(persisted.sequence).toBe(2);
    expect((await repo.listByRun(runId)).map((event) => event.sequence)).toEqual([1, 2]);
  });

  it('supports last-seq incremental reads for SSE resume', async () => {
    const conn = new FakePgConnection();
    const repo = new AgentEventRepository(conn as any);
    const runId = 'run_resume';

    for (let seq = 1; seq <= 6; seq++) {
      await repo.appendEvent(makeEvent(runId, 'session_resume', seq, 'model_delta'));
    }

    const tail = await repo.listByRun(runId, 4);
    expect(tail.map((event) => event.sequence)).toEqual([5, 6]);
  });
});

describe('LocalStoreAgentSessionStore (table-backed)', () => {
  it('appends N events as N event rows without rewriting the session head event log', async () => {
    const conn = new FakePgConnection();
    const store = createFakeStore(conn);
    const sessionStore = new LocalStoreAgentSessionStore(store as any);
    const spec = makeSpec('events');

    await sessionStore.createSession(spec);
    const events: AgentEvent[] = [
      makeEvent(spec.runId, spec.sessionId, 1, 'run_started', { payload: { source: 'api', status: 'running' } }),
      makeEvent(spec.runId, spec.sessionId, 2, 'model_finished', { payload: { round: 1 } }),
      makeEvent(spec.runId, spec.sessionId, 3, 'model_finished', { payload: { round: 2 } }),
      makeEvent(spec.runId, spec.sessionId, 4, 'run_finished', { payload: { status: 'succeeded', output: { content: 'ok' } } })
    ];
    for (const event of events) {
      await sessionStore.appendEvent(event);
    }

    const eventInserts = conn.writeLog.filter((entry) => entry.sql.startsWith('INSERT INTO agent_events'));
    expect(eventInserts).toHaveLength(4);

    // Persisted head must never carry the event log.
    const headRow = conn.sessions.get(spec.runId);
    expect(headRow).toBeTruthy();
    expect(JSON.parse(headRow.head)).not.toHaveProperty('events');
    expect(headRow.last_seq).toBe(4);
    expect(conn.events.get(spec.runId)).toHaveLength(4);
  });

  it('reconstructs the full session from tables on a cold cache', async () => {
    const conn = new FakePgConnection();

    // First store instance writes everything.
    const writer = new LocalStoreAgentSessionStore(createFakeStore(conn) as any);
    const spec = makeSpec('cold');
    await writer.createSession(spec);
    await writer.appendEvent(makeEvent(spec.runId, spec.sessionId, 1, 'run_started', { payload: { source: 'api', status: 'running' } }));
    await writer.appendEvent(makeEvent(spec.runId, spec.sessionId, 2, 'run_finished', { payload: { status: 'succeeded', output: { content: 'done' } } }));

    // Fresh process: new store instance over the same DB, empty in-memory cache.
    const reader = new LocalStoreAgentSessionStore(createFakeStore(conn) as any);
    const session = await reader.getSessionByRunId(spec.runId);

    expect(session).toBeTruthy();
    expect(session?.runId).toBe(spec.runId);
    expect(session?.sessionId).toBe(spec.sessionId);
    expect(session?.events.map((event) => event.sequence)).toEqual([1, 2]);
    expect(session?.status).toBe('succeeded');
  });

  it('refreshes table-backed sessions instead of returning stale in-memory cache', async () => {
    const conn = new FakePgConnection();
    const writer = new LocalStoreAgentSessionStore(createFakeStore(conn) as any);
    const reader = new LocalStoreAgentSessionStore(createFakeStore(conn) as any);
    const spec = makeSpec('refresh');

    await writer.createSession(spec);
    await writer.appendEvent(makeEvent(spec.runId, spec.sessionId, 1, 'run_started', { payload: { source: 'api', status: 'running' } }));

    const firstRead = await reader.getSessionByRunId(spec.runId);
    expect(firstRead?.status).toBe('running');

    await writer.appendEvent(makeEvent(spec.runId, spec.sessionId, 2, 'run_finished', { payload: { status: 'succeeded', output: { content: 'done' } } }));

    const refreshed = await reader.getSessionByRunId(spec.runId);
    expect(refreshed?.status).toBe('succeeded');
    expect(refreshed?.events.map((event) => event.sequence)).toEqual([1, 2]);
  });

  it('falls back to legacy KV blobs when repositories are unavailable', async () => {
    const kv = new Map<string, any>();
    const legacyStore = {
      // No `repositories` → forces the KV fallback path.
      get: async (key: string) => kv.get(key) ?? null,
      put: async (key: string, value: any) => {
        kv.set(key, value);
      }
    };
    const sessionStore = new LocalStoreAgentSessionStore(legacyStore as any);
    const spec = makeSpec('legacy');

    await sessionStore.createSession(spec);
    await sessionStore.appendEvent(makeEvent(spec.runId, spec.sessionId, 1, 'run_started', { payload: { source: 'api', status: 'running' } }));

    // Stored as a full session blob under the legacy run key.
    expect(kv.has(`agent_session_run_record:${spec.runId}`)).toBe(true);

    const reader = new LocalStoreAgentSessionStore(legacyStore as any);
    const session = await reader.getSessionByRunId(spec.runId);
    expect(session?.events.map((event) => event.type)).toEqual(['run_started']);
  });
});
