import type { ToolExecutionCapability } from '../../../types/agent.js';

export type WorkspaceMode = 'none' | 'local' | 'docker' | 'remote';

export type WorkspacePoolMode = 'per-run' | 'per-agent';

export type WorkspaceNetworkPolicy = 'disabled' | 'limited' | 'enabled';

export type WorkspaceWritePolicy = 'read-only' | 'workspace-only' | 'allow-listed';

export interface WorkspaceMountPolicy {
  source: string;
  target: string;
  readonly?: boolean;
}

export interface WorkspaceResourceLimits {
  timeoutMs?: number;
  maxBytes?: number;
  maxFiles?: number;
  cpuCores?: number;
  memoryMb?: number;
}

export interface WorkspaceSandboxPolicy {
  enabled?: boolean;
  allowCapabilities?: ToolExecutionCapability[];
  denyCapabilities?: ToolExecutionCapability[];
  denyUnsupportedModes?: boolean;
  envAllowlist?: string[];
}

export interface WorkspacePolicy {
  mode: WorkspaceMode;
  /** Docker warm-pool strategy; defaults to per-run when omitted. */
  pool?: WorkspacePoolMode;
  rootDir?: string;
  network?: WorkspaceNetworkPolicy;
  writes?: WorkspaceWritePolicy;
  allowedWritePaths?: string[];
  mounts?: WorkspaceMountPolicy[];
  cleanup?: 'always' | 'on-success' | 'manual';
  resourceLimits?: WorkspaceResourceLimits;
  sandbox?: WorkspaceSandboxPolicy;
  metadata?: Record<string, unknown>;
}

export interface WorkspaceRef {
  workspaceId: string;
  mode: WorkspaceMode;
  rootDir?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}