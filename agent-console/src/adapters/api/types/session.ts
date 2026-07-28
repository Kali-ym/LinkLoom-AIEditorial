/** Backend agent run list item — mirrors `AgentRun` read model. */
export interface BackendAgentRunDto {
  runId: string;
  sessionId: string;
  threadId?: string;
  agentId?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  outputPreview?: string;
  metadata?: Record<string, unknown>;
  pendingPermission?: unknown;
  pendingHitl?: unknown;
}

export interface BackendAgentRunPageDto {
  items: BackendAgentRunDto[];
  total: number;
  offset: number;
  limit: number;
}

export interface BackendSessionGroupStateDto {
  sessionId: string;
  threadId?: string;
  status?: string;
  runCount?: number;
  runIds?: string[];
  createdAt?: string;
  updatedAt?: string;
  messageCount?: number;
  metadata?: Record<string, unknown>;
}
