const ACTIVE_TOPIC_STORAGE_PREFIX = 'agentConsole:activeTopicId:';
const LEGACY_ACTIVE_TOPIC_STORAGE_KEY = 'agentConsole:activeTopicId';

function storageKey(agentId?: string): string | null {
  if (!agentId) return LEGACY_ACTIVE_TOPIC_STORAGE_KEY;
  return `${ACTIVE_TOPIC_STORAGE_PREFIX}${agentId}`;
}

export function readStoredActiveTopicId(agentId?: string): string | null {
  try {
    if (agentId) {
      const scoped = localStorage.getItem(storageKey(agentId)!);
      if (scoped) return scoped;
    }
    return localStorage.getItem(LEGACY_ACTIVE_TOPIC_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeStoredActiveTopicId(topicId: string, agentId?: string): void {
  try {
    if (agentId) {
      localStorage.setItem(storageKey(agentId)!, topicId);
      return;
    }
    localStorage.setItem(LEGACY_ACTIVE_TOPIC_STORAGE_KEY, topicId);
  } catch {
    // ignore quota / private mode
  }
}

export function clearStoredActiveTopicId(agentId?: string): void {
  try {
    if (agentId) {
      localStorage.removeItem(storageKey(agentId)!);
      return;
    }
    localStorage.removeItem(LEGACY_ACTIVE_TOPIC_STORAGE_KEY);
  } catch {
    // ignore
  }
}
