import type {
  ToolDefinition,
  ToolExecutionCapability,
  ToolExecutionPolicy,
  ToolExecutionSource,
  ToolSandboxTrace
} from '../../../types/agent.js';
import type { WorkspacePolicy, WorkspaceRef } from './WorkspacePolicy.js';
import { isPerAgentDockerWorkspace, isPerAgentSandboxPolicy } from './AgentSandboxTypes.js';

export interface WorkspaceSandboxEvaluationInput {
  source: ToolExecutionSource;
  toolId: string;
  exposedName: string;
  originalName?: string;
  arguments: Record<string, unknown>;
  toolDef?: Pick<ToolDefinition, 'id' | 'name' | 'execution' | 'uiHints'>;
  execution?: Pick<ToolExecutionPolicy, 'capabilities' | 'readonly'>;
  workspace?: WorkspaceRef;
  policy?: WorkspacePolicy;
}

export class WorkspaceSandboxDeniedError extends Error {
  readonly code = 'SANDBOX_DENIED';
  readonly details: ToolSandboxTrace;

  constructor(decision: ToolSandboxTrace) {
    super(decision.reason || 'Tool execution denied by workspace sandbox policy');
    this.name = 'WorkspaceSandboxDeniedError';
    this.details = decision;
  }
}

export function isWorkspaceSandboxDeniedError(error: unknown): error is WorkspaceSandboxDeniedError {
  return error instanceof WorkspaceSandboxDeniedError ||
    Boolean(
      error &&
        typeof error === 'object' &&
        ((error as { name?: unknown }).name === 'WorkspaceSandboxDeniedError' ||
          (error as { code?: unknown }).code === 'SANDBOX_DENIED')
    );
}

export function evaluateWorkspaceSandbox(
  input: WorkspaceSandboxEvaluationInput
): ToolSandboxTrace | undefined {
  const hasSandboxContext = Boolean(input.policy || input.workspace);
  if (!hasSandboxContext) return undefined;

  const capabilities = resolveToolCapabilities(input);
  const base = createBaseTrace(input, capabilities);
  const policy = input.policy;
  const mode = policy?.mode ?? input.workspace?.mode;

  if (policy?.sandbox?.enabled === false) {
    return {
      ...base,
      effect: 'allow',
      code: 'sandbox_disabled',
      reason: 'Workspace sandbox policy is disabled for this run.'
    };
  }

  const modeDecision = decideWorkspaceMode(mode, capabilities, policy, input.workspace);
  if (modeDecision) return { ...base, ...modeDecision };

  const capabilityDecision = decideCapabilityPolicy(policy, capabilities);
  if (capabilityDecision) return { ...base, ...capabilityDecision };

  const writeDecision = decideWritePolicy(policy, capabilities);
  if (writeDecision) return { ...base, ...writeDecision };

  const networkDecision = decideNetworkPolicy(policy, capabilities);
  if (networkDecision) return { ...base, ...networkDecision };

  return {
    ...base,
    effect: 'allow',
    code: 'sandbox_allow',
    reason: capabilities.length
      ? 'Tool capabilities are allowed by the active workspace sandbox policy.'
      : 'No sandbox-restricted capability was declared for this tool.'
  };
}

export function assertWorkspaceSandboxAllowed(input: WorkspaceSandboxEvaluationInput): ToolSandboxTrace | undefined {
  const decision = evaluateWorkspaceSandbox(input);
  if (decision?.effect === 'deny') throw new WorkspaceSandboxDeniedError(decision);
  return decision;
}

function createBaseTrace(
  input: WorkspaceSandboxEvaluationInput,
  capabilities: ToolExecutionCapability[]
): ToolSandboxTrace {
  return {
    effect: 'allow',
    capabilities,
    policy: summarizePolicy(input.policy),
    workspace: summarizeWorkspace(input.workspace),
    metadata: {
      source: input.source,
      toolId: input.toolId,
      exposedName: input.exposedName,
      originalName: input.originalName
    }
  };
}

function resolveToolCapabilities(input: WorkspaceSandboxEvaluationInput): ToolExecutionCapability[] {
  const capabilities = new Set<ToolExecutionCapability>();
  for (const capability of input.execution?.capabilities || input.toolDef?.execution?.capabilities || []) {
    if (isToolExecutionCapability(capability)) capabilities.add(capability);
  }

  if (input.source === 'mcp') capabilities.add('network');

  const name = `${input.toolId} ${input.exposedName}`.toLowerCase();
  if (name.includes('execute_command')) {
    capabilities.add('process.exec');
    capabilities.add('filesystem.read');
    capabilities.add('filesystem.write');
  }

  return Array.from(capabilities).sort();
}

function decideWorkspaceMode(
  mode: WorkspacePolicy['mode'] | undefined,
  capabilities: ToolExecutionCapability[],
  policy?: WorkspacePolicy,
  workspace?: WorkspaceRef
): Pick<ToolSandboxTrace, 'effect' | 'code' | 'reason'> | undefined {
  const requiresWorkspace = capabilities.some((capability) =>
    capability === 'process.exec' || capability === 'filesystem.write'
  );
  if (!requiresWorkspace) return undefined;

  if (mode === 'none') {
    return {
      effect: 'deny',
      code: 'workspace_mode_none',
      reason: 'Workspace mode is none; process or filesystem-mutating tool execution is not allowed.'
    };
  }

  if (isPerAgentSandboxPolicy(policy ?? { mode: mode ?? 'none' }) && isPerAgentDockerWorkspace(workspace)) {
    return undefined;
  }

  const denyUnsupportedModes = policy?.sandbox?.denyUnsupportedModes !== false;
  if ((mode === 'docker' || mode === 'remote') && denyUnsupportedModes) {
    return {
      effect: 'deny',
      code: 'workspace_backend_unavailable',
      reason: `${mode} workspace backend is reserved but not provisioned; refusing to execute the tool locally.`
    };
  }

  return undefined;
}

function decideCapabilityPolicy(
  policy: WorkspacePolicy | undefined,
  capabilities: ToolExecutionCapability[]
): Pick<ToolSandboxTrace, 'effect' | 'code' | 'reason'> | undefined {
  if (!policy?.sandbox) return undefined;
  const denied = new Set((policy.sandbox.denyCapabilities || []).filter(isToolExecutionCapability));
  const explicitlyAllowed = new Set((policy.sandbox.allowCapabilities || []).filter(isToolExecutionCapability));
  const deniedCapability = capabilities.find((capability) => denied.has(capability));
  if (deniedCapability) {
    return {
      effect: 'deny',
      code: 'capability_denied',
      reason: `Capability ${deniedCapability} is denied by workspace sandbox policy.`
    };
  }

  if (explicitlyAllowed.size > 0) {
    const missing = capabilities.find((capability) => !explicitlyAllowed.has(capability));
    if (missing) {
      return {
        effect: 'deny',
        code: 'capability_not_allowlisted',
        reason: `Capability ${missing} is not allow-listed by workspace sandbox policy.`
      };
    }
  }

  return undefined;
}

function decideWritePolicy(
  policy: WorkspacePolicy | undefined,
  capabilities: ToolExecutionCapability[]
): Pick<ToolSandboxTrace, 'effect' | 'code' | 'reason'> | undefined {
  if (policy?.writes !== 'read-only') return undefined;
  if (!capabilities.includes('filesystem.write') && !capabilities.includes('process.exec')) return undefined;
  return {
    effect: 'deny',
    code: 'workspace_readonly',
    reason: 'Workspace write policy is read-only; write-capable or process execution tools are not allowed.'
  };
}

function decideNetworkPolicy(
  policy: WorkspacePolicy | undefined,
  capabilities: ToolExecutionCapability[]
): Pick<ToolSandboxTrace, 'effect' | 'code' | 'reason'> | undefined {
  if (policy?.network !== 'disabled') return undefined;
  if (!capabilities.includes('network')) return undefined;
  return {
    effect: 'deny',
    code: 'network_disabled',
    reason: 'Workspace network policy is disabled; network-capable tool execution is not allowed.'
  };
}

function summarizePolicy(policy: WorkspacePolicy | undefined): Record<string, unknown> | undefined {
  if (!policy) return undefined;
  return {
    mode: policy.mode,
    network: policy.network,
    writes: policy.writes,
    cleanup: policy.cleanup,
    resourceLimits: policy.resourceLimits,
    sandbox: policy.sandbox
      ? {
          enabled: policy.sandbox.enabled,
          allowCapabilities: policy.sandbox.allowCapabilities,
          denyCapabilities: policy.sandbox.denyCapabilities,
          denyUnsupportedModes: policy.sandbox.denyUnsupportedModes,
          envAllowlist: policy.sandbox.envAllowlist
        }
      : undefined
  };
}

function summarizeWorkspace(workspace: WorkspaceRef | undefined): Record<string, unknown> | undefined {
  if (!workspace) return undefined;
  return {
    workspaceId: workspace.workspaceId,
    mode: workspace.mode,
    rootDir: workspace.rootDir,
    metadata: workspace.metadata
  };
}

function isToolExecutionCapability(value: unknown): value is ToolExecutionCapability {
  return value === 'filesystem.read' ||
    value === 'filesystem.write' ||
    value === 'process.exec' ||
    value === 'network' ||
    value === 'secrets';
}