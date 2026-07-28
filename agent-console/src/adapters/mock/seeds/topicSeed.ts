import { MOCK_THREADS, MOCK_TOPICS } from '../../../fixtures/mockCatalogs';
import type { Topic, TopicThread } from '../../../domain/types';
import { MOCK_DEFAULT_TOPIC_ID, MOCK_FALLBACK_AGENT_ID } from '../constants';

const DEFAULT_MOCK_TOPIC_AGENT_ID = MOCK_FALLBACK_AGENT_ID;

export function getMockActiveTopicId(): string {
  return MOCK_DEFAULT_TOPIC_ID;
}

export function getMockTopics(agentId?: string): Topic[] {
  const activeTopicId = getMockActiveTopicId();
  const scoped = agentId
    ? MOCK_TOPICS.filter(
        (topic) => (topic.agentId ?? DEFAULT_MOCK_TOPIC_AGENT_ID) === agentId,
      )
    : MOCK_TOPICS;
  return scoped.map((t) => ({
    ...t,
    agentId: t.agentId ?? DEFAULT_MOCK_TOPIC_AGENT_ID,
    active: t.id === activeTopicId,
  }));
}

export function getMockThreadsByTopicId(): Record<string, TopicThread[]> {
  const activeTopicId = getMockActiveTopicId();
  return {
    [activeTopicId]: MOCK_THREADS,
    changelog: MOCK_THREADS,
  };
}

export function getMockElapsedByTopicId(): Record<string, string> {
  return { changelog: '01:23' };
}
