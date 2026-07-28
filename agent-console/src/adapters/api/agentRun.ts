import type { FileRef } from '../../domain/types/userTurn';
import { readStoredActiveAgentId } from './activeAgentStorage';
import { apiAgentPort } from './agentPort';
import { agentConsoleGetJson, agentConsolePostJson, agentConsoleFetch } from './http';
import { topicIdToSessionId } from './mappers/sessionTopic';
import { mapTopicMessagesToRunContext } from './mappers/runContext';
import type { BackendAgentRunPageDto } from './types/session';

export interface StartAgentRunResult {
  runId: string;
  sessionId: string;
  threadId?: string;
  createdAt: string;
}

export async function resolveActiveAgentId(): Promise<string> {
  const stored = readStoredActiveAgentId();
  if (stored) return stored;
  return apiAgentPort.getActiveAgentId();
}

export async function listAgentRunsForAgent(
  agentId: string,
  limit = 100,
): Promise<BackendAgentRunPageDto> {
  const params = new URLSearchParams({
    agentId,
    limit: String(limit),
    sortField: 'updatedAt',
    sortOrder: 'desc',
  });
  return agentConsoleGetJson<BackendAgentRunPageDto>(`/api/agent-runs?${params.toString()}`);
}

export async function startAgentRun(params: {
  agentId: string;
  topicId: string;
  message: string;
  editorData?: Record<string, unknown>;
  files?: FileRef[];
  threadId?: string;
  stream?: boolean;
  metadata?: Record<string, unknown>;
  messages?: ReturnType<typeof mapTopicMessagesToRunContext>;
}): Promise<StartAgentRunResult> {
  const sessionId = topicIdToSessionId(params.topicId);
  const threadId =
    params.threadId && params.threadId !== 'main' ? params.threadId : undefined;

  const body: Record<string, unknown> = {
    agentId: params.agentId,
    sessionId,
    threadId,
    stream: params.stream ?? true,
    metadata: params.metadata,
    messages: params.messages,
    message: params.message,
  };

  if (params.editorData) {
    body.editorData = params.editorData;
  }
  if (params.files?.length) {
    body.files = params.files;
  }

  return agentConsolePostJson<StartAgentRunResult>('/api/agent-runs', body);
}

export async function cancelAgentRun(runId: string): Promise<{ status: string }> {
  const response = await agentConsoleFetch(
    `/api/agent-runs/${encodeURIComponent(runId)}/cancel`,
    { method: 'POST' },
  );
  return (await response.json()) as { status: string };
}

export interface CompactSessionContextResult {
  sessionId: string;
  compacted: boolean;
  beforeMessages: number;
  afterMessages: number;
  snapshot?: {
    byCategory: Record<string, number>;
    totalTokens: number;
    adjustedTotal: number;
    driftMultiplier: number;
    maxContextTokens: number;
    reserveOutputTokens: number;
    compactionBuffer: number;
    remainingTokens: number;
    usageRatio: number;
    source: 'counter' | 'provider' | 'estimate';
    round?: number;
    compacted?: boolean;
  };
}

/** Manually compact a session's context via the backend endpoint. */
export async function compactSessionContext(
  topicId: string,
): Promise<CompactSessionContextResult> {
  const sessionId = topicIdToSessionId(topicId);
  return agentConsolePostJson<CompactSessionContextResult>(
    `/api/agent-sessions/${encodeURIComponent(sessionId)}/compact-context`,
    {},
  );
}
