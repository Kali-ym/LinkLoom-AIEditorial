import { useStreamingStore } from '../../stores/streamingStore';
import { useTopicStore } from '../../stores/topicStore';
import { isRunStreamActive } from './agentStreamService';

const EMPTY_MESSAGE_QUEUE: never[] = [];

/** True when a stream is in flight for the given topic. */
export function isTopicStreaming(topicId: string | null | undefined): boolean {
  if (!topicId) return false;
  const runtime = useStreamingStore.getState().streamsByTopicId[topicId];
  if (runtime?.isStreaming) return true;
  const runId = useStreamingStore.getState().getRunContextForTopic(topicId)?.runId;
  if (runId && isRunStreamActive(runId)) return true;
  return false;
}

/** True when the active sidebar topic currently owns the in-flight stream. */
export function isActiveTopicStreaming(): boolean {
  return isTopicStreaming(useTopicStore.getState().activeTopicId);
}

export function useActiveTopicStreaming(): boolean {
  const activeTopicId = useTopicStore((s) => s.activeTopicId);
  return useTopicStreaming(activeTopicId);
}

export function useTopicStreaming(topicId: string | null | undefined): boolean {
  const runtimeStreaming = useStreamingStore((s) =>
    topicId ? Boolean(s.streamsByTopicId[topicId]?.isStreaming) : false,
  );
  if (!topicId) return false;
  if (runtimeStreaming) return true;
  const runId = useStreamingStore.getState().getRunContextForTopic(topicId)?.runId;
  return Boolean(runId && isRunStreamActive(runId));
}

/**
 * Subscribe to the entire runtime object for the active topic.
 *
 * Prefer the granular selectors below (`useActiveOpElapsedMs`, `useActiveOpPhrase`,
 * `useActiveOpTrayVisible`, `useActiveStreamMetrics`) when a component only needs
 * one field — the runtime object is replaced on every 250ms timer tick, so
 * subscribing to the whole object forces a re-render roughly 4×/s during long
 * tool runs even when the consumed field is unchanged.
 */
export function useActiveTopicStreamRuntime() {
  const activeTopicId = useTopicStore((s) => s.activeTopicId);
  return useStreamingStore((s) =>
    activeTopicId
      ? (s.streamsByTopicId[activeTopicId] ?? null)
      : null,
  );
}

export function useActiveOpTrayVisible(): boolean {
  const activeTopicId = useTopicStore((s) => s.activeTopicId);
  return useStreamingStore((s) =>
    activeTopicId ? Boolean(s.streamsByTopicId[activeTopicId]?.opTrayVisible) : false,
  );
}

export function useActiveOpElapsedMs(): number {
  const activeTopicId = useTopicStore((s) => s.activeTopicId);
  return useStreamingStore((s) =>
    activeTopicId ? s.streamsByTopicId[activeTopicId]?.opElapsedMs ?? 0 : 0,
  );
}

export function useActiveOpPhrase(): string {
  const activeTopicId = useTopicStore((s) => s.activeTopicId);
  return useStreamingStore((s) =>
    activeTopicId ? s.streamsByTopicId[activeTopicId]?.opPhrase ?? '' : '',
  );
}

export function useActiveStreamTokenCount(): number {
  const activeTopicId = useTopicStore((s) => s.activeTopicId);
  return useStreamingStore((s) =>
    activeTopicId ? s.streamsByTopicId[activeTopicId]?.tokenCount ?? 0 : 0,
  );
}

export function useActiveStreamStepCount(): number {
  const activeTopicId = useTopicStore((s) => s.activeTopicId);
  return useStreamingStore((s) =>
    activeTopicId ? s.streamsByTopicId[activeTopicId]?.stepCount ?? 0 : 0,
  );
}

export function useActiveStreamCost(): number {
  const activeTopicId = useTopicStore((s) => s.activeTopicId);
  return useStreamingStore((s) =>
    activeTopicId ? s.streamsByTopicId[activeTopicId]?.cost ?? 0 : 0,
  );
}

/** Select message queue for the active topic. */
export function useActiveTopicMessageQueue() {
  const activeTopicId = useTopicStore((s) => s.activeTopicId);
  return useStreamingStore((s) => {
    if (!activeTopicId) return EMPTY_MESSAGE_QUEUE;
    return s.messageQueueByTopicId[activeTopicId] ?? EMPTY_MESSAGE_QUEUE;
  });
}
