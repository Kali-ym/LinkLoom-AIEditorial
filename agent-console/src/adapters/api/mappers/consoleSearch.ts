import type { CommandSearchResult, ValidSearchType } from '../../../domain/types/commandSearch';

export interface BackendConsoleSearchDto {
  agents: Array<{
    id: string;
    title: string;
    description?: string;
    agentAvatar?: string;
    agentBackgroundColor?: string;
  }>;
  topics: Array<{
    id: string;
    title: string;
    description?: string;
    agentId?: string;
    agentName?: string;
    agentAvatar?: string;
    agentBackgroundColor?: string;
    updatedAt?: string;
  }>;
  documents: Array<{ id: string; title: string; description?: string }>;
  skills: Array<{ id: string; title: string; description?: string }>;
  actions: Array<{
    id: string;
    title: string;
    description?: string;
    type: 'page' | 'memory' | 'knowledgeBase' | 'plugin';
  }>;
}

function allowed(type: ValidSearchType, filter?: ValidSearchType): boolean {
  return !filter || filter === type;
}

export function mapBackendConsoleSearchToResults(
  dto: BackendConsoleSearchDto,
  activeAgentId: string,
  typeFilter?: ValidSearchType,
): CommandSearchResult[] {
  const results: CommandSearchResult[] = [];

  if (allowed('agent', typeFilter)) {
    for (const agent of dto.agents) {
      results.push({
        id: agent.id,
        title: agent.title,
        description: agent.description,
        avatar: agent.agentAvatar,
        backgroundColor: agent.agentBackgroundColor,
        type: 'agent',
      });
    }
  }

  if (allowed('topic', typeFilter)) {
    for (const topic of dto.topics) {
      results.push({
        id: topic.id,
        title: topic.title,
        description: topic.description,
        agentId: topic.agentId ?? activeAgentId,
        agentName: topic.agentName,
        avatar: topic.agentAvatar,
        backgroundColor: topic.agentBackgroundColor,
        updatedAt: topic.updatedAt,
        type: 'topic',
      });
    }
  }

  if (allowed('knowledgeBase', typeFilter)) {
    for (const doc of dto.documents) {
      results.push({
        id: doc.id,
        title: doc.title,
        description: doc.description,
        type: 'knowledgeBase',
      });
    }
  }

  if (allowed('plugin', typeFilter)) {
    for (const skill of dto.skills) {
      results.push({
        id: skill.id,
        title: skill.title,
        description: skill.description,
        identifier: skill.id,
        type: 'plugin',
      });
    }
  }

  for (const action of dto.actions) {
    if (!allowed(action.type, typeFilter)) continue;
    results.push({
      id: action.id,
      title: action.title,
      description: action.description,
      type: action.type,
    });
  }

  return results;
}
