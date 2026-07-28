import type { StructuredPrompt } from '../services/agents/prompt/types.js';
import type { RagKnowledgeScope } from './rag.js';

export interface ToolResult {
  success: boolean;
  content?: string;
  data?: any;
  error?: string;
}

export type ToolExecutionSource = 'local' | 'mcp' | 'runtime';
export type ToolExecutionRiskLevel = 'low' | 'medium' | 'high';
export type ToolExecutionCapability =
  | 'filesystem.read'
  | 'filesystem.write'
  | 'process.exec'
  | 'network'
  | 'secrets';

export interface ToolSandboxTrace {
  effect: 'allow' | 'deny';
  code?: string;
  reason?: string;
  capabilities?: ToolExecutionCapability[];
  policy?: Record<string, unknown>;
  workspace?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface ToolRetryPolicy {
  maxAttempts?: number;
  backoffMs?: number;
  retryOn?: string[];
  allowNonReadonly?: boolean;
}

export interface ToolExecutionPolicy {
  'readonly'?: boolean;
  parallelizable?: boolean;
  concurrencySafe?: boolean;
  timeoutMs?: number;
  retryPolicy?: ToolRetryPolicy;
  riskLevel?: ToolExecutionRiskLevel;
  capabilities?: ToolExecutionCapability[];
}

export interface ToolExecutionValidationTrace {
  ok: boolean;
  missingRequired: string[];
  typeErrors: string[];
  warning?: string;
  code?: string;
}

export interface ToolExecutionErrorTrace {
  code: string;
  message: string;
  retryable?: boolean;
  attempt?: number;
  details?: unknown;
}

export interface MCPToolSchemaTrace {
  originalInputSchema?: unknown;
  modelInputSchema?: unknown;
  removedKeywords?: string[];
  mode?: 'raw' | 'provider_compatible';
}

export interface MCPToolExecutionTrace {
  serverId?: string;
  serverName?: string;
  transportType?: 'stdio' | 'sse' | 'streamable-http';
  toolName?: string;
  status?: 'ok' | 'error';
  clientReused?: boolean;
  reconnectReason?: string;
  connectedAt?: string;
  durationMs?: number;
  schema?: MCPToolSchemaTrace;
  error?: ToolExecutionErrorTrace;
}

export interface ToolExecutionTrace {
  envelopeId?: string;
  toolId?: string;
  exposedName?: string;
  originalName?: string;
  source?: ToolExecutionSource;
  schemaVersion?: string;
  validation?: ToolExecutionValidationTrace;
  riskLevel?: ToolExecutionRiskLevel;
  'readonly'?: boolean;
  parallelizable?: boolean;
  concurrencySafe?: boolean;
  timeoutMs?: number;
  retryPolicy?: Required<Pick<ToolRetryPolicy, 'maxAttempts' | 'backoffMs'>> &
    Pick<ToolRetryPolicy, 'retryOn' | 'allowNonReadonly'>;
  attempts?: number;
  durationMs?: number;
  error?: ToolExecutionErrorTrace;
  sandbox?: ToolSandboxTrace;
  mcp?: MCPToolExecutionTrace;
}

export type AgentRuntimeMode = 'classic' | 'react';
export type AgentToolErrorStrategy = 'observe-and-continue' | 'stop';
export type AgentStopReason =
  | 'final'
  | 'max_rounds'
  | 'max_tool_calls'
  | 'tool_error'
  | 'empty_response'
  | 'permission_required'
  | 'needs_input'
  | 'cancelled'
  | 'budget_exceeded'
  | 'repeated_tool_error'
  | 'repeated_tool_observation'
  | 'invalid_tool_arguments';

export interface AgentRuntimeConfig {
  mode?: AgentRuntimeMode;
  maxRounds?: number;
  maxToolCalls?: number;
  maxToolCallsPerRound?: number;
  returnTrace?: boolean;
  /** @deprecated Tool failures are always returned to the model; this flag no longer stops the run. */
  toolErrorStrategy?: AgentToolErrorStrategy;
  maxRepeatedToolErrors?: number;
  stopOnRepeatedToolError?: boolean;
}

export interface AgentToolCallTrace {
  id?: string;
  name: string;
  arguments: unknown;
  rawArguments?: unknown;
  parseError?: string;
  exposedName?: string;
  originalName?: string;
  mcpServerId?: string;
  execution?: ToolExecutionTrace;
}

export interface AgentToolObservation {
  toolCallId?: string;
  toolName: string;
  success: boolean;
  content: string;
  data?: unknown;
  error?: string;
  durationMs: number;
  exposedName?: string;
  originalName?: string;
  mcpServerId?: string;
  artifactId?: string;
  execution?: ToolExecutionTrace;
}

export interface AgentRunRound {
  index: number;
  assistantContent: string;
  toolCalls: AgentToolCallTrace[];
  observations: AgentToolObservation[];
  usage?: unknown;
  provider?: {
    providerId?: string;
    providerName?: string;
    model?: string;
    fallbackUsed?: boolean;
    retryCount?: number;
    attempts?: unknown[];
    capabilities?: string[];
    health?: unknown[];
  };
  budget?: {
    modelCalls?: number;
    inputTokens?: number;
    outputTokens?: number;
    estimatedCostUsd?: number;
    limits?: Record<string, unknown>;
    exceeded?: string[];
  };
}

export interface AgentRunTrace {
  runId: string;
  mode: AgentRuntimeMode;
  startedAt: string;
  finishedAt?: string;
  rounds: AgentRunRound[];
}

export interface ToolDefinition {
  id: string;
  name: string;
  displayName?: string;
  description: string;
  parameters: any; // JSON Schema
  isBuiltin?: boolean;
  scope?: 'agent' | 'workflow' | 'system' | 'both';
  execution?: ToolExecutionPolicy;
  uiHints?: Record<string, unknown>;
}

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  instructions: string;
  files: string[];
  dirPath: string;
}

export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  systemPrompt: string | StructuredPrompt;
  providerId: string;
  model: string;
  temperature: number;
  toolIds: string[];
  skillIds: string[];
  mcpServerIds: string[];
  streaming?: boolean;
  isHidden?: boolean;
  category?: string;
  knowledgeScope?: RagKnowledgeScope;
  knowledgeCategoryIds?: string[];
  knowledgeSaveCategoryIds?: string[];
  memoryCategoryIds?: string[];
  memorySaveCategoryIds?: string[];
  runtime?: AgentRuntimeConfig;
  metadata?: Record<string, unknown>;
}

export type WorkflowStepType =
  | 'agent'
  | 'workflow'
  | 'tool'
  | 'adapter'
  | 'store-query'
  | 'store-write'
  | 'kv-write'
  | 'kv-read'
  | 'transform'
  | 'batch-iterate'
  | 'router'
  | 'human-approval';

export interface WorkflowInputTransformSpec {
  operations?: Array<Record<string, unknown>>;
}

/**
 * 工作流运行时入参声明。主要用于兼容历史工作流和少量需要外部输入的 $.input 引用；
 * 新工作流的筛选条件、运行策略等参数优先写在具体步骤 config 中。
 */
export type WorkflowInputFieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'select'
  | 'multiselect'
  | 'date'
  | 'string-array'
  | 'json';

export interface WorkflowInputField {
  key: string;
  label: string;
  description?: string;
  type: WorkflowInputFieldType;
  required?: boolean;
  default?: unknown;
  options?: Array<{ value: string; label: string }>;
  /** 是否允许把字段切换为「变量表达式」（${date} 等）。 */
  allowVariables?: boolean;
  group?: string;
  placeholder?: string;
  min?: number;
  max?: number;
}

export interface WorkflowInputSpec {
  fields: WorkflowInputField[];
  /** 允许运行时提供额外的自由 JSON 入参（合并到 values）。 */
  allowExtraJson?: boolean;
}

export interface WorkflowStep {
  id: string;
  type?: WorkflowStepType;
  displayName?: string;
  agentId?: string;
  workflowId?: string;
  toolId?: string;
  skillId?: string;
  /** 业务步骤配置：当 type 为 adapter / store-query / store-write / kv-write / transform / batch-iterate 时使用。 */
  config?: Record<string, unknown>;
  inputMap?: Record<string, string>; // Maps output from previous steps to current input
  inputTemplate?: unknown;
  outputMap?: Record<string, string>;
  /** Runs before step execution; merged into tool step output for downstream refs. */
  inputTransform?: WorkflowInputTransformSpec;
  knowledgeScope?: RagKnowledgeScope;
  nextStepIds?: string[]; // Successor step ids (parallel branching when multiple)
  condition?: string; // Optional simple logic
  enabled?: boolean;
  metadata?: Record<string, unknown>;
  execution?: {
    mode?: 'single' | 'batch';
    batchSize?: number;
    itemsPath?: string;
    batchTargetPath?: string;
    inputTemplate?: unknown;
    mergeStrategy?: 'jsonArrayMerge' | 'markdownSectionMerge' | 'textJoin' | 'rawArray' | string;
    itemFields?: string[];
    itemFieldLimits?: Record<string, number>;
    payloadFieldLimits?: Record<string, number>;
    onBatchParseError?: 'fail' | 'retry' | 'splitAndRetry';
    onBatchItemCountMismatch?: 'fail' | 'retry' | 'splitAndRetry';
    maxBatchRetries?: number;
    minBatchSize?: number;
    validateBatchItemCount?: boolean;
    reindexField?: string;
    validateJsonObject?: boolean;
    validateCoverage?: {
      inputItemsPath?: string;
      outputCollections?: string[];
      sourceItemsField?: string;
      idField?: string;
    };
    maxAgentRetries?: number;
  };
  /** Per-step options for agent execution. */
  agentOptions?: {
    noTools?: boolean;
    noSkills?: boolean;
  };
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  initialStepId: string;
  /** 工作流运行时入参声明；保留用于兼容历史 $.input 驱动的工作流。 */
  inputSpec?: WorkflowInputSpec;
  outputSpec?: unknown;
  templateVariables?: unknown;
  metadata?: Record<string, unknown>;
}

export interface AgentExecutionResult {
  content: string;
  toolCalls?: AgentToolCallTrace[];
  data?: any;
  usage?: any;
  stopReason?: AgentStopReason;
  trace?: AgentRunTrace;
}

export interface MCPLifecycleRetryConfig {
  enabled?: boolean;
  maxAttempts?: number;
  backoffMs?: number;
}

export interface MCPLifecycleConfig {
  clientTtlMs?: number;
  toolListTtlMs?: number;
  connectTimeoutMs?: number;
  callTimeoutMs?: number;
  reconnect?: MCPLifecycleRetryConfig;
  schemaMode?: 'raw' | 'provider_compatible';
}

export interface MCPServerConfig {
  id: string;
  name: string;
  description: string;
  transportType: 'stdio' | 'sse' | 'streamable-http';
  // stdio transport
  command?: string;
  args?: string[];
  // sse / streamable-http transport
  url?: string;
  headers?: Record<string, string>;
  // common
  env?: Record<string, string>;
  enabled: boolean;
  lifecycle?: MCPLifecycleConfig;
  execution?: ToolExecutionPolicy;
  metadata?: Record<string, unknown>;
}
