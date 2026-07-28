import {
  filterTopicsForAgent as filterTopicsForAgentCore,
  topicBelongsToAgent as topicBelongsToAgentCore,
} from '../../domain/topicAgentScope';
import type { Topic } from '../../domain/types';
import { getClientTopic } from './clientTopicStorage';

export function topicBelongsToAgent(topic: Topic, agentId: string): boolean {
  const clientAgentId = getClientTopic(topic.id)?.agentId;
  return topicBelongsToAgentCore(topic, agentId, clientAgentId);
}

export function filterTopicsForAgent(topics: Topic[], agentId: string): Topic[] {
  return filterTopicsForAgentCore(
    topics,
    agentId,
    (topicId) => getClientTopic(topicId)?.agentId,
  );
}
