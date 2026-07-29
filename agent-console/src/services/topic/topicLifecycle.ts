import type { TopicStatus } from '../../domain/types';
import { useTopicStore } from '../../stores';

/** Apply optimistic sidebar status when a stream turn settles. */
export function applyTopicStatusAfterStream(
  topicId: string,
  outcome: { keepForApproval: boolean; turnFailed: boolean; aborted: boolean },
): TopicStatus {
  const status: TopicStatus = outcome.keepForApproval
    ? 'waiting'
    : outcome.turnFailed
      ? 'failed'
      : 'completed';

  const now = new Date().toISOString();
  useTopicStore.setState((state) => ({
    topics: state.topics.map((topic) =>
      topic.id === topicId && topic.status !== 'temp'
        ? { ...topic, status, updatedAt: now }
        : topic,
    ),
  }));

  return status;
}

/** Mark topic as actively streaming in the sidebar. */
export function markTopicRunning(topicId: string, options?: { titleHint?: string; clearTempTag?: boolean }): void {
  const now = new Date().toISOString();
  const titleHint = options?.titleHint?.trim();
  useTopicStore.setState((state) => ({
    topics: state.topics.map((topic) =>
      topic.id === topicId
        ? {
            ...topic,
            status: 'running' as const,
            title: titleHint ? titleHint.slice(0, 80) : topic.title,
            tag: options?.clearTempTag ? undefined : topic.tag,
            createdAt: topic.createdAt ?? now,
            updatedAt: now,
            active: true,
          }
        : { ...topic, active: false },
    ),
    elapsedByTopicId: {
      ...state.elapsedByTopicId,
      [topicId]: state.elapsedByTopicId[topicId] ?? '00:00',
    },
  }));
}
