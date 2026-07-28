import type { AgentRun, AgentRunFilter, AgentRunPage, AgentRunSortField } from '../agents/engine/AgentRun.js';
import { BaseRepository } from './BaseRepository.js';

/**
 * Authoritative head-state projection for agent runs, persisted to `agent_runs`.
 *
 * Phase 1 introduces the table + table-backed CRUD so the run log survives restarts
 * without holding every run in memory. Phase 4 layers conditional/optimistic updates
 * and DB-side pagination on top of this.
 */
export class AgentRunRepository extends BaseRepository {
  async save(run: AgentRun): Promise<void> {
    const now = new Date().toISOString();
    await this.db.run(
      `INSERT INTO agent_runs
        (run_id, session_id, thread_id, agent_id, workflow_id, source, status, data, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
       ON CONFLICT (run_id) DO UPDATE SET
         session_id = excluded.session_id,
         thread_id = excluded.thread_id,
         agent_id = excluded.agent_id,
         workflow_id = excluded.workflow_id,
         source = excluded.source,
         status = excluded.status,
         data = excluded.data,
         version = agent_runs.version + 1,
         updated_at = excluded.updated_at`,
      run.runId,
      run.sessionId,
      run.threadId ?? null,
      run.agentId ?? null,
      run.workflowId ?? null,
      run.source ?? null,
      run.status,
      JSON.stringify(run),
      run.createdAt ?? now,
      run.updatedAt ?? now
    );
  }

  async get(runId: string): Promise<AgentRun | null> {
    const row = await this.db.get<{ data: unknown }>(
      'SELECT data FROM agent_runs WHERE run_id = ?',
      runId
    );
    if (!row) return null;
    return this.parseJson<AgentRun>(row.data as any, null as any);
  }

  /** Current optimistic version for a run, or -1 when the run does not exist. */
  async getVersion(runId: string): Promise<number> {
    const row = await this.db.get<{ version: number }>(
      'SELECT version FROM agent_runs WHERE run_id = ?',
      runId
    );
    return row ? Number(row.version) : -1;
  }

  /**
   * Optimistic, regression-guarded update. Writes only when the row's `version` still
   * matches `expectedVersion`, preventing a slower instance from clobbering a newer
   * state (e.g. stamping `running` over a `succeeded` that another instance already
   * wrote). Returns true when the write landed.
   */
  async saveIfVersion(run: AgentRun, expectedVersion: number): Promise<boolean> {
    const now = new Date().toISOString();
    const result = await this.db.run(
      `UPDATE agent_runs SET
         session_id = ?, thread_id = ?, agent_id = ?, workflow_id = ?, source = ?,
         status = ?, data = ?, version = version + 1, updated_at = ?
       WHERE run_id = ? AND version = ?`,
      run.sessionId,
      run.threadId ?? null,
      run.agentId ?? null,
      run.workflowId ?? null,
      run.source ?? null,
      run.status,
      JSON.stringify(run),
      run.updatedAt ?? now,
      run.runId,
      expectedVersion
    );
    return result.changes > 0;
  }

  /**
   * Recover runs left in a non-terminal, lease-less state after a crash/restart.
   * A run is considered safe to recover only when it has no pending queue row and no
   * fresh running queue lease. This prevents a newly started instance from marking work
   * that another instance is actively leasing as failed.
   */
  async recoverInterruptedRuns(
    activeRunIds: string[] = [],
    options: { queueLeaseStaleMs?: number; pendingQueueStaleMs?: number } = {}
  ): Promise<string[]> {
    const now = Date.now();
    const activeLeaseCutoff = now - Math.max(1, options.queueLeaseStaleMs ?? 60_000);
    const pendingQueueCutoff = typeof options.pendingQueueStaleMs === 'number' && Number.isFinite(options.pendingQueueStaleMs)
      ? now - Math.max(1, options.pendingQueueStaleMs)
      : null;
    const pendingQueueGuard = pendingQueueCutoff == null
      ? "q.status = 'pending'"
      : "(q.status = 'pending' AND q.updated_at >= ?)";
    const params = pendingQueueCutoff == null
      ? [activeLeaseCutoff]
      : [pendingQueueCutoff, activeLeaseCutoff];
    const rows = await this.db.all<{ run_id: string; data: unknown }>(
      `SELECT r.run_id, r.data
       FROM agent_runs r
       WHERE r.status IN ('queued', 'running', 'paused', 'cancelling')
         AND NOT EXISTS (
           SELECT 1
           FROM agent_run_queue q
           WHERE q.run_id = r.run_id
             AND (
               ${pendingQueueGuard}
               OR (q.status = 'running' AND q.locked_at IS NOT NULL AND q.locked_at >= ?)
             )
         )`,
      ...params
    );
    const active = new Set(activeRunIds);
    const recovered: string[] = [];
    for (const row of rows) {
      if (active.has(row.run_id)) continue;
      const run = this.parseJson<AgentRun>(row.data as any, null as any);
      if (!run) continue;
      const expectedVersion = await this.getVersion(run.runId);
      const next: AgentRun = {
        ...run,
        status: 'failed',
        error: run.error ?? 'Run interrupted by process restart',
        stopReason: run.stopReason ?? 'interrupted',
        updatedAt: new Date().toISOString(),
        metadata: {
          ...(run.metadata ?? {}),
          interrupted: true,
          retryable: true,
          interruptedAt: new Date().toISOString()
        }
      };
      const ok = await this.saveIfVersion(next, expectedVersion);
      if (ok) recovered.push(run.runId);
    }
    return recovered;
  }

  async list(
    filter?: AgentRunFilter,
    sort?: AgentRunSortField,
    offset = 0,
    limit = 50
  ): Promise<AgentRunPage> {
    const where: string[] = [];
    const params: any[] = [];

    if (filter?.agentId) {
      where.push('agent_id = ?');
      params.push(filter.agentId);
    }
    if (filter?.workflowId) {
      where.push('workflow_id = ?');
      params.push(filter.workflowId);
    }
    if (filter?.source) {
      const sources = Array.isArray(filter.source) ? filter.source : [filter.source];
      if (sources.length) {
        where.push(`source IN (${sources.map(() => '?').join(', ')})`);
        params.push(...sources);
      }
    }
    if (filter?.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      if (statuses.length) {
        where.push(`status IN (${statuses.map(() => '?').join(', ')})`);
        params.push(...statuses);
      }
    }
    if (filter?.createdAfter) {
      where.push('created_at >= ?');
      params.push(filter.createdAfter);
    }
    if (filter?.createdBefore) {
      where.push('created_at <= ?');
      params.push(filter.createdBefore);
    }
    if (filter?.search) {
      where.push('(run_id ILIKE ? OR session_id ILIKE ? OR COALESCE(agent_id, \'\') ILIKE ?)');
      const like = `%${filter.search}%`;
      params.push(like, like, like);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const sortColumn = resolveSortColumn(sort?.field);
    const sortOrder = sort?.order === 'asc' ? 'ASC' : 'DESC';
    const safeLimit = Math.max(1, Math.min(500, limit));
    const safeOffset = Math.max(0, offset);

    const countRow = await this.db.get<{ count: number }>(
      `SELECT COUNT(*) AS count FROM agent_runs ${whereSql}`,
      ...params
    );
    const total = Number(countRow?.count ?? 0);

    const rows = await this.db.all<{ data: unknown }>(
      `SELECT data FROM agent_runs ${whereSql} ORDER BY ${sortColumn} ${sortOrder}, run_id ASC LIMIT ? OFFSET ?`,
      ...params,
      safeLimit,
      safeOffset
    );

    let items = rows.map((row) => this.parseJson<AgentRun>(row.data as any, {} as AgentRun));
    if (filter?.pendingPermission != null) {
      items = items.filter((run) => hasPendingPermission(run) === filter.pendingPermission);
    }

    return { items, total, offset: safeOffset, limit: safeLimit };
  }

  async deleteByRun(runId: string): Promise<void> {
    await this.db.run('DELETE FROM agent_runs WHERE run_id = ?', runId);
  }
}

function resolveSortColumn(field?: AgentRunSortField['field']): string {
  switch (field) {
    case 'updatedAt':
      return 'updated_at';
    case 'status':
      return 'status';
    case 'durationMs':
      // durationMs lives only in the JSON blob; fall back to updated_at ordering.
      return 'updated_at';
    case 'createdAt':
    default:
      return 'created_at';
  }
}

function hasPendingPermission(run: AgentRun): boolean {
  if (run.pendingPermission) return true;
  const permissions = (run as { permissions?: unknown }).permissions;
  if (!Array.isArray(permissions)) return false;
  return permissions.some((permission) => {
    if (!permission || typeof permission !== 'object') return false;
    const item = permission as Record<string, unknown>;
    return item.status === 'pending' || item.effect === 'ask' || Boolean(item.pending);
  });
}
