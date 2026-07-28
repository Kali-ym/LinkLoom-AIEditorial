import type { QueryClient } from '@tanstack/react-query';

import type { AgentConsoleSnapshot } from '../../adapters/types';
import { agentConsoleQueryKeys } from './queryKeys';

/** Seed TanStack Query cache from bootstrap hydrate snapshot (mock + api first paint). */
export function seedAgentConsoleQueryCache(
  client: QueryClient,
  hydrate: AgentConsoleSnapshot,
): void {
  const {
    activeAgentId,
    agentListLayout,
    agentRuntimeById,
    agents,
    elapsedByTopicId,
    messagesByTopicId,
    plusStateByAgentId,
    threadsByTopicId,
    topics,
  } = hydrate;

  client.setQueryData(agentConsoleQueryKeys.agents(), agents);
  client.setQueryData(agentConsoleQueryKeys.agentListBundle(), {
    agents,
    layout: agentListLayout,
    plusStateByAgentId,
    runtimeByAgentId: agentRuntimeById,
  });
  client.setQueryData(agentConsoleQueryKeys.agentListLayout(), agentListLayout);
  client.setQueryData(agentConsoleQueryKeys.agentRuntime(), agentRuntimeById);
  client.setQueryData(agentConsoleQueryKeys.agent(activeAgentId), agents.find((a) => a.id === activeAgentId));
  client.setQueryData(agentConsoleQueryKeys.agentPlusState(activeAgentId), plusStateByAgentId[activeAgentId]);
  client.setQueryData(agentConsoleQueryKeys.topics(activeAgentId), topics);
  client.setQueryData(agentConsoleQueryKeys.messagesAll(), messagesByTopicId);

  for (const [agentId, plusState] of Object.entries(plusStateByAgentId)) {
    client.setQueryData(agentConsoleQueryKeys.agentPlusState(agentId), plusState);
  }

  for (const [topicId, messages] of Object.entries(messagesByTopicId)) {
    client.setQueryData(agentConsoleQueryKeys.messages(topicId), messages);
    client.setQueryData(agentConsoleQueryKeys.topicThreads(topicId), threadsByTopicId[topicId] ?? []);
    client.setQueryData(
      agentConsoleQueryKeys.topicElapsed(topicId),
      elapsedByTopicId[topicId],
    );
  }
}
