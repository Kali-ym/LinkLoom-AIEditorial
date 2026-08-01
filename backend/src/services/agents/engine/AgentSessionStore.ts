import type { LocalStore } from '../../LocalStore.js';
import type { StoreRepositories } from '../../repositories/StoreRepositories.js';
import type { AgentEvent, AgentHitlRequest } from './AgentEvent.js';
import type { AgentRunOutput, AgentRunSpec, AgentRunStatus } from './AgentRunSpec.js';
import {
  appendRejectedRunStatusTransitionMetadata,
  evaluateRunEventStatusTransition,
  evaluateRunStatusTransition
} from './AgentRunStateMachine.js';
import type { AgentCheckpoint, AgentSession, AgentArtifactRef } from './AgentSession.js';
import { preserveRunContextMetadata } from './AgentSession.js';
import type { PermissionDecision, PermissionRequest } from './PermissionPolicy.js';
import type { WorkspaceRef } from './WorkspacePolicy.js';
import { resolvePersistedRunMessages } from '../managers/AgentRunManager.js';

export interface AgentSessionStore {
  createSession(spec: AgentRunSpec): Promise<AgentSession>;
  getSession(sessionId: string): Promise<AgentSession | null>;
  getSessionByRunId(runId: string): Promise<AgentSession | null>;
  getSessionsBySessionId(sessionId: string): Promise<AgentSession[]>;
  getSessionsByThreadId(threadId: string): Promise<AgentSession[]>;
  listSessions(): Promise<AgentSession[]>;
  saveSession(session: AgentSession): Promise<void>;
  appendEvent(event: AgentEvent): Promise<AgentEvent>;
  saveArtifact(sessionId: string, artifact: AgentArtifactRef, runId?: string): Promise<void>;
  updateWorkspace(sessionId: string, workspace?: WorkspaceRef, runId?: string): Promise<void>;
  saveCheckpoint(sessionId: string, checkpoint: AgentCheckpoint): Promise<void>;
  updateOutput(sessionId: string, output: AgentRunOutput, runId?: string): Promise<void>;
  updateStatus(sessionId: string, status: AgentRunStatus, runId?: string): Promise<void>;
  setPendingPermission(sessionId: string, request?: PermissionRequest): Promise<void>;
  setPendingHitl(sessionId: string, request?: AgentHitlRequest, runId?: string): Promise<void>;
  resolvePermission(sessionId: string, decision: PermissionDecision): Promise<void>;
}

type SessionScope = {
  sessionId: string;
  runId: string;
};

export class InMemoryAgentSessionStore implements AgentSessionStore {
  private readonly sessionsByRunId = new Map<string, AgentSession>();
  private readonly runIdsBySessionId = new Map<string, Set<string>>();
  private readonly runIdsByThreadId = new Map<string, Set<string>>();

  async createSession(spec: AgentRunSpec): Promise<AgentSession> {
    const existing = this.sessionsByRunId.get(spec.runId);
    if (existing) return cloneSession(existing);

    const now = new Date().toISOString();
    const session: AgentSession = {
      sessionId: spec.sessionId,
      runId: spec.runId,
      threadId: spec.threadId,
      source: spec.source,
      status: 'queued',
      messages: resolvePersistedRunMessages(spec.input.messages ?? []) ?? [],
      events: [],
      checkpoints: [],
      artifacts: [],
      createdAt: now,
      updatedAt: now,
      metadata: preserveRunContextMetadata(spec.metadata)
    };
    await this.saveSession(session);
    return cloneSession(session);
  }

  async getSession(sessionId: string): Promise<AgentSession | null> {
    const sessions = await this.getSessionsBySessionId(sessionId);
    if (sessions.length > 0) return createSessionAggregate(sessionId, sessions);

    const legacySession = this.sessionsByRunId.get(sessionId);
    return legacySession ? cloneSession(legacySession) : null;
  }

  async getSessionByRunId(runId: string): Promise<AgentSession | null> {
    const session = this.sessionsByRunId.get(runId);
    return session ? cloneSession(session) : null;
  }

  async getSessionsBySessionId(sessionId: string): Promise<AgentSession[]> {
    const runIds = this.runIdsBySessionId.get(sessionId);
    if (!runIds) return [];
    return [...runIds]
      .flatMap((runId) => {
        const session = this.sessionsByRunId.get(runId);
        return session ? [cloneSession(session)] : [];
      })
      .sort(compareSessionByCreatedAt);
  }

  async getSessionsByThreadId(threadId: string): Promise<AgentSession[]> {
    const runIds = this.runIdsByThreadId.get(threadId);
    if (!runIds) return [];
    return [...runIds]
      .flatMap((runId) => {
        const session = this.sessionsByRunId.get(runId);
        return session ? [cloneSession(session)] : [];
      })
      .sort(compareSessionByCreatedAt);
  }

  async listSessions(): Promise<AgentSession[]> {
    return [...this.sessionsByRunId.values()]
      .map((session) => cloneSession(session))
      .sort(compareSessionByCreatedAt);
  }

  async saveSession(session: AgentSession): Promise<void> {
    const next = { ...session, updatedAt: new Date().toISOString() };
    this.indexSession(next);
  }

  /**
   * Store a session into the in-memory maps + indexes without bumping `updatedAt`.
   * `saveSession` bumps the timestamp; hydration paths reuse this to seed the cache
   * while preserving the persisted timestamps.
   */
  protected indexSession(session: AgentSession): void {
    const next = cloneSession(session);
    this.sessionsByRunId.set(next.runId, next);

    const runIdsForSession = this.runIdsBySessionId.get(next.sessionId) ?? new Set<string>();
    runIdsForSession.add(next.runId);
    this.runIdsBySessionId.set(next.sessionId, runIdsForSession);

    if (next.threadId) {
      const runIdsForThread = this.runIdsByThreadId.get(next.threadId) ?? new Set<string>();
      runIdsForThread.add(next.runId);
      this.runIdsByThreadId.set(next.threadId, runIdsForThread);
    }
  }

  async appendEvent(event: AgentEvent): Promise<AgentEvent> {
    const session = await this.getSessionByRunId(event.runId);
    if (!session) return event;
    applyEventToSession(session, event);
    await this.saveSession(session);
    return event;
  }

  async saveArtifact(sessionId: string, artifact: AgentArtifactRef, runId?: string): Promise<void> {
    const session = await this.resolveWritableSession({ sessionId, runId });
    if (!session) return;
    session.artifacts = upsertArtifact(session.artifacts, artifact);
    await this.saveSession(session);
  }

  async updateWorkspace(sessionId: string, workspace?: WorkspaceRef, runId?: string): Promise<void> {
    const session = await this.resolveWritableSession({ sessionId, runId });
    if (!session) return;
    session.workspace = workspace;
    await this.saveSession(session);
  }

  async saveCheckpoint(sessionId: string, checkpoint: AgentCheckpoint): Promise<void> {
    const session = await this.resolveWritableSession({ sessionId, runId: checkpoint.runId });
    if (!session) return;
    const decision = evaluateRunStatusTransition(session.status, checkpoint.status, 'checkpoint_status');
    if (!decision.accepted) {
      session.metadata = appendRejectedRunStatusTransitionMetadata(
        session.metadata,
        decision,
        checkpoint.createdAt
      );
      await this.saveSession(session);
      return;
    }
    session.checkpoints = [...session.checkpoints, checkpoint];
    session.pendingPermission = checkpoint.pendingPermission ?? session.pendingPermission;
    session.pendingHitl = checkpoint.pendingHitl ?? session.pendingHitl;
    session.status = checkpoint.status;
    await this.saveSession(session);
  }

  async updateOutput(sessionId: string, output: AgentRunOutput, runId?: string): Promise<void> {
    const session = await this.resolveWritableSession({ sessionId, runId });
    if (!session) return;
    session.output = output;
    await this.saveSession(session);
  }

  async updateStatus(sessionId: string, status: AgentRunStatus, runId?: string): Promise<void> {
    const session = await this.resolveWritableSession({ sessionId, runId });
    if (!session) return;
    const decision = evaluateRunStatusTransition(session.status, status, 'manual_status_update');
    if (!decision.accepted) {
      session.metadata = appendRejectedRunStatusTransitionMetadata(
        session.metadata,
        decision,
        new Date().toISOString()
      );
      await this.saveSession(session);
      return;
    }
    session.status = status;
    if (status === 'failed' || status === 'cancelled' || status === 'succeeded') {
      session.pendingPermission = undefined;
      session.pendingHitl = undefined;
    }
    await this.saveSession(session);
  }

  async setPendingPermission(sessionId: string, request?: PermissionRequest): Promise<void> {
    const session = await this.resolveWritableSession({ sessionId, runId: request?.runId });
    if (!session) return;
    if (isSessionClosedForRuntimeState(session.status)) return;
    session.pendingPermission = request;
    await this.saveSession(session);
  }

  async setPendingHitl(sessionId: string, request?: AgentHitlRequest, runId?: string): Promise<void> {
    const session = await this.resolveWritableSession({ sessionId, runId });
    if (!session) return;
    if (isSessionClosedForRuntimeState(session.status)) return;
    session.pendingHitl = request;
    await this.saveSession(session);
  }

  async resolvePermission(sessionId: string, decision: PermissionDecision): Promise<void> {
    const session = await this.resolveSessionByPermission(sessionId, decision.permissionId);
    if (!session) return;
    if (isSessionClosedForRuntimeState(session.status)) return;
    session.metadata = {
      ...session.metadata,
      lastPermissionDecision: decision
    };
    if (decision.effect !== 'ask') {
      session.pendingPermission = undefined;
      if (session.pendingHitl?.permissionId === decision.permissionId) {
        session.pendingHitl = undefined;
      }
    }
    await this.saveSession(session);
  }

  private async resolveWritableSession(scope: Partial<SessionScope>): Promise<AgentSession | null> {
    if (scope.runId) {
      const byRun = await this.getSessionByRunId(scope.runId);
      if (byRun) return byRun;
    }
    const sessions = scope.sessionId ? await this.getSessionsBySessionId(scope.sessionId) : [];
    return sessions.at(-1) ?? null;
  }

  private async resolveSessionByPermission(
    sessionId: string,
    permissionId: string
  ): Promise<AgentSession | null> {
    const sessions = await this.getSessionsBySessionId(sessionId);
    return (
      sessions.find((session) => session.pendingPermission?.permissionId === permissionId) ??
      sessions.find((session) => session.pendingHitl?.permissionId === permissionId) ??
      sessions.at(-1) ??
      null
    );
  }
}

export class LocalStoreAgentSessionStore extends InMemoryAgentSessionStore {
  private readonly sessionKeyPrefix = 'agent_session:';
  private readonly runKeyPrefix = 'agent_session_run_record:';
  private readonly runIndexKeyPrefix = 'agent_session_run:';
  private readonly sessionIndexKeyPrefix = 'agent_session_group:';
  private readonly threadIndexKeyPrefix = 'agent_session_thread:';
  private readonly indexKey = 'agent_session_index';

  constructor(private readonly store: LocalStore) {
    super();
  }

  /**
   * Table-backed repositories when running against a real store. Undefined when the
   * store is a unit-test mock without `repositories`, in which case we fall back to the
   * legacy KV-blob read/write path.
   */
  private get repos(): StoreRepositories | undefined {
    return (this.store as { repositories?: StoreRepositories }).repositories;
  }

  /** Expose the table-backed repositories (when present) for incremental event reads. */
  storeRepositories(): StoreRepositories | undefined {
    return this.repos;
  }

  override async getSession(sessionId: string): Promise<AgentSession | null> {
    const repos = this.repos;
    if (repos) {
      const runIds = await repos.agentSessions.getRunIdsBySessionId(sessionId);
      for (const runId of runIds) {
        await this.getSessionByRunId(runId);
      }
      const hydrated = await super.getSession(sessionId);
      if (hydrated) return hydrated;
    } else {
      const cached = await super.getSession(sessionId);
      if (cached) return cached;
    }

    const runIds = await this.getSessionRunIndex(sessionId);
    for (const runId of runIds) {
      await this.getSessionByRunId(runId);
    }
    const hydrated = await super.getSession(sessionId);
    if (hydrated) return hydrated;

    const legacySession = await this.store.get(this.sessionKey(sessionId));
    if (!legacySession) return null;
    this.indexSession(legacySession as AgentSession);
    return cloneSession(legacySession as AgentSession);
  }

  override async getSessionByRunId(runId: string): Promise<AgentSession | null> {
    const repos = this.repos;
    if (repos) {
      const head = await repos.agentSessions.getHeadByRunId(runId);
      if (head) {
        const [events, checkpoints, artifacts] = await Promise.all([
          repos.agentEvents.listByRun(runId),
          repos.agentSessions.listCheckpoints(runId),
          repos.agentSessions.listArtifacts(runId)
        ]);
        const session: AgentSession = { ...head, events, checkpoints, artifacts };
        this.indexSession(session);
        return cloneSession(session);
      }
    } else {
      const cached = await super.getSessionByRunId(runId);
      if (cached) return cached;
    }

    const storedByRun = await this.store.get(this.runKey(runId));
    if (storedByRun) {
      this.indexSession(storedByRun as AgentSession);
      return cloneSession(storedByRun as AgentSession);
    }

    const legacySessionId = await this.store.get(this.runIndexKey(runId));
    if (!legacySessionId || typeof legacySessionId !== 'string') return null;
    const legacySession = await this.store.get(this.sessionKey(legacySessionId));
    if (!legacySession) return null;
    this.indexSession(legacySession as AgentSession);
    return cloneSession(legacySession as AgentSession);
  }

  override async getSessionsByThreadId(threadId: string): Promise<AgentSession[]> {
    const repos = this.repos;
    if (repos) {
      const runIds = await repos.agentSessions.getRunIdsByThreadId(threadId);
      for (const runId of runIds) {
        await this.getSessionByRunId(runId);
      }
      const hydrated = await super.getSessionsByThreadId(threadId);
      if (hydrated.length > 0) return hydrated;
    } else {
      const cached = await super.getSessionsByThreadId(threadId);
      if (cached.length > 0) return cached;
    }

    const runIds = await this.getThreadIndex(threadId);
    for (const runId of runIds) {
      await this.getSessionByRunId(runId);
    }
    return super.getSessionsByThreadId(threadId);
  }

  override async listSessions(): Promise<AgentSession[]> {
    const repos = this.repos;
    if (repos) {
      const runIds = await repos.agentSessions.listRunIds();
      for (const runId of runIds) {
        await this.getSessionByRunId(runId);
      }
      const fromTables = await super.listSessions();
      if (fromTables.length > 0) return fromTables;
    }

    const index = await this.getIndex();
    for (const runId of index) {
      await this.getSessionByRunId(runId);
    }
    return super.listSessions();
  }

  override async appendEvent(event: AgentEvent): Promise<AgentEvent> {
    const repos = this.repos;
    if (!repos) {
      await super.appendEvent(event);
      return event;
    }

    // Hydrate the pre-append head first. If the process has a cold cache, hydrating after
    // the INSERT would make the new event look like historical backlog and double-apply it.
    await this.getSessionByRunId(event.runId);
    const result = await repos.agentEvents.appendEventAllocatingSequenceWithResult(event);
    if (!result.inserted) return result.event;

    // Applies the event to the in-memory head and persists the (event-free) head row.
    await super.appendEvent(result.event);
    return result.event;
  }

  override async saveSession(session: AgentSession): Promise<void> {
    const next = { ...session, updatedAt: new Date().toISOString() };
    this.indexSession(next);

    const repos = this.repos;
    if (repos) {
      await this.persistToTables(next, repos);
      return;
    }

    await this.persistToKv(next);
  }

  /**
   * Persist the session head (without the event log), plus checkpoints and artifacts,
   * to their dedicated tables. The head write is bounded by message count, not event
   * count — eliminating the old O(N^2) "rewrite whole session on every event" cost.
   */
  private async persistToTables(session: AgentSession, repos: StoreRepositories): Promise<void> {
    const { events, checkpoints, artifacts, ...head } = session;
    const lastSeq = maxEventSequence(events);
    await repos.agentSessions.saveHead(head, lastSeq);
    for (const checkpoint of checkpoints) {
      await repos.agentSessions.saveCheckpoint(checkpoint);
    }
    for (const artifact of artifacts) {
      await repos.agentSessions.saveArtifact(session.runId, artifact, session.sessionId);
    }
  }

  private async persistToKv(session: AgentSession): Promise<void> {
    const safeNext = cloneSession(session);
    await this.store.put(this.runKey(safeNext.runId), safeNext);
    await this.store.put(this.runIndexKey(safeNext.runId), safeNext.sessionId);
    await this.store.put(this.sessionKey(safeNext.sessionId), safeNext);
    await this.appendToSessionRunIndex(safeNext.sessionId, safeNext.runId);
    if (safeNext.threadId) {
      await this.appendToThreadIndex(safeNext.threadId, safeNext.runId);
    }
    await this.appendToIndex(safeNext.runId);
  }

  private async getIndex(): Promise<string[]> {
    const index = await this.store.get(this.indexKey);
    return Array.isArray(index) ? index.filter((item): item is string => typeof item === 'string') : [];
  }

  private async getSessionRunIndex(sessionId: string): Promise<string[]> {
    const index = await this.store.get(this.sessionIndexKey(sessionId));
    return Array.isArray(index) ? index.filter((item): item is string => typeof item === 'string') : [];
  }

  private async getThreadIndex(threadId: string): Promise<string[]> {
    const index = await this.store.get(this.threadIndexKey(threadId));
    return Array.isArray(index) ? index.filter((item): item is string => typeof item === 'string') : [];
  }

  private async appendToIndex(runId: string): Promise<void> {
    const index = await this.getIndex();
    if (index.includes(runId)) return;
    await this.store.put(this.indexKey, [...index, runId]);
  }

  private async appendToSessionRunIndex(sessionId: string, runId: string): Promise<void> {
    const index = await this.getSessionRunIndex(sessionId);
    if (index.includes(runId)) return;
    await this.store.put(this.sessionIndexKey(sessionId), [...index, runId]);
  }

  private async appendToThreadIndex(threadId: string, runId: string): Promise<void> {
    const index = await this.getThreadIndex(threadId);
    if (index.includes(runId)) return;
    await this.store.put(this.threadIndexKey(threadId), [...index, runId]);
  }

  private sessionKey(sessionId: string): string {
    return `${this.sessionKeyPrefix}${sessionId}`;
  }

  private runKey(runId: string): string {
    return `${this.runKeyPrefix}${runId}`;
  }

  private runIndexKey(runId: string): string {
    return `${this.runIndexKeyPrefix}${runId}`;
  }

  private sessionIndexKey(sessionId: string): string {
    return `${this.sessionIndexKeyPrefix}${sessionId}`;
  }

  private threadIndexKey(threadId: string): string {
    return `${this.threadIndexKeyPrefix}${threadId}`;
  }
}

function applyEventToSession(session: AgentSession, event: AgentEvent): void {
  session.events = [...session.events, event];
  session.updatedAt = new Date().toISOString();

  if (!applySessionStatusTransition(session, event)) return;

  if (event.type === 'run_queued') {
    session.status = 'queued';
    return;
  }
  if (event.type === 'run_started') {
    session.status = 'running';
    return;
  }
  if (event.type === 'run_resumed') {
    session.status = 'running';
    return;
  }
  if (event.type === 'run_paused') {
    session.status = 'paused';
    return;
  }
  if (event.type === 'run_cancel_requested') {
    const previousStatus = event.payload.previousStatus ?? session.status;
    session.status = event.payload.status ?? 'cancelling';
    session.metadata = {
      ...session.metadata,
      previousStatus,
      cancelRequestedAt: event.timestamp,
      cancelReason: event.payload.reason
    };
    return;
  }
  if (event.type === 'run_cancelled') {
    session.status = 'cancelled';
    session.pendingPermission = undefined;
    session.pendingHitl = undefined;
    return;
  }
  if (event.type === 'run_archived') {
    session.status = 'archived';
    session.pendingPermission = undefined;
    session.pendingHitl = undefined;
    session.metadata = {
      ...session.metadata,
      archivedAt: event.timestamp,
      archivedReason: event.payload.reason,
      archivedPreviousStatus: event.payload.previousStatus
    };
    return;
  }
  if (event.type === 'run_finished') {
    session.status = event.payload.status;
    session.output = event.payload.output;
    session.pendingPermission = undefined;
    session.pendingHitl = undefined;
    return;
  }
  if (event.type === 'run_failed') {
    session.status = 'failed';
    session.pendingPermission = undefined;
    session.pendingHitl = undefined;
    return;
  }
  if (event.type === 'permission_required') {
    if (isSessionClosedForRuntimeState(session.status)) return;
    session.pendingPermission = event.payload;
    return;
  }
  if (event.type === 'permission_resolved' && event.payload.effect !== 'ask') {
    if (isSessionClosedForRuntimeState(session.status)) return;
    session.pendingPermission = undefined;
    if (session.pendingHitl?.permissionId === event.payload.permissionId) {
      session.pendingHitl = undefined;
    }
    return;
  }
  if (event.type === 'hitl_required') {
    if (isSessionClosedForRuntimeState(session.status)) return;
    session.pendingHitl = {
      ...event.payload,
      status: 'pending',
      createdAt: event.payload.createdAt ?? event.timestamp
    };
    return;
  }
  if (event.type === 'hitl_resolved') {
    if (isSessionClosedForRuntimeState(session.status)) return;
    if (session.pendingHitl?.requestId === event.payload.requestId) {
      session.pendingHitl = undefined;
    }
    session.metadata = {
      ...session.metadata,
      lastHitlResolution: {
        ...event.payload,
        status: 'resolved',
        resolvedAt: event.payload.resolvedAt ?? event.timestamp
      }
    };
    return;
  }
  if (event.type === 'checkpoint_saved') {
    if (isSessionClosedForRuntimeState(session.status)) return;
    if (session.pendingHitl && isCheckpointForPendingHitl(session.pendingHitl, event.payload)) {
      session.pendingHitl = {
        ...session.pendingHitl,
        checkpointId: event.payload.checkpointId
      };
    }
    return;
  }
  if (event.type === 'artifact_saved') {
    session.artifacts = upsertArtifact(session.artifacts, {
      artifactId: event.payload.artifactId,
      kind: event.payload.kind,
      uri: event.payload.uri,
      preview: event.payload.preview,
      sizeBytes: event.payload.sizeBytes,
      createdAt: event.timestamp,
      metadata: event.payload.metadata
    });
  }
}

function applySessionStatusTransition(session: AgentSession, event: AgentEvent): boolean {
  const decision = evaluateRunEventStatusTransition(session.status, event);
  if (!decision || decision.accepted) return true;
  session.metadata = appendRejectedRunStatusTransitionMetadata(session.metadata, decision, event.timestamp);
  return false;
}

function isSessionClosedForRuntimeState(status: AgentRunStatus): boolean {
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

function maxEventSequence(events: AgentEvent[]): number {
  return events.reduce((max, event) => {
    return typeof event.sequence === 'number' && Number.isFinite(event.sequence)
      ? Math.max(max, event.sequence)
      : max;
  }, 0);
}

function compareSessionByCreatedAt(a: AgentSession, b: AgentSession): number {
  const created = a.createdAt.localeCompare(b.createdAt);
  return created !== 0 ? created : a.runId.localeCompare(b.runId);
}

function createSessionAggregate(sessionId: string, sessions: AgentSession[]): AgentSession {
  const sorted = [...sessions].sort(compareSessionByCreatedAt);
  const first = sorted[0];
  const last = sorted.at(-1) ?? first;
  const updatedAt = sorted.reduce(
    (latest, session) => (session.updatedAt > latest ? session.updatedAt : latest),
    first?.updatedAt ?? new Date().toISOString()
  );

  return {
    sessionId,
    runId: last?.runId ?? sessionId,
    threadId: last?.threadId ?? first?.threadId,
    source: last?.source ?? first?.source ?? 'agent',
    status: deriveAggregateStatus(sorted),
    messages: sorted.flatMap((session) => session.messages),
    events: sorted.flatMap((session) => session.events),
    pendingPermission: sorted.find((session) => session.pendingPermission)?.pendingPermission,
    pendingHitl: sorted.find((session) => session.pendingHitl)?.pendingHitl,
    checkpoints: sorted.flatMap((session) => session.checkpoints),
    artifacts: sorted.flatMap((session) => session.artifacts),
    output: last?.output,
    workspace: last?.workspace,
    createdAt: first?.createdAt ?? new Date().toISOString(),
    updatedAt,
    metadata: {
      ...(first?.metadata ?? {}),
      ...(last?.metadata ?? {}),
      aggregate: true,
      runIds: sorted.map((session) => session.runId)
    }
  };
}

function deriveAggregateStatus(sessions: AgentSession[]): AgentRunStatus {
  const statuses = sessions.map((session) => session.status);
  if (statuses.some((status) => status === 'running' || status === 'queued' || status === 'cancelling')) {
    return 'running';
  }
  if (statuses.some((status) => status === 'paused')) return 'paused';
  return sessions.at(-1)?.status ?? 'queued';
}

function upsertArtifact(
  artifacts: AgentArtifactRef[],
  artifact: AgentArtifactRef
): AgentArtifactRef[] {
  const existingIndex = artifacts.findIndex((item) => item.artifactId === artifact.artifactId);
  if (existingIndex < 0) return [...artifacts, artifact];
  return artifacts.map((item, index) => (index === existingIndex ? artifact : item));
}

function cloneSession(session: AgentSession): AgentSession {
  return toJsonSafeValue(session) as AgentSession;
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