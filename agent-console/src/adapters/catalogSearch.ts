import type { Agent } from '../domain/types';
import type { CommandSearchResult, ValidSearchType } from '../domain/types/commandSearch';
import type { Message } from '../domain/types/message';
import type { Topic } from '../domain/types/topic';
import { COMMAND_SEARCH_EXTRA_MOCKS } from '../fixtures/commandSearchMocks';
import { stripMarkdownForSearchPreview } from '../utils/stripMarkdownForSearchPreview';

const DEFAULT_LIMIT = 5;
const FILTERED_LIMIT = 50;

export interface CommandSearchSources {
  activeAgentId: string;
  agents: Agent[];
  messagesByTopicId: Record<string, Message[]>;
  topics: Topic[];
}

function matchesQuery(text: string, query: string): boolean {
  return text.toLowerCase().includes(query.toLowerCase());
}

function pushIfMatch(
  results: CommandSearchResult[],
  item: CommandSearchResult,
  query: string,
  limit: number,
): void {
  const haystack = [item.title, item.description, item.identifier].filter(Boolean).join(' ');
  if (!matchesQuery(haystack, query)) return;
  if (results.filter((r) => r.type === item.type).length >= limit) return;
  results.push(item);
}

function messagePreview(message: Message): string {
  const raw = typeof message.content === 'string' ? message.content : '';
  return stripMarkdownForSearchPreview(raw).slice(0, 120);
}

/** Client-side CommandMenu search — shared by mock and api catalog ports. */
export function queryCommandSearch(
  query: string,
  typeFilter: ValidSearchType | undefined,
  sources: CommandSearchSources,
  options?: { includeExtraMocks?: boolean },
): CommandSearchResult[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const limit = typeFilter ? FILTERED_LIMIT : DEFAULT_LIMIT;
  const results: CommandSearchResult[] = [];
  const allow = (type: ValidSearchType) => !typeFilter || typeFilter === type;

  if (allow('agent')) {
    for (const agent of sources.agents) {
      if (agent.sessionType === 'group') continue;
      pushIfMatch(
        results,
        {
          description: agent.description,
          id: agent.id,
          title: agent.name,
          type: 'agent',
        },
        trimmed,
        limit,
      );
    }
  }

  if (allow('chatGroup')) {
    for (const agent of sources.agents) {
      if (agent.sessionType !== 'group') continue;
      pushIfMatch(
        results,
        {
          description: agent.description,
          id: agent.id,
          title: agent.name,
          type: 'chatGroup',
        },
        trimmed,
        limit,
      );
    }
  }

  if (allow('topic')) {
    for (const topic of sources.topics) {
      pushIfMatch(
        results,
        {
          agentId: topic.agentId ?? sources.activeAgentId,
          id: topic.id,
          title: topic.title,
          type: 'topic',
          updatedAt: topic.updatedAt ?? topic.createdAt,
        },
        trimmed,
        limit,
      );
    }
  }

  if (allow('message')) {
    for (const [topicId, messages] of Object.entries(sources.messagesByTopicId)) {
      const topic = sources.topics.find((item) => item.id === topicId);
      for (const message of messages) {
        const preview = messagePreview(message);
        if (!preview) continue;
        pushIfMatch(
          results,
          {
            agentId: sources.activeAgentId,
            description: preview,
            id: message.id,
            title: preview.slice(0, 48) || message.id,
            topicId,
            topicTitle: topic?.title,
            type: 'message',
            updatedAt: message.createdAt,
          },
          trimmed,
          limit,
        );
      }
    }
  }

  if (options?.includeExtraMocks !== false) {
    for (const mock of COMMAND_SEARCH_EXTRA_MOCKS) {
      if (!allow(mock.type)) continue;
      pushIfMatch(results, mock, trimmed, limit);
    }
  }

  return results.slice(0, typeFilter ? FILTERED_LIMIT : DEFAULT_LIMIT * 4);
}
