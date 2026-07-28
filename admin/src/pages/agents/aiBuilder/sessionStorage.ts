/**
 * B7 第一步：从 AiBuilderPanel.tsx 抽出"会话持久化"层。
 *
 * 这一层负责：
 *  - localStorage 中的会话元数据（按 token 配额压缩）
 *  - IndexedDB 中的大体积 artifact（plan/draft/dryRun snapshots、build log）
 *  - 加载时合并：localStorage 摘要 + IndexedDB hydration
 *
 * 之所以双重存储：浏览器 localStorage 在 5MB 上线，单个 plan 都可能 ~200KB；
 * 因此把"展示用摘要"留在 localStorage，把"原始结构"另存到 IndexedDB。
 *
 * 该模块**完全无 React 依赖**，方便后续迁到 Worker 或 IndexedDB 改用 idb 库。
 */
import type {
  AiBuildApplyResult,
  AiBuildChatMessage,
  AiBuildDryRunResult,
  AiBuildPlan,
  AiBuilderMention,
  BuilderCheckpoint,
  BuilderContextMemory,
  BuilderMode,
  BuilderStateGraph,
  CapabilityGraph,
  PlanContract,
  PlanDraft,
  PlanLineage,
  PlanQuestion,
  PlanningQuestion
} from '../../../services/agentService';

export const STORAGE_KEY = 'linkloom.aiBuilder.sessions.v1';
export const ARTIFACT_DB_NAME = 'linkloom.aiBuilder.artifacts';
export const ARTIFACT_DB_VERSION = 1;
export const ARTIFACT_STORE_NAME = 'artifacts';
export const MAX_SESSIONS = 30;
export const SUMMARY_TOKEN_LIMIT = 9000;

export type ChatMessageKind =
  | 'text'
  | 'plan_artifact'
  | 'plan_artifact_pending'
  | 'planning_artifact'
  | 'planning_artifact_pending'
  | 'questions_artifact';

export type ChatMessage = AiBuildChatMessage & {
  id: string;
  pending?: boolean;
  kind?: ChatMessageKind;
  questions?: Array<string | PlanQuestion | PlanningQuestion>;
  draftSnapshot?: PlanDraft;
  draftVersion?: number;
  planSnapshot?: AiBuildPlan;
  planVersion?: number;
  collapsed?: boolean;
  superseded?: boolean;
  buildLog?: string[];
  buildResult?: AiBuildApplyResult;
  buildError?: string;
  dryRun?: AiBuildDryRunResult;
};

export interface AiBuilderSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  mentions: AiBuilderMention[];
  draft?: string;
  draftMentions?: AiBuilderMention[];
  plan?: AiBuildPlan | null;
  activeDraft?: PlanDraft | null;
  builderMode?: BuilderMode;
  planAnswers?: Record<string, unknown>;
  contextSummary?: string;
  contextMemory?: BuilderContextMemory;
  stateGraph?: BuilderStateGraph;
  capabilityGraph?: CapabilityGraph;
  planContract?: PlanContract;
  lineage?: PlanLineage;
  checkpoints?: BuilderCheckpoint[];
  activeClarification?: {
    questions: Array<string | PlanQuestion | PlanningQuestion>;
    step: number;
  } | null;
  providerId?: string;
  model?: string;
  createdAt: number;
  updatedAt: number;
}

export interface SessionRuntime {
  isStreaming: boolean;
  isApplying: boolean;
  statusText: string;
  dryRunLoading?: boolean;
  dryRunFailed?: boolean;
  applyStep?: number;
  applyTotal?: number;
}

export interface StoredSessionArtifact {
  key: string;
  sessionId: string;
  messageId: string;
  planSnapshot?: AiBuildPlan;
  draftSnapshot?: PlanDraft;
  dryRun?: AiBuildDryRunResult;
  buildResult?: AiBuildApplyResult;
  buildError?: string;
  buildLog?: string[];
  updatedAt: number;
}

export const PENDING_ARTIFACT_KINDS: ChatMessageKind[] = [
  'plan_artifact_pending',
  'planning_artifact_pending'
];

export function withoutPendingArtifacts(messages: ChatMessage[]) {
  return messages.filter(
    (message) => !message.kind || !PENDING_ARTIFACT_KINDS.includes(message.kind)
  );
}

export function withoutPendingArtifactIds(messages: ChatMessage[], ids: Array<string | null | undefined>) {
  const pendingIds = new Set(ids.filter(Boolean));
  if (pendingIds.size === 0) return messages;
  return messages.filter(
    (message) =>
      !pendingIds.has(message.id) ||
      !message.kind ||
      !PENDING_ARTIFACT_KINDS.includes(message.kind)
  );
}

export function latestArtifactMessageId(
  messages: ChatMessage[],
  kind: 'planning_artifact' | 'plan_artifact'
) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.kind !== kind) continue;
    if (kind === 'planning_artifact' && message.draftSnapshot) return message.id;
    if (kind === 'plan_artifact' && message.planSnapshot) return message.id;
  }
  return null;
}

export function collapseOlderDraftArtifacts(messages: ChatMessage[], keepMessageId: string) {
  return messages.map((message) =>
    message.kind === 'planning_artifact' && message.id !== keepMessageId
      ? { ...message, collapsed: true, superseded: true }
      : message
  );
}

export function collapseOlderPlanArtifacts(messages: ChatMessage[], keepMessageId: string) {
  return messages.map((message) => {
    if (message.kind !== 'plan_artifact' || message.id === keepMessageId) return message;
    return { ...message, collapsed: true, superseded: true };
  });
}

export function collapseAllDraftArtifacts(messages: ChatMessage[]) {
  return messages.map((message) =>
    message.kind === 'planning_artifact' ? { ...message, collapsed: true } : message
  );
}

export function normalizeArtifactCollapseState(messages: ChatMessage[]) {
  const latestDraftId = latestArtifactMessageId(messages, 'planning_artifact');
  const latestPlanId = latestArtifactMessageId(messages, 'plan_artifact');
  return messages.map((message) => {
    if (
      message.kind === 'planning_artifact' &&
      message.draftSnapshot &&
      latestDraftId &&
      message.id !== latestDraftId
    ) {
      return { ...message, collapsed: true, superseded: true };
    }
    if (
      message.kind === 'plan_artifact' &&
      message.planSnapshot &&
      latestPlanId &&
      message.id !== latestPlanId
    ) {
      return { ...message, collapsed: true, superseded: true };
    }
    if (message.kind === 'planning_artifact' && message.id === latestDraftId) {
      return { ...message, superseded: false };
    }
    if (message.kind === 'plan_artifact' && message.id === latestPlanId) {
      return { ...message, superseded: false };
    }
    return message;
  });
}

export function readSessions(): AiBuilderSession[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.map((session) => {
      const messages: ChatMessage[] = Array.isArray(session.messages) ? session.messages : [];
      const hasPlanArtifact = messages.some((message) => message.kind === 'plan_artifact');
      const migratedMessages: ChatMessage[] =
        session.plan && !hasPlanArtifact
          ? [
              ...messages,
              {
                id: `plan_${session.plan.id || Date.now()}`,
                role: 'assistant' as const,
                content: session.plan.summary || '计划单',
                kind: 'plan_artifact' as const,
                planSnapshot: session.plan,
                planVersion: session.plan.version || 1,
                collapsed: true
              }
            ]
          : messages;
      const restoredMessages = normalizeArtifactCollapseState(
        migratedMessages.map((message) => {
          if (
            message.kind !== 'plan_artifact' ||
            !message.planSnapshot ||
            message.planSnapshot.status !== 'building'
          )
            return message;
          return {
            ...message,
            buildError: message.buildError || '上次构建未正常结束，请重新构建或回到计划模式修订。',
            planSnapshot: { ...message.planSnapshot, status: 'failed' as const }
          };
        })
      );
      const hasActivePlanReview = restoredMessages.some(
        (message) => message.kind === 'plan_artifact' && message.planSnapshot && !message.superseded
      );
      const hasPendingPlanReview = restoredMessages.some(
        (message) =>
          message.kind === 'plan_artifact' &&
          message.planSnapshot &&
          !message.superseded &&
          message.planSnapshot.status !== 'applied'
      );
      return {
        ...session,
        messages: restoredMessages,
        mentions: Array.isArray(session.mentions) ? session.mentions : [],
        draft: typeof session.draft === 'string' ? session.draft : '',
        draftMentions: Array.isArray(session.draftMentions) ? session.draftMentions : [],
        builderMode:
          hasPendingPlanReview || (hasActivePlanReview && session.builderMode === 'build')
            ? 'build'
            : ['chat', 'plan'].includes(session.builderMode)
              ? session.builderMode
              : 'chat',
        planAnswers:
          session.planAnswers && typeof session.planAnswers === 'object' ? session.planAnswers : {},
        contextMemory:
          session.contextMemory && typeof session.contextMemory === 'object'
            ? session.contextMemory
            : undefined,
        stateGraph:
          session.stateGraph && typeof session.stateGraph === 'object'
            ? session.stateGraph
            : undefined,
        capabilityGraph:
          session.capabilityGraph && typeof session.capabilityGraph === 'object'
            ? session.capabilityGraph
            : undefined,
        planContract:
          session.planContract && typeof session.planContract === 'object'
            ? session.planContract
            : undefined,
        lineage:
          session.lineage && typeof session.lineage === 'object' ? session.lineage : undefined,
        checkpoints: Array.isArray(session.checkpoints)
          ? session.checkpoints.map((checkpoint: any) => ({
              ...checkpoint,
              createdAt:
                typeof checkpoint.createdAt === 'number'
                  ? new Date(checkpoint.createdAt).toISOString()
                  : checkpoint.createdAt
            }))
          : [],
        activeDraft:
          session.activeDraft && typeof session.activeDraft === 'object'
            ? session.activeDraft
            : null,
        plan: null
      };
    });
  } catch {
    return [];
  }
}

export function writeSessions(sessions: AiBuilderSession[]) {
  const pruned = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_SESSIONS);
  void persistSessionArtifacts(pruned);
  const summarized = summarizeSessionsForLocalStorage(pruned);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(summarized));
    return;
  } catch {
    const compacted = summarizeSessionsForLocalStorage(
      pruned.slice(0, Math.max(5, Math.floor(MAX_SESSIONS / 2)))
    );
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(compacted));
    } catch {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(
            compacted.slice(0, 3).map((session) => ({
              id: session.id,
              title: session.title,
              messages: session.messages.map((message) => ({
                id: message.id,
                role: message.role,
                content: message.content.slice(0, 500),
                kind: message.kind,
                planVersion: message.planVersion,
                draftVersion: message.draftVersion,
                collapsed: message.collapsed,
                superseded: message.superseded
              })),
              mentions: session.mentions,
              draft: session.draft?.slice(0, 1000),
              builderMode: session.builderMode,
              createdAt: session.createdAt,
              updatedAt: session.updatedAt
            }))
          )
        );
      } catch {
        // localStorage 完全不可用时（隐私模式 / 配额耗尽），保留 panel 可用性。
      }
    }
  }
}

export function summarizeSessionsForLocalStorage(sessions: AiBuilderSession[]): AiBuilderSession[] {
  return sessions.map((session) => ({
    ...session,
    messages: session.messages.map((message) => ({
      ...message,
      content: message.content.slice(0, message.kind ? 1000 : 5000),
      planSnapshot: message.planSnapshot ? compactPlanForStorage(message.planSnapshot) : undefined,
      draftSnapshot: message.draftSnapshot
        ? compactDraftForStorage(message.draftSnapshot)
        : undefined,
      dryRun: message.dryRun ? compactDryRunForStorage(message.dryRun) : undefined,
      buildLog: message.buildLog?.slice(-8)
    })),
    plan: session.plan ? compactPlanForStorage(session.plan) : null,
    activeDraft: session.activeDraft ? compactDraftForStorage(session.activeDraft) : null,
    capabilityGraph: undefined,
    contextMemory: session.contextMemory
      ? {
          ...session.contextMemory,
          recentTurns: session.contextMemory.recentTurns?.slice(-6) || []
        }
      : undefined
  }));
}

export function compactDryRunForStorage(dryRun: AiBuildDryRunResult): AiBuildDryRunResult {
  return {
    ...dryRun,
    sanitizedPlan: undefined,
    changes: dryRun.changes.slice(0, 40).map((change) => ({
      ...change,
      fieldChanges: []
    }))
  };
}

export function compactPlanForStorage(plan: AiBuildPlan): AiBuildPlan {
  return {
    ...plan,
    resourceChanges: [],
    workflowPlan: undefined,
    dryRun: plan.dryRun ? compactDryRunForStorage(plan.dryRun) : undefined,
    capabilityGraph: undefined
  };
}

export function compactDraftForStorage(draft: PlanDraft): PlanDraft {
  return {
    ...draft,
    capabilityGraph: undefined
  };
}

export function openArtifactDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = indexedDB.open(ARTIFACT_DB_NAME, ARTIFACT_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ARTIFACT_STORE_NAME)) {
        db.createObjectStore(ARTIFACT_STORE_NAME, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

export function artifactKey(sessionId: string, messageId: string) {
  return `${sessionId}:${messageId}`;
}

export async function persistSessionArtifacts(sessions: AiBuilderSession[]) {
  const db = await openArtifactDb();
  if (!db) return;
  const artifacts: StoredSessionArtifact[] = sessions.flatMap((session) =>
    session.messages
      .filter(
        (message) =>
          message.planSnapshot ||
          message.draftSnapshot ||
          message.dryRun ||
          message.buildResult ||
          message.buildError ||
          message.buildLog?.length
      )
      .map((message) => ({
        key: artifactKey(session.id, message.id),
        sessionId: session.id,
        messageId: message.id,
        planSnapshot: message.planSnapshot,
        draftSnapshot: message.draftSnapshot,
        dryRun: message.dryRun,
        buildResult: message.buildResult,
        buildError: message.buildError,
        buildLog: message.buildLog,
        updatedAt: session.updatedAt
      }))
  );
  if (artifacts.length === 0) {
    db.close();
    return;
  }
  await new Promise<void>((resolve) => {
    const tx = db.transaction(ARTIFACT_STORE_NAME, 'readwrite');
    const store = tx.objectStore(ARTIFACT_STORE_NAME);
    artifacts.forEach((artifact) => store.put(artifact));
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
    tx.onabort = () => resolve();
  });
  db.close();
}

export async function hydrateSessionsFromArtifacts(
  sessions: AiBuilderSession[]
): Promise<AiBuilderSession[]> {
  const db = await openArtifactDb();
  if (!db) return sessions;
  const keys = sessions.flatMap((session) =>
    session.messages.map((message) => artifactKey(session.id, message.id))
  );
  if (keys.length === 0) {
    db.close();
    return sessions;
  }
  const artifacts = await new Promise<Map<string, StoredSessionArtifact>>((resolve) => {
    const tx = db.transaction(ARTIFACT_STORE_NAME, 'readonly');
    const store = tx.objectStore(ARTIFACT_STORE_NAME);
    const loaded = new Map<string, StoredSessionArtifact>();
    keys.forEach((key) => {
      const request = store.get(key);
      request.onsuccess = () => {
        if (request.result) loaded.set(key, request.result as StoredSessionArtifact);
      };
    });
    tx.oncomplete = () => resolve(loaded);
    tx.onerror = () => resolve(loaded);
    tx.onabort = () => resolve(loaded);
  });
  db.close();
  if (artifacts.size === 0) return sessions;
  return sessions.map((session) => ({
    ...session,
    messages: session.messages.map((message) => {
      const artifact = artifacts.get(artifactKey(session.id, message.id));
      return artifact
        ? {
            ...message,
            planSnapshot: artifact.planSnapshot || message.planSnapshot,
            draftSnapshot: artifact.draftSnapshot || message.draftSnapshot,
            dryRun: artifact.dryRun || message.dryRun,
            buildResult: artifact.buildResult || message.buildResult,
            buildError: artifact.buildError || message.buildError,
            buildLog: artifact.buildLog || message.buildLog
          }
        : message;
    })
  }));
}
