import type { Message } from '../domain/types';
import { EMPTY_MESSAGES } from './storeSelectors';

type FilterCacheEntry = { result: Message[]; source: Message[] };

const threadFilterCache = new Map<string, FilterCacheEntry>();
const dmFilterCache = new Map<string, FilterCacheEntry>();

/** React 19 useSyncExternalStore requires stable getSnapshot references. */
function filterWithCache(
  cache: Map<string, FilterCacheEntry>,
  key: string,
  source: Message[] | undefined,
  predicate: (message: Message) => boolean,
): Message[] {
  if (!source?.length) return EMPTY_MESSAGES;

  const cached = cache.get(key);
  if (cached?.source === source) return cached.result;

  const filtered = source.filter(predicate);
  const result = filtered.length > 0 ? filtered : EMPTY_MESSAGES;
  cache.set(key, { result, source });
  return result;
}

/** DM 过滤*/
export function selectDmMessagesForAgent(topicId: string, agentId: string) {
  const cacheKey = `${topicId}:${agentId}`;
  return (s: { messagesByTopicId: Record<string, Message[]> }) => {
    if (!topicId || !agentId) return EMPTY_MESSAGES;
    return filterWithCache(
      dmFilterCache,
      cacheKey,
      s.messagesByTopicId[topicId],
      (m) =>
        (m.role === 'user' && m.targetId === agentId) ||
        (m.role === 'assistant' && m.agentId === agentId),
    );
  };
}

/** Thread 分支消息*/
export function selectMessagesForThread(topicId: string, threadId?: string | null) {
  const cacheKey = `${topicId}:${threadId ?? ''}`;
  return (s: { messagesByTopicId: Record<string, Message[]> }) => {
    if (!topicId) return EMPTY_MESSAGES;
    const all = s.messagesByTopicId[topicId];
    if (!threadId) {
      return filterWithCache(
        threadFilterCache,
        `${cacheKey}:any`,
        all,
        (m) => Boolean(m.threadId),
      );
    }
    return filterWithCache(
      threadFilterCache,
      cacheKey,
      all,
      (m) => m.threadId === threadId,
    );
  };
}
