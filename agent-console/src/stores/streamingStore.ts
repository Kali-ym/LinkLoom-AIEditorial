import { create } from 'zustand';

import type { QueueItem } from '../domain/types';
import { getAgentConsolePorts } from '../adapters/registry';
import { requestCancelActiveAgentRun } from '../services/streaming/cancelActiveRun';
import {
  loadInterventionSettings,
  persistInterventionSettings,
  type ApprovalMode,
} from './interventionSettingsStorage';

export type { ApprovalMode };

export const STATUS_PHRASES = [
  '正在思考…',
  '检索相关信息…',
  '调用工具中…',
  '组织回答…',
  '生成正文…',
] as const;

const initialInterventionSettings = loadInterventionSettings();

export interface ActiveRunContext {
  runId: string;
  permissionId?: string;
  hitlRequestId?: string;
  lastEventSeq?: number;
}

export interface TopicStreamRuntime {
  isStreaming: boolean;
  opTrayVisible: boolean;
  opPhrase: string;
  opElapsedMs: number;
  tokenCount: number;
  stepCount: number;
  cost: number;
  phraseIdx: number;
  streamTimerId: number | null;
  opTimerId: number | null;
  phraseRotateId: number | null;
  abortController: AbortController | null;
  activeRunContext: ActiveRunContext | null;
}

function createDefaultTopicStreamRuntime(): TopicStreamRuntime {
  return {
    isStreaming: false,
    opTrayVisible: false,
    opPhrase: STATUS_PHRASES[0],
    opElapsedMs: 0,
    tokenCount: 0,
    stepCount: 0,
    cost: 0,
    phraseIdx: 0,
    streamTimerId: null,
    opTimerId: null,
    phraseRotateId: null,
    abortController: null,
    activeRunContext: null,
  };
}

function patchTopicRuntime(
  streamsByTopicId: Record<string, TopicStreamRuntime>,
  topicId: string,
  patch: Partial<TopicStreamRuntime>,
): Record<string, TopicStreamRuntime> {
  const current = streamsByTopicId[topicId] ?? createDefaultTopicStreamRuntime();
  return {
    ...streamsByTopicId,
    [topicId]: { ...current, ...patch },
  };
}

/** Persist approval/HITL ids per topic so InterventionBar works after stream ends. */
export function mergeRunContextForTopic(
  topicId: string,
  pendingByTopicId: Record<string, ActiveRunContext>,
  activeRunContext: ActiveRunContext | null,
): ActiveRunContext | null {
  const topicCtx = pendingByTopicId[topicId];
  if (!topicCtx && !activeRunContext) return null;
  const runId = topicCtx?.runId || activeRunContext?.runId;
  if (!runId) return null;
  return {
    runId,
    permissionId: topicCtx?.permissionId ?? activeRunContext?.permissionId,
    hitlRequestId: topicCtx?.hitlRequestId ?? activeRunContext?.hitlRequestId,
  };
}

interface StreamingState {
  streamsByTopicId: Record<string, TopicStreamRuntime>;
  messageQueueByTopicId: Record<string, QueueItem[]>;
  approvalMode: ApprovalMode;
  toolAllowList: string[];
  pendingApprovalContextByTopicId: Record<string, ActiveRunContext>;
  lastEventSeqByRunId: Record<string, number>;

  getStreamRuntime: (topicId: string) => TopicStreamRuntime;
  send: (topicId: string, text: string, onComplete?: () => void) => void;
  stop: (topicId: string) => void;
  enqueue: (topicId: string, item: Omit<QueueItem, 'id'> & { id?: string }) => void;
  seedQueueDemo: (topicId: string) => void;
  dequeue: (topicId: string, id: string) => void;
  takeQueueItem: (topicId: string, id: string) => QueueItem | null;
  flushQueue: (topicId: string) => QueueItem | null;
  setOpTrayVisible: (topicId: string, visible: boolean) => void;
  setApprovalMode: (mode: ApprovalMode) => void;
  addToolToAllowList: (toolKey: string) => void;
  setActiveRunContext: (topicId: string, context: ActiveRunContext | null) => void;
  recordPendingApprovalContext: (topicId: string, context: ActiveRunContext) => void;
  clearPendingApprovalContext: (topicId: string) => void;
  getRunContextForTopic: (topicId: string) => ActiveRunContext | null;
  recordRunEventSeq: (runId: string, sequence?: number) => void;
  getLastEventSeq: (runId: string) => number;
  tickOpElapsed: (topicId: string) => void;
  rotatePhrase: (topicId: string) => void;
  addTokenCount: (topicId: string, delta: number) => void;
  clearTimers: (topicId: string) => void;
  beginStreaming: (topicId: string, options?: { preserveMetrics?: boolean }) => AbortController;
  endStreaming: (topicId: string) => void;
}

export const useStreamingStore = create<StreamingState>((set, get) => ({
  streamsByTopicId: {},
  messageQueueByTopicId: {},
  approvalMode: initialInterventionSettings.approvalMode,
  toolAllowList: initialInterventionSettings.toolAllowList,
  pendingApprovalContextByTopicId: {},
  lastEventSeqByRunId: {},

  getStreamRuntime: (topicId) => get().streamsByTopicId[topicId] ?? createDefaultTopicStreamRuntime(),

  send: (topicId, text, onComplete) => {
    if (!text.trim()) return;
    const runtime = get().getStreamRuntime(topicId);
    if (runtime.isStreaming) {
      get().enqueue(topicId, { text });
      return;
    }
    const ac = new AbortController();
    set((s) => ({
      streamsByTopicId: patchTopicRuntime(s.streamsByTopicId, topicId, {
        isStreaming: true,
        opTrayVisible: true,
        opElapsedMs: 0,
        tokenCount: 0,
        stepCount: 2,
        cost: 0.0012,
        abortController: ac,
      }),
    }));
    get().addTokenCount(topicId, 24);
    const opTimerId = window.setInterval(() => get().tickOpElapsed(topicId), 250);
    const phraseRotateId = window.setInterval(() => get().rotatePhrase(topicId), 4000);
    set((s) => ({
      streamsByTopicId: patchTopicRuntime(s.streamsByTopicId, topicId, {
        opTimerId,
        phraseRotateId,
      }),
    }));

    const timerId = window.setTimeout(() => {
      get().clearTimers(topicId);
      set((s) => ({
        streamsByTopicId: patchTopicRuntime(s.streamsByTopicId, topicId, {
          isStreaming: false,
          opTrayVisible: false,
          abortController: null,
        }),
      }));
      onComplete?.();
      const next = get().flushQueue(topicId);
      if (next) get().send(topicId, next.text, onComplete);
    }, 1200);
    set((s) => ({
      streamsByTopicId: patchTopicRuntime(s.streamsByTopicId, topicId, { streamTimerId: timerId }),
    }));
  },

  stop: (topicId) => {
    const runtime = get().getStreamRuntime(topicId);
    const pendingApproval =
      runtime.activeRunContext?.permissionId != null ||
      runtime.activeRunContext?.hitlRequestId != null;
    requestCancelActiveAgentRun(runtime.activeRunContext?.runId);
    runtime.abortController?.abort();
    get().clearTimers(topicId);
    set((s) => ({
      streamsByTopicId: patchTopicRuntime(s.streamsByTopicId, topicId, {
        isStreaming: false,
        opTrayVisible: false,
        abortController: null,
        activeRunContext: pendingApproval
          ? {
              runId: runtime.activeRunContext!.runId,
              permissionId: runtime.activeRunContext?.permissionId,
              hitlRequestId: runtime.activeRunContext?.hitlRequestId,
              lastEventSeq: runtime.activeRunContext?.lastEventSeq,
            }
          : null,
      }),
    }));
  },

  enqueue: (topicId, item) =>
    set((s) => ({
      messageQueueByTopicId: {
        ...s.messageQueueByTopicId,
        [topicId]: [
          ...(s.messageQueueByTopicId[topicId] ?? []),
          { id: item.id ?? `q-${Date.now()}`, text: item.text, filesPreview: item.filesPreview },
        ],
      },
    })),

  seedQueueDemo: (topicId) => {
    void getAgentConsolePorts()
      .runtime.getQueueDemoItems()
      .then((items: QueueItem[]) =>
        set((s) => ({
          messageQueueByTopicId: { ...s.messageQueueByTopicId, [topicId]: [...items] },
        })),
      )
      .catch(() =>
        set((s) => ({
          messageQueueByTopicId: {
            ...s.messageQueueByTopicId,
            [topicId]: [],
          },
        })),
      );
  },

  dequeue: (topicId, id) =>
    set((s) => ({
      messageQueueByTopicId: {
        ...s.messageQueueByTopicId,
        [topicId]: (s.messageQueueByTopicId[topicId] ?? []).filter((q) => q.id !== id),
      },
    })),

  takeQueueItem: (topicId, id) => {
    const item = get().messageQueueByTopicId[topicId]?.find((q) => q.id === id);
    if (!item) return null;
    set((s) => ({
      messageQueueByTopicId: {
        ...s.messageQueueByTopicId,
        [topicId]: (s.messageQueueByTopicId[topicId] ?? []).filter((q) => q.id !== id),
      },
    }));
    return item;
  },

  flushQueue: (topicId) => {
    const queue = get().messageQueueByTopicId[topicId] ?? [];
    const [first, ...rest] = queue;
    if (!first) return null;
    set((s) => ({
      messageQueueByTopicId: { ...s.messageQueueByTopicId, [topicId]: rest },
    }));
    return first;
  },

  setOpTrayVisible: (topicId, visible) =>
    set((s) => ({
      streamsByTopicId: patchTopicRuntime(s.streamsByTopicId, topicId, { opTrayVisible: visible }),
    })),

  setApprovalMode: (mode) => {
    set({ approvalMode: mode });
    const { toolAllowList } = get();
    persistInterventionSettings({ approvalMode: mode, toolAllowList });
  },

  addToolToAllowList: (toolKey) => {
    const trimmed = toolKey.trim();
    if (!trimmed) return;

    const next = get().toolAllowList.includes(trimmed)
      ? get().toolAllowList
      : [...get().toolAllowList, trimmed];

    if (next === get().toolAllowList) return;

    set({ toolAllowList: next });
    persistInterventionSettings({ approvalMode: get().approvalMode, toolAllowList: next });
  },

  setActiveRunContext: (topicId, context) =>
    set((s) => ({
      streamsByTopicId: patchTopicRuntime(s.streamsByTopicId, topicId, { activeRunContext: context }),
    })),

  recordPendingApprovalContext: (topicId, context) =>
    set((s) => {
      const lastEventSeq = context.lastEventSeq ?? s.lastEventSeqByRunId[context.runId] ?? 0;
      const merged = { ...context, lastEventSeq };
      return {
        streamsByTopicId: patchTopicRuntime(s.streamsByTopicId, topicId, { activeRunContext: merged }),
        pendingApprovalContextByTopicId: {
          ...s.pendingApprovalContextByTopicId,
          [topicId]: merged,
        },
      };
    }),

  clearPendingApprovalContext: (topicId) =>
    set((s) => {
      const { [topicId]: _removed, ...pendingApprovalContextByTopicId } =
        s.pendingApprovalContextByTopicId;
      return { pendingApprovalContextByTopicId };
    }),

  getRunContextForTopic: (topicId) =>
    mergeRunContextForTopic(
      topicId,
      get().pendingApprovalContextByTopicId,
      get().streamsByTopicId[topicId]?.activeRunContext ?? null,
    ),

  recordRunEventSeq: (runId, sequence) => {
    if (!runId || typeof sequence !== 'number' || !Number.isFinite(sequence)) return;
    set((s) => ({
      lastEventSeqByRunId: {
        ...s.lastEventSeqByRunId,
        [runId]: Math.max(s.lastEventSeqByRunId[runId] ?? 0, sequence),
      },
    }));
  },

  getLastEventSeq: (runId) => get().lastEventSeqByRunId[runId] ?? 0,

  tickOpElapsed: (topicId) =>
    set((s) => {
      const runtime = s.streamsByTopicId[topicId];
      if (!runtime || !runtime.isStreaming) return s;
      const nextElapsed = runtime.opElapsedMs + 250;
      if (runtime.opElapsedMs === nextElapsed) return s;
      return {
        streamsByTopicId: patchTopicRuntime(s.streamsByTopicId, topicId, {
          opElapsedMs: nextElapsed,
        }),
      };
    }),

  rotatePhrase: (topicId) =>
    set((s) => {
      const runtime = s.streamsByTopicId[topicId];
      if (!runtime || !runtime.isStreaming) return s;
      const nextIdx = (runtime.phraseIdx + 1) % STATUS_PHRASES.length;
      if (nextIdx === runtime.phraseIdx) return s;
      return {
        streamsByTopicId: patchTopicRuntime(s.streamsByTopicId, topicId, {
          phraseIdx: nextIdx,
          opPhrase: STATUS_PHRASES[nextIdx],
        }),
      };
    }),

  addTokenCount: (topicId, delta) =>
    set((s) => {
      if (!delta) return s;
      const runtime = s.streamsByTopicId[topicId];
      if (!runtime) return s;
      return {
        streamsByTopicId: patchTopicRuntime(s.streamsByTopicId, topicId, {
          tokenCount: runtime.tokenCount + delta,
        }),
      };
    }),

  clearTimers: (topicId) => {
    const runtime = get().getStreamRuntime(topicId);
    if (runtime.streamTimerId != null) window.clearTimeout(runtime.streamTimerId);
    if (runtime.opTimerId != null) window.clearInterval(runtime.opTimerId);
    if (runtime.phraseRotateId != null) window.clearInterval(runtime.phraseRotateId);
    set((s) => ({
      streamsByTopicId: patchTopicRuntime(s.streamsByTopicId, topicId, {
        streamTimerId: null,
        opTimerId: null,
        phraseRotateId: null,
      }),
    }));
  },

  beginStreaming: (topicId, options) => {
    const preserveMetrics = options?.preserveMetrics === true;
    const prior = get().getStreamRuntime(topicId);
    const ac = new AbortController();
    const opTimerId = window.setInterval(() => get().tickOpElapsed(topicId), 250);
    const phraseRotateId = window.setInterval(() => get().rotatePhrase(topicId), 4000);
    set((s) => ({
      streamsByTopicId: patchTopicRuntime(s.streamsByTopicId, topicId, {
        isStreaming: true,
        opTrayVisible: true,
        opElapsedMs: preserveMetrics ? prior.opElapsedMs : 0,
        tokenCount: preserveMetrics ? prior.tokenCount : 0,
        stepCount: preserveMetrics ? prior.stepCount : 1,
        cost: preserveMetrics ? prior.cost : 0,
        abortController: ac,
        opTimerId,
        phraseRotateId,
      }),
    }));
    return ac;
  },

  endStreaming: (topicId) => {
    get().clearTimers(topicId);
    const runtime = get().getStreamRuntime(topicId);
    const pendingApproval =
      runtime.activeRunContext?.permissionId != null ||
      runtime.activeRunContext?.hitlRequestId != null;
    set((s) => ({
      streamsByTopicId: patchTopicRuntime(s.streamsByTopicId, topicId, {
        isStreaming: false,
        opTrayVisible: false,
        abortController: null,
        activeRunContext: pendingApproval
          ? runtime.activeRunContext
          : runtime.activeRunContext?.runId
            ? { runId: runtime.activeRunContext.runId }
            : null,
      }),
    }));
  },
}));
