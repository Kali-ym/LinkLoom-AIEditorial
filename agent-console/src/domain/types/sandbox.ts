export type AgentSandboxStatus =
  | 'starting'
  | 'running'
  | 'stopped'
  | 'error'
  | 'not_provisioned';

export interface AgentSandboxStatusDto {
  agentId: string;
  status: AgentSandboxStatus;
  containerId?: string;
  workspaceId?: string;
  hostMountPath?: string;
  image?: string;
  lastUsedAt?: string;
  createdAt?: string;
  error?: string;
}
