import type { TopicModelSelection } from '../../domain/agentConsoleScope';

const STORAGE_PREFIX = 'agentConsole:topicModel:';

function storageKey(topicId: string): string {
  return `${STORAGE_PREFIX}${topicId}`;
}

export function readStoredTopicModel(topicId: string): TopicModelSelection | null {
  if (!topicId) return null;
  try {
    const raw = localStorage.getItem(storageKey(topicId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TopicModelSelection;
    if (
      typeof parsed?.model === 'string' &&
      parsed.model.trim() &&
      typeof parsed?.provider === 'string' &&
      parsed.provider.trim()
    ) {
      return { model: parsed.model.trim(), provider: parsed.provider.trim() };
    }
    return null;
  } catch {
    return null;
  }
}

export function writeStoredTopicModel(topicId: string, selection: TopicModelSelection): void {
  if (!topicId) return;
  try {
    localStorage.setItem(storageKey(topicId), JSON.stringify(selection));
  } catch {
    // ignore quota / private mode
  }
}

export function clearStoredTopicModel(topicId: string): void {
  if (!topicId) return;
  try {
    localStorage.removeItem(storageKey(topicId));
  } catch {
    // ignore
  }
}
