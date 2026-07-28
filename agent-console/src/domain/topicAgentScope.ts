import type { Topic } from './types';

/** 话题是否属于指定智能体（侧栏隔离 + 乐观草稿保留）。 */
export function topicBelongsToAgent(
  topic: Topic,
  agentId: string,
  clientAgentId?: string,
): boolean {
  if (!agentId) return true;
  if (topic.agentId === agentId) return true;
  if (topic.agentId && topic.agentId !== agentId) return false;

  if (clientAgentId) return clientAgentId === agentId;

  return topic.status === 'temp';
}

export function filterTopicsForAgent(
  topics: Topic[],
  agentId: string,
  getClientAgentId?: (topicId: string) => string | undefined,
): Topic[] {
  if (!agentId) return topics;
  return topics.filter((topic) =>
    topicBelongsToAgent(topic, agentId, getClientAgentId?.(topic.id)),
  );
}

export function resolveActiveTopicIdForAgent(
  topics: Topic[],
  options?: {
    preferredId?: string;
    streamingTopicIds?: ReadonlySet<string>;
    /** 切换 agent 时不自动选中 temp 草稿，避免误拉 messages / 误进会话。 */
    skipTempFallback?: boolean;
  },
): string {
  const ids = new Set(topics.map((topic) => topic.id));
  const preferred = options?.preferredId;
  if (preferred && ids.has(preferred)) return preferred;

  const streaming = options?.streamingTopicIds;
  if (streaming?.size) {
    const running = topics.find(
      (topic) =>
        ids.has(topic.id) &&
        streaming.has(topic.id) &&
        (topic.status === 'running' || topic.status === 'waiting'),
    );
    if (running) return running.id;
  }

  if (!options?.skipTempFallback) {
    const temp = topics.find((topic) => topic.status === 'temp');
    if (temp) return temp.id;
  }

  return '';
}
