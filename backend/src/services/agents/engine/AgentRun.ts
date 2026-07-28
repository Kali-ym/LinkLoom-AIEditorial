import type { AgentRunOutput, AgentRunSource, AgentRunStatus } from './AgentRunSpec.js';
import type { AgentSpecSnapshot } from './AgentSpec.js';
import type { AgentHitlRequest } from './AgentEvent.js';
import type { PermissionRequest } from './PermissionPolicy.js';
import type { WorkspaceRef } from './WorkspacePolicy.js';

/**
 * Platform-level read model for a single agent run.
 * Designed for list/filter/detail views — not for execution state mutation.
 */
export interface AgentRun {
  runId: string;
  sessionId: string;
  threadId?: string;
  agentId?: string;
  agentSpecId?: string;
  agentSpecRevision?: string;
  agentSpec?: AgentSpecSnapshot;
  workflowId?: string;
  source: AgentRunSource;
  status: AgentRunStatus;
  createdAt: string;
  updatedAt: string;
  finishedAt?: string;
  durationMs?: number;

  // Summary counters for list view
  roundCount: number;
  toolCallCount: number;
  artifactCount: number;
  checkpointCount: number;

  // Current-state pointers
  pendingPermission?: PermissionRequest;
  pendingHitl?: AgentHitlRequest;
  stopReason?: string;
  error?: string;

  // Lightweight output preview (no full trace)
  outputPreview?: string;
  output?: AgentRunOutput;

  // Workspace binding
  workspace?: WorkspaceRef;

  // Extensible
  metadata?: Record<string, unknown>;
}

export interface AgentRunFilter {
  agentId?: string;
  workflowId?: string;
  source?: AgentRunSource | AgentRunSource[];
  status?: AgentRunStatus | AgentRunStatus[];
  createdAfter?: string;
  createdBefore?: string;
  pendingPermission?: boolean;
  search?: string; // free-text match on runId / sessionId / agentId
}

export interface AgentRunPage {
  items: AgentRun[];
  total: number;
  offset: number;
  limit: number;
}

export interface AgentRunSortField {
  field: 'createdAt' | 'updatedAt' | 'durationMs' | 'status';
  order: 'asc' | 'desc';
}