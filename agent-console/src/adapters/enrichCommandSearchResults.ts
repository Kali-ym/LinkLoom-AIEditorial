import type { ReactNode } from 'react';

import type { Agent } from '../domain/types';
import type { CommandSearchResult } from '../domain/types/commandSearch';
import type { Topic } from '../domain/types/topic';
import { resolveAgentAvatar } from '../utils/agentAvatar';

export type EnrichedCommandSearchResult = Omit<CommandSearchResult, 'avatar'> & {
  avatar?: string | ReactNode;
};

export function enrichCommandSearchResults(
  results: CommandSearchResult[],
  agents: Agent[],
  topics: Topic[],
): EnrichedCommandSearchResult[] {
  const agentById = new Map(agents.map((agent) => [agent.id, agent]));
  const topicById = new Map(topics.map((topic) => [topic.id, topic]));

  return results.map((result) => {
    if (result.type === 'topic') {
      const agent = result.agentId ? agentById.get(result.agentId) : undefined;
      const topic = topicById.get(result.id);
      return {
        ...result,
        agentName: result.agentName ?? agent?.name,
        avatar: result.avatar ?? (agent ? resolveAgentAvatar(agent, 12) : undefined),
        backgroundColor: result.backgroundColor ?? agent?.gradient,
        updatedAt: result.updatedAt ?? topic?.updatedAt ?? topic?.createdAt,
      };
    }

    if (result.type === 'message') {
      const topic = result.topicId ? topicById.get(result.topicId) : undefined;
      return {
        ...result,
        topicTitle: result.topicTitle ?? topic?.title,
        updatedAt: result.updatedAt ?? topic?.updatedAt ?? topic?.createdAt,
      };
    }

    if (result.type === 'agent' || result.type === 'chatGroup') {
      const agent = agentById.get(result.id);
      return {
        ...result,
        avatar: result.avatar ?? (agent ? resolveAgentAvatar(agent, 12) : undefined),
        backgroundColor: result.backgroundColor ?? agent?.gradient,
      };
    }

    return result;
  });
}
