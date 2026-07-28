/**
 * Shared state for AgentConsoleRouteHydration URL ↔ store topic sync.
 * Keeps user-initiated topic picks from being overwritten by stale URL reads.
 */
export const topicRouteSyncState = {
  suppressStoreToUrl: false,
  lastAppliedAgent: null as string | null,
  lastAppliedTopic: null as string | null,
  lastSeenUrlTopic: undefined as string | undefined,
  /** User picked a topic in store; URL may still show the previous topic briefly. */
  pendingUserTopicId: null as string | null,
};

export function markPendingUserTopicSelection(topicId: string): void {
  topicRouteSyncState.pendingUserTopicId = topicId;
}

export function clearPendingUserTopicIfMatched(urlTopicId: string | undefined): void {
  if (topicRouteSyncState.pendingUserTopicId === urlTopicId) {
    topicRouteSyncState.pendingUserTopicId = null;
  }
}
