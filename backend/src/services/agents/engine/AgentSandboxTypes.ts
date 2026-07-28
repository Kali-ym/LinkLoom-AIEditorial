import type { WorkspacePolicy, WorkspaceRef } from './WorkspacePolicy.js';

export type AgentSandboxStatus = 'starting' | 'running' | 'stopped' | 'error';

export interface AgentSandboxInstance {
  agentId: string;
  containerId: string;
  workspaceId: string;
  hostMountPath: string;
  status: AgentSandboxStatus;
  image: string;
  lastUsedAt: string;
  createdAt: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentSandboxInstanceStore {
  get(agentId: string): Promise<AgentSandboxInstance | null>;
  upsert(instance: AgentSandboxInstance): Promise<void>;
  delete(agentId: string): Promise<void>;
  listAll(): Promise<AgentSandboxInstance[]>;
}

export function isPerAgentSandboxPolicy(policy: WorkspacePolicy): boolean {
  return policy.mode === 'docker' && policy.pool === 'per-agent';
}

export function isPerAgentDockerWorkspace(workspace?: {
  mode?: string;
  metadata?: Record<string, unknown>;
}): boolean {
  return (
    workspace?.mode === 'docker' &&
    workspace.metadata?.pool === 'per-agent' &&
    typeof workspace.metadata?.containerId === 'string' &&
    workspace.metadata.containerId.length > 0
  );
}

export function agentSandboxWorkspaceId(agentId: string): string {
  return `agent_sandbox_${sanitizeAgentId(agentId)}`;
}

export function agentSandboxHostMount(rootDir: string, agentId: string): string {
  return `${rootDir}/agents/${sanitizeAgentId(agentId)}`;
}

export function mapContainerStatusToSandboxStatus(
  status: 'starting' | 'running' | 'exited' | 'errored'
): AgentSandboxStatus {
  switch (status) {
    case 'running':
      return 'running';
    case 'starting':
      return 'starting';
    case 'exited':
      return 'stopped';
    default:
      return 'error';
  }
}

function sanitizeAgentId(agentId: string): string {
  return agentId.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 160);
}
