import type { ProviderGovernanceConfig } from '../../../types/config.js';
import type {
  AgentDefinition,
  MCPServerConfig,
  SkillDefinition,
  ToolDefinition,
  WorkflowDefinition
} from '../../../types/agent.js';
import type { AgentSpecSnapshot } from './AgentSpec.js';
import type { ContextPolicy } from './ContextPolicy.js';
import type { ObservationPolicy } from './ObservationPolicy.js';
import type { PermissionPolicy } from './PermissionPolicy.js';
import type { WorkspacePolicy } from './WorkspacePolicy.js';

export type AgentRunSource = 'agent' | 'workflow' | 'builder' | 'eval' | 'scheduler' | 'api' | 'gateway';

export type AgentRunStatus =
  | 'queued'
  | 'running'
  | 'paused'
  | 'cancelling'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'archived';

export type AgentMessageRole = 'system' | 'user' | 'assistant' | 'tool' | 'developer';

export interface AgentMessageContentPart {
  kind: 'text' | 'image' | 'artifact' | 'tool_call' | 'tool_result' | 'reasoning';
  text?: string;
  artifactId?: string;
  mimeType?: string;
  data?: unknown;
  metadata?: Record<string, unknown>;
}

export interface AgentMessage {
  id?: string;
  role: AgentMessageRole;
  content: string | AgentMessageContentPart[];
  name?: string;
  toolCallId?: string;
  createdAt?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentRunInput {
  prompt?: string;
  messages?: AgentMessage[];
  variables?: Record<string, unknown>;
  attachments?: Array<{
    id: string;
    name?: string;
    uri?: string;
    mimeType?: string;
    metadata?: Record<string, unknown>;
  }>;
}

export interface AgentBudgetPolicy {
  maxRounds?: number;
  maxModelCalls?: number;
  maxToolCalls?: number;
  maxToolCallsPerRound?: number;
  maxInputTokens?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  maxCostUsd?: number;
  providerGovernance?: ProviderGovernanceConfig;
}

export interface AgentRunContextMetadata {
  contextProtocolVersion: 'pi-context-v2';
  turnId?: string;
  turnContextFingerprint?: string;
  stablePrefixHash?: string;
  variantHash?: string;
  toolsetHash?: string;
}

export interface AgentRunOutput {
  content: string;
  data?: unknown;
  usage?: unknown;
  stopReason?: string;
  toolCalls?: unknown[];
  trace?: unknown;
  artifacts?: Array<{
    artifactId: string;
    kind: string;
    uri?: string;
    preview?: string;
    metadata?: Record<string, unknown>;
  }>;
  metadata?: Record<string, unknown>;
}

export interface AgentRunSpec {
  runId: string;
  sessionId: string;
  threadId?: string;
  source: AgentRunSource;
  input: AgentRunInput;
  agentSpec?: AgentSpecSnapshot;
  agentDef?: AgentDefinition;
  temporaryAgentDef?: AgentDefinition;
  workflowDef?: WorkflowDefinition;
  tools?: ToolDefinition[];
  skills?: SkillDefinition[];
  mcpConfigs?: MCPServerConfig[];
  skillInstructions?: string[];
  permissionPolicy?: PermissionPolicy;
  contextPolicy?: ContextPolicy;
  observationPolicy?: ObservationPolicy;
  workspacePolicy?: WorkspacePolicy;
  budgetPolicy?: AgentBudgetPolicy;
  metadata?: Record<string, unknown> & Partial<AgentRunContextMetadata>;
}