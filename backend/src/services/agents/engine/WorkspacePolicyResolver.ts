import type { AgentDefinition } from '../../../types/agent.js';
import type { WorkspacePolicy, WorkspaceResourceLimits } from './WorkspacePolicy.js';

export type AgentExecutionTarget = 'none' | 'local' | 'sandbox';

export interface AgentSandboxPolicyConfig {
  idleTimeoutMs?: number;
  image?: string;
  resourceLimits?: WorkspaceResourceLimits;
}

export interface AgentConsoleWorkspaceConfig {
  executionTarget?: AgentExecutionTarget;
  sandboxPolicy?: AgentSandboxPolicyConfig;
}

export interface WorkspaceSummary {
  mode: WorkspacePolicy['mode'];
  pool?: WorkspacePolicy['pool'];
  containerId?: string;
  fallback?: string;
  fallbackReason?: string;
}

export function readAgentConsoleWorkspaceConfig(
  agentDef: Pick<AgentDefinition, 'metadata'>
): AgentConsoleWorkspaceConfig | undefined {
  const raw = agentDef.metadata?.agentConsole;
  if (!raw || typeof raw !== 'object') return undefined;
  const record = raw as Record<string, unknown>;
  const executionTarget = isExecutionTarget(record.executionTarget)
    ? record.executionTarget
    : undefined;
  const sandboxPolicy = readSandboxPolicy(record.sandboxPolicy);
  if (!executionTarget && !sandboxPolicy) return undefined;
  return { executionTarget, sandboxPolicy };
}

export function resolveWorkspacePolicyFromAgent(
  agentDef: Pick<AgentDefinition, 'metadata'>,
  override?: WorkspacePolicy
): WorkspacePolicy | undefined {
  if (override) return override;
  const consoleConfig = readAgentConsoleWorkspaceConfig(agentDef);
  if (!consoleConfig?.executionTarget) return undefined;
  return resolveWorkspacePolicyFromExecutionTarget(consoleConfig);
}

export function resolveWorkspacePolicyFromExecutionTarget(
  config: AgentConsoleWorkspaceConfig
): WorkspacePolicy {
  switch (config.executionTarget) {
    case 'sandbox':
      return {
        mode: 'docker',
        pool: 'per-agent',
        cleanup: 'manual',
        network: 'disabled',
        writes: 'workspace-only',
        resourceLimits: config.sandboxPolicy?.resourceLimits,
        metadata: {
          ...(config.sandboxPolicy?.image ? { image: config.sandboxPolicy.image } : {}),
          ...(config.sandboxPolicy?.idleTimeoutMs !== undefined
            ? { idleTimeoutMs: config.sandboxPolicy.idleTimeoutMs }
            : {})
        }
      };
    case 'local':
      return {
        mode: 'local',
        pool: 'per-agent',
        cleanup: 'manual',
        network: 'disabled',
        writes: 'workspace-only'
      };
    case 'none':
    default:
      return { mode: 'none' };
  }
}

export function summarizeWorkspaceFromRef(
  workspace?: {
    mode?: string;
    metadata?: Record<string, unknown>;
  },
  policy?: WorkspacePolicy
): WorkspaceSummary | undefined {
  if (!workspace && !policy) return undefined;
  const mode = (workspace?.mode ?? policy?.mode) as WorkspacePolicy['mode'] | undefined;
  if (!mode) return undefined;
  return {
    mode,
    pool: typeof workspace?.metadata?.pool === 'string'
      ? (workspace.metadata.pool as WorkspacePolicy['pool'])
      : policy?.pool,
    containerId:
      typeof workspace?.metadata?.containerId === 'string'
        ? workspace.metadata.containerId
        : undefined,
    fallback:
      typeof workspace?.metadata?.fallback === 'string' ? workspace.metadata.fallback : undefined,
    fallbackReason:
      typeof workspace?.metadata?.fallbackReason === 'string'
        ? workspace.metadata.fallbackReason
        : undefined
  };
}

export function summarizeWorkspacePolicy(policy?: WorkspacePolicy): WorkspaceSummary | undefined {
  if (!policy) return undefined;
  return {
    mode: policy.mode,
    pool: policy.pool
  };
}

function readSandboxPolicy(value: unknown): AgentSandboxPolicyConfig | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  const resourceLimits =
    record.resourceLimits && typeof record.resourceLimits === 'object'
      ? { ...(record.resourceLimits as WorkspaceResourceLimits) }
      : undefined;
  return {
    idleTimeoutMs:
      typeof record.idleTimeoutMs === 'number' ? record.idleTimeoutMs : undefined,
    image: typeof record.image === 'string' ? record.image : undefined,
    resourceLimits
  };
}

function isExecutionTarget(value: unknown): value is AgentExecutionTarget {
  return value === 'none' || value === 'local' || value === 'sandbox';
}
