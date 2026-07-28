import type { LocalStore } from '../../LocalStore.js';
import type { AgentEvent, AgentHitlRequest } from './AgentEvent.js';
import type { AgentRun, AgentRunFilter, AgentRunPage, AgentRunSortField } from './AgentRun.js';
import type { AgentRunSpec } from './AgentRunSpec.js';
import {
  appendRejectedRunStatusTransitionMetadata,
  evaluateRunEventStatusTransition,
  evaluateRunStatusTransition
} from './AgentRunStateMachine.js';

export interface AgentRunRegistry {
  register(spec: AgentRunSpec): Promise<AgentRun>;
  update(runId: string, patch: Partial<AgentRun>): Promise<void>;
  get(runId: string): Promise<AgentRun | null>;
  list(filter?: AgentRunFilter, sort?: AgentRunSortField, offset?: number, limit?: number): Promise<AgentRunPage>;
  applyEvent(event: AgentEvent): Promise<void>;
}

export class InMemoryAgentRunRegistry implements AgentRunRegistry {
  private readonly runs = new Map<string, AgentRun>();

  async register(spec: AgentRunSpec): Promise<AgentRun> {
    const existing = this.runs.get(spec.runId);
    if (existing) {
      return { ...existing };
    }

    const now = new Date().toISOString();
    const run: AgentRun = {
      runId: spec.runId,
      sessionId: spec.sessionId,
      threadId: spec.threadId,
      agentId: extractAgentId(spec),
      agentSpecId: spec.agentSpec?.specId,
      agentSpecRevision: spec.agentSpec?.revision,
      agentSpec: spec.agentSpec,
      workflowId: spec.workflowDef?.id,
      source: spec.source,
      status: 'queued',
      createdAt: now,
      updatedAt: now,
      roundCount: 0,
      toolCallCount: 0,
      artifactCount: 0,
      checkpointCount: 0,
      metadata: spec.metadata,
    };
    this.runs.set(run.runId, run);
    return { ...run };
  }

  async update(runId: string, patch: Partial<AgentRun>): Promise<void> {
    const existing = this.runs.get(runId);
    if (!existing) return;
    Object.assign(existing, patch, { updatedAt: new Date().toISOString() });
  }

  async get(runId: string): Promise<AgentRun | null> {
    const run = this.runs.get(runId);
    return run ? { ...run } : null;
  }

  async list(
    filter?: AgentRunFilter,
    sort?: AgentRunSortField,
    offset = 0,
    limit = 50
  ): Promise<AgentRunPage> {
    let items = [...this.runs.values()];
    items = applyFilter(items, filter);
    items = applySort(items, sort);
    const total = items.length;
    items = items.slice(offset, offset + limit);
    return { items, total, offset, limit };
  }

  async applyEvent(event: AgentEvent): Promise<void> {
    const run = this.runs.get(event.runId);
    if (!run) return;
    applyEventToRun(run, event);
    run.updatedAt = new Date().toISOString();
  }
}

export class LocalStoreAgentRunRegistry extends InMemoryAgentRunRegistry {
  private readonly keyPrefix = 'agent_run:';
  private readonly indexKey = 'agent_run_index';
  /** Short-TTL read cache to absorb bursty re-reads without re-hitting the DB. */
  private readonly cache = new Map<string, { run: AgentRun; expiresAt: number }>();
  private readonly cacheTtlMs = 1_000;

  constructor(private readonly store: LocalStore) {
    super();
  }

  /** Table-backed run repository when available; undefined for mocked test stores. */
  private get repo() {
    return (this.store as { repositories?: { agentRuns?: import('../../repositories/AgentRunRepository.js').AgentRunRepository } })
      .repositories?.agentRuns;
  }

  override async register(spec: AgentRunSpec): Promise<AgentRun> {
    const run = await super.register(spec);
    await this.persist(run);
    return run;
  }

  override async update(runId: string, patch: Partial<AgentRun>): Promise<void> {
    const repo = this.repo;
    if (repo) {
      const authoritative = await repo.get(runId);
      if (authoritative) await this.hydrateInMemory(authoritative);
    }
    const current = await super.get(runId);
    if (!current) return;
    await super.update(runId, guardRunUpdatePatch(current, patch));
    const run = await super.get(runId);
    if (run) await this.persist(run);
  }

  override async applyEvent(event: AgentEvent): Promise<void> {
    // Seed the in-memory projection from the authoritative table first so event folding
    // builds on the latest persisted state rather than a stale or missing local copy.
    const repo = this.repo;
    if (repo) {
      const authoritative = await repo.get(event.runId);
      if (authoritative) await this.hydrateInMemory(authoritative);
    }
    await super.applyEvent(event);
    const run = await super.get(event.runId);
    if (run) await this.persist(run);
  }

  override async get(runId: string): Promise<AgentRun | null> {
    const cached = this.cache.get(runId);
    if (cached && cached.expiresAt > Date.now()) return { ...cached.run };

    const repo = this.repo;
    if (repo) {
      const run = await repo.get(runId);
      if (run) {
        this.cache.set(runId, { run, expiresAt: Date.now() + this.cacheTtlMs });
        await this.hydrateInMemory(run);
        return { ...run };
      }
      return null;
    }

    // Legacy KV fallback (mocked stores / pre-migration data).
    const memory = await super.get(runId);
    if (memory) return memory;
    const stored = await this.store.get(this.key(runId));
    if (!stored) return null;
    const run = stored as AgentRun;
    await this.hydrateInMemory(run);
    return run;
  }

  override async list(
    filter?: AgentRunFilter,
    sort?: AgentRunSortField,
    offset = 0,
    limit = 50
  ): Promise<AgentRunPage> {
    const repo = this.repo;
    if (repo) {
      // Authoritative, DB-side pagination — no full-table load into memory.
      return repo.list(filter, sort, offset, limit);
    }

    const index = await this.getIndex();
    for (const runId of index) {
      await this.get(runId);
    }
    return super.list(filter, sort, offset, limit);
  }

  /**
   * Recover non-terminal, lease-less runs after a restart. `activeRunIds` are runs this
   * process is actively executing and must be left alone.
   */
  async recoverInterruptedRuns(
    activeRunIds: string[] = [],
    options: { queueLeaseStaleMs?: number; pendingQueueStaleMs?: number } = {}
  ): Promise<string[]> {
    const repo = this.repo;
    if (!repo) return [];
    const recovered = await repo.recoverInterruptedRuns(activeRunIds, options);
    for (const runId of recovered) this.cache.delete(runId);
    return recovered;
  }

  private async hydrateInMemory(run: AgentRun): Promise<void> {
    await super.register({ runId: run.runId, sessionId: run.sessionId, source: run.source, input: {} });
    await super.update(run.runId, run);
  }

  private async persist(run: AgentRun): Promise<void> {
    const safeRun = toJsonSafeValue(run) as AgentRun;
    this.cache.set(run.runId, { run: safeRun, expiresAt: Date.now() + this.cacheTtlMs });

    const repo = this.repo;
    if (repo) {
      // Optimistic, regression-guarded write: only overwrite if our version is current.
      const expectedVersion = await repo.getVersion(run.runId);
      if (expectedVersion < 0) {
        await repo.save(safeRun);
        return;
      }
      const ok = await repo.saveIfVersion(safeRun, expectedVersion);
      if (!ok) {
        // Another instance advanced the run; drop our cache so the next read refreshes.
        this.cache.delete(run.runId);
      }
      return;
    }

    await this.store.put(this.key(run.runId), safeRun);
    await this.appendToIndex(run.runId);
  }

  private async getIndex(): Promise<string[]> {
    const index = await this.store.get(this.indexKey);
    return Array.isArray(index) ? index.filter((item): item is string => typeof item === 'string') : [];
  }

  private async appendToIndex(runId: string): Promise<void> {
    const index = await this.getIndex();
    if (index.includes(runId)) return;
    await this.store.put(this.indexKey, [...index, runId]);
  }

  private key(runId: string): string {
    return `${this.keyPrefix}${runId}`;
  }
}

// --- Helpers ---

function guardRunUpdatePatch(current: AgentRun, patch: Partial<AgentRun>): Partial<AgentRun> {
  if (!patch.status || patch.status === current.status) return patch;
  const decision = evaluateRunStatusTransition(current.status, patch.status, 'manual_status_update');
  if (decision.accepted) return patch;

  const guardedPatch = { ...patch };
  delete guardedPatch.status;
  guardedPatch.metadata = appendRejectedRunStatusTransitionMetadata(
    { ...(current.metadata ?? {}), ...(patch.metadata ?? {}) },
    decision,
    new Date().toISOString()
  );
  return guardedPatch;
}

function toJsonSafeValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value == null) return value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'function' || typeof value === 'symbol') return undefined;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack
    };
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) return '[Circular]';
    seen.add(value);
    const result = value.map((item) => toJsonSafeValue(item, seen));
    seen.delete(value);
    return result;
  }
  if (typeof value === 'object') {
    if (seen.has(value)) return '[Circular]';
    seen.add(value);
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const safeChild = toJsonSafeValue(child, seen);
      if (safeChild !== undefined) result[key] = safeChild;
    }
    seen.delete(value);
    return result;
  }
  return String(value);
}

function extractAgentId(spec: AgentRunSpec): string | undefined {
  return spec.agentDef?.id || spec.temporaryAgentDef?.id || (spec.metadata?.agentId as string | undefined);
}

function applyEventToRun(run: AgentRun, event: AgentEvent): void {
  if (!applyRunStatusTransition(run, event)) return;

  switch (event.type) {
    case 'run_queued':
      run.status = 'queued';
      break;
    case 'run_started':
      run.status = 'running';
      break;
    case 'run_finished':
      run.status = event.payload.status === 'cancelled' ? 'cancelled' : 'succeeded';
      run.finishedAt = event.timestamp;
      run.durationMs = event.payload.durationMs;
      run.output = event.payload.output;
      run.outputPreview = event.payload.output?.content?.slice(0, 200);
      run.stopReason = event.payload.output?.stopReason;
      run.pendingPermission = undefined;
      run.pendingHitl = undefined;
      break;
    case 'run_failed':
      run.status = 'failed';
      run.finishedAt = event.timestamp;
      run.durationMs = event.payload.durationMs;
      run.error = event.payload.error;
      run.pendingPermission = undefined;
      run.pendingHitl = undefined;
      break;
    case 'run_paused':
      run.status = 'paused';
      break;
    case 'run_cancel_requested': {
      const previousStatus = event.payload.previousStatus ?? run.status;
      run.status = event.payload.status ?? 'cancelling';
      run.metadata = {
        ...run.metadata,
        previousStatus,
        cancelRequestedAt: event.timestamp,
        cancelReason: event.payload.reason
      };
      break;
    }
    case 'run_cancelled':
      run.status = 'cancelled';
      run.finishedAt = event.timestamp;
      run.durationMs = event.payload.durationMs;
      run.stopReason = event.payload.reason;
      run.pendingPermission = undefined;
      run.pendingHitl = undefined;
      break;
    case 'run_archived':
      run.status = 'archived';
      run.pendingPermission = undefined;
      run.pendingHitl = undefined;
      run.metadata = {
        ...run.metadata,
        archivedAt: event.timestamp,
        archivedReason: event.payload.reason,
        archivedPreviousStatus: event.payload.previousStatus
      };
      break;
    case 'run_resumed':
      run.status = 'running';
      break;
    case 'model_finished':
      run.roundCount++;
      break;
    case 'tool_call_requested':
      run.toolCallCount++;
      break;
    case 'tool_finished':
      break;
    case 'permission_required':
      if (isRunClosedForRuntimeState(run.status)) break;
      run.pendingPermission = event.payload;
      break;
    case 'permission_resolved':
      if (isRunClosedForRuntimeState(run.status)) break;
      if (event.payload.effect !== 'ask') {
        run.pendingPermission = undefined;
        if (run.pendingHitl?.permissionId === event.payload.permissionId) {
          run.pendingHitl = undefined;
        }
      }
      break;
    case 'hitl_required':
      if (isRunClosedForRuntimeState(run.status)) break;
      run.pendingHitl = {
        ...event.payload,
        status: 'pending',
        createdAt: event.payload.createdAt ?? event.timestamp
      };
      break;
    case 'hitl_resolved':
      if (isRunClosedForRuntimeState(run.status)) break;
      if (run.pendingHitl?.requestId === event.payload.requestId) {
        run.pendingHitl = undefined;
      }
      run.metadata = {
        ...run.metadata,
        lastHitlResolution: {
          ...event.payload,
          status: 'resolved',
          resolvedAt: event.payload.resolvedAt ?? event.timestamp
        }
      };
      break;
    case 'checkpoint_saved':
      if (isRunClosedForRuntimeState(run.status)) break;
      run.checkpointCount++;
      if (run.pendingHitl && isCheckpointForPendingHitl(run.pendingHitl, event.payload)) {
        run.pendingHitl = {
          ...run.pendingHitl,
          checkpointId: event.payload.checkpointId
        };
      }
      break;
    case 'artifact_saved':
      run.artifactCount++;
      break;
  }
}

function applyRunStatusTransition(run: AgentRun, event: AgentEvent): boolean {
  const decision = evaluateRunEventStatusTransition(run.status, event);
  if (!decision || decision.accepted) return true;
  run.metadata = appendRejectedRunStatusTransitionMetadata(run.metadata, decision, event.timestamp);
  return false;
}

function isRunClosedForRuntimeState(status: AgentRun['status']): boolean {
  return status === 'cancelling' || status === 'succeeded' || status === 'failed' || status === 'cancelled' || status === 'archived';
}

function isCheckpointForPendingHitl(
  pendingHitl: AgentHitlRequest,
  payload: { permissionId?: string; requestId?: string }
): boolean {
  return Boolean(
    (payload.requestId && pendingHitl.requestId === payload.requestId) ||
      (payload.permissionId && pendingHitl.permissionId === payload.permissionId)
  );
}

function applyFilter(items: AgentRun[], filter?: AgentRunFilter): AgentRun[] {
  if (!filter) return items;

  return items.filter((run) => {
    if (filter.agentId && run.agentId !== filter.agentId) return false;
    if (filter.workflowId && run.workflowId !== filter.workflowId) return false;

    if (filter.source) {
      const sources = Array.isArray(filter.source) ? filter.source : [filter.source];
      if (!sources.includes(run.source)) return false;
    }

    if (filter.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      if (!statuses.includes(run.status)) return false;
    }

    if (filter.createdAfter && run.createdAt < filter.createdAfter) return false;
    if (filter.createdBefore && run.createdAt > filter.createdBefore) return false;
    const runHasPendingPermission = hasPendingPermission(run);
    if (filter.pendingPermission === true && !runHasPendingPermission) return false;
    if (filter.pendingPermission === false && runHasPendingPermission) return false;

    if (filter.search) {
      const q = filter.search.toLowerCase();
      const searchable = [run.runId, run.sessionId, run.agentId, run.workflowId]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!searchable.includes(q)) return false;
    }

    return true;
  });
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

function applySort(items: AgentRun[], sort?: AgentRunSortField): AgentRun[] {
  const field = sort?.field ?? 'createdAt';
  const order = sort?.order ?? 'desc';
  const dir = order === 'asc' ? 1 : -1;

  return items.sort((a, b) => {
    const av = a[field] ?? '';
    const bv = b[field] ?? '';
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });
}