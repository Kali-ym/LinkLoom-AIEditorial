import type { AgentEvent, AgentHitlRequest } from './AgentEvent.js';
import type { AgentMessage, AgentRunOutput, AgentRunSource, AgentRunStatus } from './AgentRunSpec.js';
import type { PermissionRequest } from './PermissionPolicy.js';
import type { WorkspaceRef } from './WorkspacePolicy.js';
import type { AgentWorkspaceState } from '../workspace/AgentWorkspaceState.js';

export interface AgentCheckpoint {
  checkpointId: string;
  runId: string;
  sessionId: string;
  reason?: string;
  status: AgentRunStatus;
  messages: AgentMessage[];
  events?: AgentEvent[];
  pendingPermission?: PermissionRequest;
  pendingHitl?: AgentHitlRequest;
  workspace?: WorkspaceRef;
  state?: Record<string, unknown>;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface AgentArtifactRef {
  artifactId: string;
  kind: string;
  uri?: string;
  preview?: string;
  sizeBytes?: number;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface AgentSession {
  sessionId: string;
  runId: string;
  threadId?: string;
  source: AgentRunSource;
  status: AgentRunStatus;
  currentRound?: number;
  messages: AgentMessage[];
  events: AgentEvent[];
  pendingPermission?: PermissionRequest;
  pendingHitl?: AgentHitlRequest;
  checkpoints: AgentCheckpoint[];
  artifacts: AgentArtifactRef[];
  output?: AgentRunOutput;
  workspace?: WorkspaceRef;
  workspaceState?: AgentWorkspaceState;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}