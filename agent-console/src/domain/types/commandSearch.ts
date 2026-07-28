export const COMMAND_SEARCH_TYPES = [
  'agent',
  'chatGroup',
  'topic',
  'message',
  'file',
  'folder',
  'page',
  'memory',
  'mcp',
  'plugin',
  'communityAgent',
  'knowledgeBase',
] as const;

export type ValidSearchType = (typeof COMMAND_SEARCH_TYPES)[number];

export interface CommandSearchResult {
  agentId?: string;
  agentName?: string;
  avatar?: string;
  backgroundColor?: string;
  description?: string;
  id: string;
  identifier?: string;
  subtitle?: string;
  title: string;
  topicId?: string;
  topicTitle?: string;
  type: ValidSearchType;
  updatedAt?: string;
}
