import type { QueryClient } from '@tanstack/react-query';

/** TanStack Query key factory for Agent Console data hooks. */
export const agentConsoleQueryKeys = {
  root: ['agentConsole'] as const,
  agentListBundle: () => [...agentConsoleQueryKeys.root, 'agentListBundle'] as const,
  agentListLayout: () => [...agentConsoleQueryKeys.root, 'agentListLayout'] as const,
  agentRuntime: () => [...agentConsoleQueryKeys.root, 'agentRuntime'] as const,
  agents: () => [...agentConsoleQueryKeys.root, 'agents'] as const,
  agent: (agentId: string) => [...agentConsoleQueryKeys.root, 'agent', agentId] as const,
  agentPlusState: (agentId: string) =>
    [...agentConsoleQueryKeys.root, 'agent', agentId, 'plusState'] as const,
  topics: (agentId: string) => [...agentConsoleQueryKeys.root, 'topics', agentId] as const,
  topicThreads: (topicId: string) =>
    [...agentConsoleQueryKeys.root, 'topicThreads', topicId] as const,
  topicElapsed: (topicId: string) =>
    [...agentConsoleQueryKeys.root, 'topicElapsed', topicId] as const,
  messages: (topicId: string) => [...agentConsoleQueryKeys.root, 'messages', topicId] as const,
  messagesAll: () => [...agentConsoleQueryKeys.root, 'messages', 'byTopicId'] as const,
  catalogModels: () => [...agentConsoleQueryKeys.root, 'catalog', 'models'] as const,
  catalogInputMenu: (agentId: string) =>
    [...agentConsoleQueryKeys.root, 'catalog', 'inputMenu', agentId] as const,
  commandSearch: (query: string, typeFilter?: string) =>
    [...agentConsoleQueryKeys.root, 'commandSearch', query, typeFilter ?? 'all'] as const,
  reviewPatches: (workingDirectory: string, mode: string, base?: string) =>
    [...agentConsoleQueryKeys.root, 'reviewPatches', workingDirectory, mode, base ?? ''] as const,
  task: (taskId: string) => [...agentConsoleQueryKeys.root, 'task', taskId] as const,
  tasks: (agentId: string) => [...agentConsoleQueryKeys.root, 'tasks', agentId] as const,
};

export type AgentConsoleQueryClient = QueryClient;
