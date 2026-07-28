import { request } from './api';
import { devLogger } from '../utils/devLogger';
import { redirectToLogin } from '../utils/authRedirect';
import {
  normalizeAgentEventItem,
  normalizeAgentEvents,
  parseSseFrames,
  type AgentEventItem
} from '../utils/agentEvents';

export interface Tool {
  id: string;
  name: string;
  displayName?: string;
  description: string;
  parameters: any;
  isBuiltin?: boolean;
  scope?: 'agent' | 'workflow' | 'system' | 'both';
  uiHints?: Record<string, unknown>;
}

export interface ToolResult {
  success: boolean;
  content?: string;
  data?: any;
  error?: string;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  instructions: string;
  files: string[];
  dirPath: string;
  isBuiltin?: boolean;
}

export interface SkillScanResult {
  status: 'success';
  added: number;
  removed: number;
  updated: number;
  unchanged: number;
  scanned: number;
}

export type AgentRuntimeMode = 'classic' | 'react';
export type AgentToolErrorStrategy = 'observe-and-continue' | 'stop';

export interface AgentRuntimeConfig {
  mode?: AgentRuntimeMode;
  maxRounds?: number;
  returnTrace?: boolean;
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
}

export interface AgentRunRound {
  index: number;
  assistantContent: string;
  toolCalls: AgentToolCallTrace[];
  observations: AgentToolObservation[];
  usage?: unknown;
}

export interface AgentRunTrace {
  runId: string;
  mode: AgentRuntimeMode;
  startedAt: string;
  finishedAt?: string;
  rounds: AgentRunRound[];
}

export interface AgentExecutionResult {
  content: string;
  toolCalls?: AgentToolCallTrace[];
  data?: unknown;
  usage?: unknown;
  stopReason?:
    | 'final'
    | 'max_rounds'
    | 'tool_error'
    | 'empty_response'
    | 'repeated_tool_error'
    | 'invalid_tool_arguments';
  trace?: AgentRunTrace;
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  providerId: string;
  model: string;
  temperature: number;
  toolIds: string[];
  skillIds: string[];
  mcpServerIds: string[];
  streaming?: boolean;
  isHidden?: boolean;
  category?: string;
  knowledgeCategoryIds?: string[];
  knowledgeSaveCategoryIds?: string[];
  memoryCategoryIds?: string[];
  memorySaveCategoryIds?: string[];
  runtime?: AgentRuntimeConfig;
  metadata?: Record<string, unknown>;
}

// --- Agent Run Platform Types ---

export type AgentRunSource = 'agent' | 'workflow' | 'builder' | 'eval' | 'scheduler' | 'api';
export type AgentRunStatus =
  | 'queued'
  | 'running'
  | 'paused'
  | 'cancelling'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'archived';

export type { AgentEventItem } from '../utils/agentEvents';

export interface AgentRunArtifact {
  artifactId: string;
  kind: string;
  uri?: string;
  preview?: string;
  sizeBytes?: number;
  createdAt?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentRunCheckpoint {
  checkpointId: string;
  runId: string;
  sessionId: string;
  reason?: string;
  status: AgentRunStatus;
  createdAt: string;
  pendingPermission?: unknown;
  workspace?: unknown;
  state?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface AgentRunOutput {
  content?: string;
  data?: unknown;
  usage?: unknown;
  stopReason?: string;
  toolCalls?: unknown[];
  trace?: unknown;
  artifacts?: AgentRunArtifact[];
  metadata?: Record<string, unknown>;
}

export interface AgentRunMessage {
  id?: string;
  role: string;
  content: unknown;
  name?: string;
  toolCallId?: string;
  createdAt?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentSpecSnapshot {
  schemaVersion: 'agent-spec-v1';
  specId: string;
  revision: string;
  agentId: string;
  name: string;
  description: string;
  prompt: {
    system: string;
  };
  model: {
    providerId: string;
    model: string;
    temperature: number;
    streaming?: boolean;
  };
  tools: {
    toolIds: string[];
    skillIds: string[];
    mcpServerIds: string[];
  };
  knowledge?: {
    readCategoryIds?: string[];
    writeCategoryIds?: string[];
  };
  memory?: {
    readCategoryIds?: string[];
    writeCategoryIds?: string[];
  };
  runtime?: AgentRuntimeConfig;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface AgentRun {
  runId: string;
  sessionId: string;
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
  roundCount: number;
  toolCallCount: number;
  artifactCount: number;
  checkpointCount: number;
  pendingPermission?: unknown;
  stopReason?: string;
  error?: string;
  outputPreview?: string;
  output?: AgentRunOutput | null;
  checkpoints?: AgentRunCheckpoint[];
  artifacts?: AgentRunArtifact[];
  workspace?: unknown;
  messages?: AgentRunMessage[];
  eventCount?: number;
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
  search?: string;
}

export interface AgentRunPage {
  items: AgentRun[];
  total: number;
  offset: number;
  limit: number;
}

export interface StartAgentRunRequest {
  agentId: string;
  message: string;
  date?: string;
  noTools?: boolean;
  noSkills?: boolean;
  threadId?: string;
  sessionId?: string;
  editorData?: Record<string, unknown>;
  files?: Array<{
    fileId: string;
    name?: string;
    mimeType?: string;
    size?: number;
    url?: string;
  }>;
  messages?: unknown[];
  metadata?: Record<string, unknown>;
}

export interface StartAgentRunResult {
  runId: string;
  sessionId: string;
  threadId?: string;
  status: AgentRunStatus;
  source?: AgentRunSource;
  agentId?: string;
  createdAt: string;
}

export type AgentHitlAction =
  | 'allow'
  | 'deny'
  | 'edit_arguments'
  | 'provide_input'
  | 'external_result'
  | 'cancel';

export type AgentHitlKind =
  | 'permission'
  | 'confirmation'
  | 'argument_edit'
  | 'needs_input'
  | 'external_execution';

export interface AgentHitlRequest {
  requestId: string;
  kind: AgentHitlKind;
  status?: 'pending';
  prompt?: string;
  schema?: unknown;
  proposedArguments?: unknown;
  allowedActions?: AgentHitlAction[];
  permissionId?: string;
  checkpointId?: string;
  createdAt?: string;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
}

export interface PendingHitlItem extends AgentHitlRequest {
  runId: string;
  sessionId: string;
  runStatus: AgentRunStatus;
}

export interface RunHitlState {
  runId: string;
  sessionId: string;
  threadId?: string;
  status: AgentRunStatus;
  pendingHitl: AgentHitlRequest | null;
}

export interface ResolveRunHitlRequest {
  action: AgentHitlAction;
  kind?: AgentHitlKind;
  reason?: string;
  editedArguments?: unknown;
  input?: unknown;
  externalResult?: unknown;
  metadata?: Record<string, unknown>;
}

export interface PermissionSubject {
  toolName: string;
  exposedName?: string;
  actionKind?: string;
  riskLevel?: string;
  resourceUri?: string;
}

export interface PermissionRequest {
  permissionId: string;
  runId: string;
  sessionId: string;
  subject: PermissionSubject;
  arguments?: unknown;
  reason?: string;
  requestedAt: string;
}

export interface PendingPermissionItem {
  kind: 'agent' | 'workflow';
  runId?: string;
  sessionId?: string;
  agentId?: string;
  workflowId?: string;
  workflowRunId?: string;
  workflowName?: string;
  stepId?: string;
  stepDisplayName?: string;
  permission: PermissionRequest;
  runStatus: AgentRunStatus;
  createdAt: string;
}

export interface PermissionHistoryItem {
  runId: string;
  sessionId: string;
  agentId?: string;
  permissionId: string;
  toolName?: string;
  effect: 'allow' | 'deny';
  reason?: string;
  resolvedBy?: string;
  requestedAt: string;
  resolvedAt: string;
  kind?: 'agent' | 'workflow';
  workflowId?: string;
  workflowRunId?: string;
  stepId?: string;
}

export interface AgentRunReplaySnapshot {
  runId: string;
  sessionId: string;
  status: AgentRunStatus;
  events: AgentEventItem[];
  output?: AgentRunOutput | null;
  trace?: unknown;
  messages?: AgentRunMessage[];
}

export interface AgentRunReplayResult {
  originalRunId: string;
  original: AgentRunReplaySnapshot;
  replayRunId?: string;
  replaySessionId?: string;
  replayStatus?: string;
}

export interface AgentRunMetrics {
  totalRuns: number;
  terminalRuns: number;
  activeRuns: number;
  succeeded: number;
  failed: number;
  cancelled: number;
  paused: number;
  running: number;
  queued: number;
  successRate: number;
  failureRate: number;
  pauseRate: number;
  permissionInterceptRate: number;
  pendingPermissions: number;
  averageDurationMs: number;
  p50DurationMs: number;
  p90DurationMs: number;
  durationBuckets: Array<{ label: string; count: number }>;
  toolFailures: Array<{ toolName: string; failures: number; total: number }>;
  tokenUsage: {
    totalTokens: number;
    promptTokens: number;
    completionTokens: number;
    modelCallCount: number;
  };
  generatedAt: string;
}

export type AgentRunAlertType = 'consecutive_failures' | 'pending_permission_pileup' | 'stuck_run';

export interface AgentRunAlert {
  id: string;
  type: AgentRunAlertType;
  severity: 'warning' | 'critical';
  message: string;
  runId?: string;
  agentId?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export type WorkflowRunSource = 'manual' | 'scheduler' | 'api';
export type WorkflowRunStatus =
  | 'queued'
  | 'running'
  | 'paused'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'timeout';
export type WorkflowRunStepStatus =
  | 'pending'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'skipped';

export interface WorkflowRunStepRecord {
  stepId: string;
  displayName?: string;
  agentId?: string;
  stepType?: string;
  nextStepIds?: string[];
  status: WorkflowRunStepStatus;
  error?: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface WorkflowRunRecord {
  workflowRunId: string;
  workflowId: string;
  workflowName?: string;
  source: WorkflowRunSource;
  scheduleId?: string;
  status: WorkflowRunStatus;
  date?: string;
  createdAt: string;
  updatedAt: string;
  finishedAt?: string;
  durationMs?: number;
  error?: string;
  failedStepId?: string;
  steps: WorkflowRunStepRecord[];
  metadata?: Record<string, unknown>;
}

export interface WorkflowRunPage {
  items: WorkflowRunRecord[];
  total: number;
  offset: number;
  limit: number;
}

export interface PermissionMatrixEntry {
  toolId: string;
  toolName: string;
  scope?: string;
  actionKind: string;
  riskLevel: string;
  effect: 'allow' | 'ask' | 'deny';
  reason?: string;
}

export interface SourceQualityConfig {
  sourceBlacklist: string[];
  sourceWhitelist: string[];
  minAiScore: number;
  blockedTiers: Array<'official' | 'mainstream' | 'community' | 'aggregator' | 'unknown'>;
  demoteLowTier: boolean;
  updatedAt?: string;
}

export interface SourceQualityStatus extends SourceQualityConfig {
  enabled: boolean;
}

export type AgentEvalScorerKind =
  | 'contains'
  | 'not_contains'
  | 'exact_match'
  | 'json_parse'
  | 'json_schema'
  | 'tool_call';

export interface AgentEvalJsonSchema {
  type?: 'object' | 'array' | 'string' | 'number' | 'boolean';
  required?: string[];
  properties?: Record<string, AgentEvalJsonSchema>;
  items?: AgentEvalJsonSchema;
}

export interface AgentEvalScorer {
  id?: string;
  kind: AgentEvalScorerKind;
  value?: string;
  values?: string[];
  caseSensitive?: boolean;
  schema?: AgentEvalJsonSchema;
  toolName?: string;
  weight?: number;
  metadata?: Record<string, unknown>;
}

export interface AgentEvalBaselineRef {
  id?: string;
  agentId?: string;
  model?: string;
  promptRevision?: string;
  policyRevision?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentEvalReplaySpec {
  sourceRunId?: string;
  checkpointId?: string;
  mode?: 'input' | 'checkpoint' | 'messages';
}

export interface AgentEvalReplayResult {
  sourceRunId?: string;
  checkpointId?: string;
  mode: 'input' | 'checkpoint' | 'messages';
  messageCount: number;
}

export interface AgentEvalScore {
  scorerId: string;
  kind: AgentEvalScorerKind | 'execution_error';
  passed: boolean;
  score: number;
  weight: number;
  message: string;
  details?: Record<string, unknown>;
}

export interface RegressionSample {
  id: string;
  name: string;
  agentId: string;
  prompt: string;
  expectedContains?: string[];
  tags?: string[];
  datasetId?: string;
  input?: {
    prompt?: string;
    messages?: Array<{ role: 'user' | 'assistant' | 'system' | 'tool'; content: string | null }>;
    variables?: Record<string, unknown>;
  };
  scorers?: AgentEvalScorer[];
  baseline?: AgentEvalBaselineRef;
  replay?: AgentEvalReplaySpec;
  execution?: {
    tools?: 'disabled' | 'enabled';
    skills?: 'default' | 'disabled';
    timeoutMs?: number;
    maxModelCalls?: number;
    maxToolCalls?: number;
  };
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface RegressionRunRecord {
  runId: string;
  sampleId: string;
  sampleName: string;
  agentId: string;
  passed: boolean;
  outputPreview: string;
  mismatches: string[];
  durationMs?: number;
  createdAt: string;
  datasetId?: string;
  baseline?: AgentEvalBaselineRef;
  replay?: AgentEvalReplayResult;
  scores?: AgentEvalScore[];
  score?: number;
  output?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface RegressionRunSummary {
  total: number;
  passed: number;
  failed: number;
  records: RegressionRunRecord[];
  score?: number;
  datasetIds?: string[];
}

export interface GovernanceStatus {
  policyVersion: string;
  toolCount: number;
  askCount: number;
  denyCount: number;
  allowCount: number;
  pendingPermissions: number;
  externalContentGuardEnabled: boolean;
  outputValidationEnabled: boolean;
  matrix: PermissionMatrixEntry[];
}

export type AiBuildTarget = 'agent' | 'skill' | 'workflow';
export type AiBuildMode = 'create' | 'update';
export type BuilderMode = 'chat' | 'plan' | 'build';
export type PlanPhase = 'discover' | 'generate';
export type PlanLifecycleStatus =
  | 'draft'
  | 'pending_validation'
  | 'ready'
  | 'building'
  | 'applied'
  | 'failed';
export type BuilderStateId = 'chat' | 'plan' | 'build' | 'dryRun' | 'apply' | 'result';
export type AiBuildReusePolicy = 'preferExisting' | 'allowCreate' | 'existingOnly';

export interface AiBuildResourcePolicy {
  reusePolicy: AiBuildReusePolicy;
  allowResourceCreation: boolean;
  reason: string;
  source: 'server' | 'client';
  signature?: string;
}

export interface BuilderContextMemory {
  goalSummary: string;
  decisions: Array<{ id: string; label: string; value: unknown; source?: string }>;
  openQuestions: Array<{ id: string; prompt: string; required?: boolean; answered?: boolean }>;
  resourceRefs: Array<{
    type: AiBuilderMention['type'];
    id?: string;
    target?: AiBuildTarget;
    label: string;
    purpose?: string;
  }>;
  planState?: {
    activePlanId?: string;
    activePlanVersion?: number;
    activePlanStatus?: PlanLifecycleStatus;
    summary?: string;
    supersededPlans?: Array<{ id: string; version?: number; summary: string }>;
  };
  buildState?: {
    lastAttemptId?: string;
    status?: PlanLifecycleStatus;
    failedAt?: string;
    partialWriteRisk?: boolean;
  };
  recentTurns: AiBuildChatMessage[];
  sourceMessageRange?: { start: number; end: number };
  sourceArtifactIds?: string[];
  updatedAt: string;
}

export interface BuilderStateNode {
  id: BuilderStateId;
  label: string;
  description: string;
  status: 'completed' | 'active' | 'available' | 'blocked' | 'pending';
}

export interface BuilderStateTransition {
  from: BuilderStateId;
  to: BuilderStateId;
  label: string;
  available: boolean;
  reason?: string;
}

export interface BuilderStateGraph {
  current: BuilderStateId;
  nodes: BuilderStateNode[];
  transitions: BuilderStateTransition[];
  nextActions: Array<{
    id: string;
    label: string;
    targetState: BuilderStateId;
    primary?: boolean;
    disabled?: boolean;
    reason?: string;
  }>;
  updatedAt: string;
}

export interface CapabilityGraphNode {
  id: string;
  type: AiBuildTarget | 'tool' | 'mcp' | 'input' | 'output';
  label: string;
  action: 'reuse' | 'create' | 'update' | 'reference' | 'produce';
  status: 'planned' | 'ready' | 'changed' | 'blocked';
  summary?: string;
  ref?: string;
  riskLevel?: 'low' | 'medium' | 'high';
}

export interface CapabilityGraphEdge {
  id: string;
  from: string;
  to: string;
  label: string;
  fieldRefs?: string[];
}

export interface CapabilityGraph {
  id: string;
  target: AiBuildTarget;
  nodes: CapabilityGraphNode[];
  edges: CapabilityGraphEdge[];
  summary: {
    reuse: number;
    create: number;
    update: number;
    risks: number;
  };
  updatedAt: string;
}

export interface PlanContractFieldRef {
  id: string;
  label: string;
  path: string;
  source: 'input' | 'state' | 'node' | 'output';
  required?: boolean;
  valueType?: string;
}

export interface PlanContract {
  id: string;
  target: AiBuildTarget;
  mode: AiBuildMode;
  goal: string;
  inputSchema?: unknown;
  outputSchema?: unknown;
  constraints: string[];
  acceptanceCriteria: string[];
  fieldRefs: PlanContractFieldRef[];
  resourcePolicy: AiBuildResourcePolicy;
  status: 'draft' | 'ready' | 'locked';
  updatedAt: string;
}

export interface PlanLineage {
  draftId?: string;
  draftVersion?: number;
  planId?: string;
  planVersion?: number;
  contractId?: string;
  capabilityGraphId?: string;
  checkpointId?: string;
  parentCheckpointId?: string;
}

export interface BuilderCheckpoint {
  id: string;
  type: 'message' | 'questions' | 'plan_draft' | 'plan' | 'dry_run' | 'build';
  summary: string;
  state: BuilderStateId;
  lineage?: PlanLineage;
  answers?: Record<string, unknown>;
  riskAccepted?: boolean;
  partialWriteRisk?: boolean;
  createdAt: string;
}

export interface WorkflowPlanStep {
  id: string;
  goal: string;
  kind: WorkflowStepType;
  consumes?: string[];
  produces?: string[];
  resourceRef?: string;
  needsNewAgent?: boolean;
  needsNewSkill?: boolean;
  /** Pipeline 步骤的完整配置（与 StepCatalog defaultConfig 合并）。 */
  config?: Record<string, unknown>;
  /** Pipeline 步骤的配置覆盖（合并到 defaultConfig 之上）。 */
  configOverrides?: Record<string, unknown>;
  execution?: WorkflowStep['execution'];
  agentOptions?: WorkflowStep['agentOptions'];
}

export interface WorkflowPlan {
  id?: string;
  name: string;
  description?: string;
  inputSchema?: WorkflowInputSpec | unknown;
  outputSchema?: unknown;
  steps: WorkflowPlanStep[];
}

export interface AiBuildStepTypeDescriptor {
  type: WorkflowStepType;
  label: string;
  category: 'pipeline' | 'classic';
  description: string;
  builderHints?: {
    input?: string;
    output?: string;
    useWhen?: string;
    configGuidance?: string;
    commonRefs?: string[];
  };
  configFields?: Array<{
    key: string;
    label: string;
    type: string;
    required?: boolean;
    description?: string;
    options?: Array<{ value: string; label: string }>;
  }>;
  defaultConfig?: Record<string, unknown>;
  presets?: Array<{
    id: string;
    label: string;
    description?: string;
    config: Record<string, unknown>;
  }>;
}

export interface AiBuildBusinessEnums {
  feedSourceTypes?: Array<{ value: string; label: string; description?: string }>;
  scoringMetadataKeys?: string[];
  scoringTimestampField?: string;
  dailyReportJsonKeyTemplate?: string;
  dailyReportJsonIndexKey?: string;
  adapterAllValue?: string;
}

export interface AiBuildDomainPipelinePattern {
  id: string;
  label: string;
  description?: string;
  steps: WorkflowStepType[];
  configGuidance?: string[];
}

export interface AiBuildDomainDescriptor {
  id: string;
  label: string;
  description?: string;
  enums?: Record<string, unknown>;
  keyTemplates?: Record<string, string>;
  pipelinePatterns?: AiBuildDomainPipelinePattern[];
}

export interface AiBuildDomainCatalog {
  domains: AiBuildDomainDescriptor[];
}

export interface AiBuildCatalog {
  agents: Array<
    Pick<Agent, 'id' | 'name' | 'description' | 'toolIds' | 'skillIds' | 'mcpServerIds' | 'category' | 'runtime'> & {
      contract?: Record<string, unknown>;
    }
  >;
  tools: Array<Pick<Tool, 'id' | 'name' | 'displayName' | 'description' | 'parameters' | 'scope'>>;
  mcpServers?: Array<Pick<MCPServerConfig, 'id' | 'name' | 'description' | 'transportType' | 'enabled'>>;
  skills: Array<
    Pick<Skill, 'id' | 'name' | 'description' | 'files'> & {
      instructionsSummary?: string;
      isBuiltin?: boolean;
    }
  >;
  workflows: Array<
    Pick<Workflow, 'id' | 'name' | 'description' | 'inputSpec' | 'outputSpec'> & {
      stepCount: number;
      steps: Array<{
        id: string;
        type: string;
        resourceRef?: string;
        produces?: string[];
        configSummary?: Record<string, unknown>;
      }>;
      contract?: Record<string, unknown>;
    }
  >;
  stepTypes?: AiBuildStepTypeDescriptor[];
  domainCatalog?: AiBuildDomainCatalog;
  businessEnums?: AiBuildBusinessEnums;
  defaults: {
    providerId: string;
    model: string;
  };
}

export type AiBuildChange =
  | { action: 'createAgent'; agent: Agent }
  | { action: 'updateAgent'; agent: Agent }
  | { action: 'createWorkflow'; workflow: Workflow }
  | { action: 'updateWorkflow'; workflow: Workflow }
  | { action: 'createSkillFile'; skillId: string; filePath: string; content: string }
  | { action: 'updateSkillFile'; skillId: string; filePath: string; content: string };

export interface AiBuildDryRunChange {
  action: AiBuildChange['action'];
  resourceType: AiBuildTarget | 'skillFile';
  resourceId: string;
  title: string;
  operation: 'create' | 'update';
  fieldChanges: Array<{ field: string; before?: unknown; after?: unknown }>;
  riskLevel: 'low' | 'medium' | 'high';
  warnings: string[];
}

export interface AiBuildRiskPolicy {
  hasHighRisk: boolean;
  highRiskChangeIds: string[];
  requiresConfirmation: boolean;
  confirmationAccepted?: boolean;
}

export interface AiBuildDryRunResult {
  planId: string;
  planVersion?: number;
  changes: AiBuildDryRunChange[];
  warnings: string[];
  errors: string[];
  dryRunToken?: string;
  sanitizedPlan?: AiBuildPlan;
  riskPolicy?: AiBuildRiskPolicy;
}

export interface AiBuildRequest {
  target: AiBuildTarget;
  mode: AiBuildMode;
  resourceId?: string;
  goal: string;
  inputSchema?: unknown;
  outputRequirement?: string;
  outputSchema?: unknown;
  constraints?: string[];
  reusePolicy?: AiBuildReusePolicy;
  allowResourceCreation?: boolean;
  resourceCreationReason?: string;
  resourcePolicy?: AiBuildResourcePolicy;
}

export interface AiBuildChatMessage {
  role: 'user' | 'assistant';
  content: string;
  mentions?: AiBuilderMention[];
}

export interface AiBuilderMention {
  type: 'create' | 'agent' | 'skill' | 'workflow';
  target?: AiBuildTarget;
  id?: string;
  label: string;
  description?: string;
}

export interface PlanQuestionOption {
  id: string;
  label: string;
  description?: string;
}

export interface PlanQuestion {
  id: string;
  prompt: string;
  type: 'single' | 'multi' | 'text' | 'confirm';
  options?: PlanQuestionOption[];
  required?: boolean;
  defaultOptionId?: string;
}

export interface PlanningQuestion extends PlanQuestion {
  options: PlanQuestionOption[];
  customOptionId?: string;
}

export interface PlanDraft {
  id: string;
  target: AiBuildTarget;
  mode: AiBuildMode;
  title: string;
  summary: string;
  assumptions: string[];
  decisions: Array<{
    id: string;
    label: string;
    value: string;
    confidence?: 'low' | 'medium' | 'high';
  }>;
  questions: PlanningQuestion[];
  proposedResources: Array<{
    type: AiBuildTarget | 'tool' | 'mcp';
    name: string;
    action: 'reuse' | 'create' | 'update';
    reason: string;
    ref?: string;
  }>;
  workflowOutline?: WorkflowPlan;
  risks: string[];
  nextSteps: string[];
  version?: number;
  status?: 'draft' | 'needs_input' | 'ready_for_build';
  stateGraph?: BuilderStateGraph;
  capabilityGraph?: CapabilityGraph;
  contract?: PlanContract;
  lineage?: PlanLineage;
}

export type AiBuildStreamEvent =
  | { type: 'run_started'; runId: string; sessionId: string }
  | { type: 'round_start'; round: number }
  | { type: 'tool_started'; tool: string; args?: unknown }
  | { type: 'tool_finished'; tool: string; success: boolean; summary?: string }
  | { type: 'status'; message: string }
  | { type: 'delta'; content: string }
  | { type: 'needs_input'; message: string }
  | { type: 'questions'; questions: PlanQuestion[] }
  | { type: 'planning_questions'; questions: PlanningQuestion[] }
  | { type: 'plan_draft'; draft: PlanDraft }
  | { type: 'state_graph'; graph: BuilderStateGraph }
  | { type: 'capability_graph'; graph: CapabilityGraph }
  | { type: 'plan_contract'; contract: PlanContract }
  | { type: 'checkpoint'; checkpoint: BuilderCheckpoint }
  | { type: 'context_summary'; summary: string }
  | { type: 'context_memory'; memory: BuilderContextMemory; summary: string }
  | { type: 'plan'; plan: AiBuildPlan }
  | {
      type: 'dry_run';
      result: AiBuildDryRunResult;
      lineage?: PlanLineage;
      checkpoint?: BuilderCheckpoint;
    }
  | { type: 'build_start'; planId: string; total: number }
  | { type: 'build_progress'; step: number; total: number; message: string }
  | {
      type: 'build_done';
      result: AiBuildApplyResult;
      lineage?: PlanLineage;
      checkpoint?: BuilderCheckpoint;
    }
  | {
      type: 'build_failed';
      message: string;
      errors?: string[];
      appliedChanges?: string[];
      lineage?: PlanLineage;
      checkpoint?: BuilderCheckpoint;
    }
  | { type: 'error'; message: string };

export interface AiBuildPlan {
  id: string;
  target: AiBuildTarget;
  mode: AiBuildMode;
  summary: string;
  questions: Array<string | PlanQuestion>;
  warnings: string[];
  resourceChanges: AiBuildChange[];
  workflowPlan?: WorkflowPlan;
  validation: { status: 'ok' | 'needs_input' | 'invalid'; errors: string[] };
  status?: PlanLifecycleStatus;
  version?: number;
  strippedChanges?: string[];
  resourcePolicy?: AiBuildResourcePolicy;
  dryRun?: AiBuildDryRunResult;
  stateGraph?: BuilderStateGraph;
  contract?: PlanContract;
  capabilityGraph?: CapabilityGraph;
  lineage?: PlanLineage;
}

export interface AiBuildApplyResult {
  status: 'success';
  planId: string;
  createdAgents: string[];
  updatedAgents: string[];
  createdWorkflows: string[];
  updatedWorkflows: string[];
  changedSkills: Array<{
    skillId: string;
    filePath: string;
    action: 'createSkillFile' | 'updateSkillFile';
  }>;
}

export interface AiBuildApplyRequest {
  planId: string;
  planVersion?: number;
  dryRunToken: string;
  confirmHighRisk?: boolean;
}

export interface AgentWorkflowReference {
  id: string;
  name: string;
  stepIds: string[];
}

export type WorkflowStepType =
  | 'agent'
  | 'workflow'
  | 'tool'
  | 'adapter'
  | 'store-query'
  | 'store-write'
  | 'kv-write'
  | 'transform'
  | 'batch-iterate';

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
  allowVariables?: boolean;
  group?: string;
  placeholder?: string;
  min?: number;
  max?: number;
}

export interface WorkflowInputSpec {
  fields: WorkflowInputField[];
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
  config?: Record<string, unknown>;
  inputMap?: Record<string, string>;
  inputTemplate?: unknown;
  outputMap?: Record<string, string>;
  inputTransform?: { operations?: Array<Record<string, unknown>> };
  agentOptions?: { noTools?: boolean; noSkills?: boolean };
  execution?: {
    mode?: 'single' | 'batch';
    batchSize?: number;
    itemsPath?: string;
    batchTargetPath?: string;
    inputTemplate?: unknown;
    mergeStrategy?: string;
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
  nextStepIds?: string[];
  condition?: string;
  enabled?: boolean;
  metadata?: Record<string, unknown>;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  initialStepId: string;
  inputSpec?: WorkflowInputSpec | unknown;
  outputSpec?: unknown;
  templateVariables?: unknown;
  metadata?: Record<string, unknown>;
}

export interface WorkflowStepDryRunResult {
  rawInput: unknown;
  transformedInput?: unknown;
  finalInput: unknown;
  errors: string[];
}

export interface WorkflowTemplateSummary {
  id: string;
  name: string;
  description: string;
  category?: string;
  requiredTools?: string[];
  requiredSkills?: string[];
  variables?: Array<{ id: string; name: string; defaultValue?: unknown; description?: string }>;
  agentCount?: number;
  workflowCount?: number;
}

export interface WorkflowTemplate extends WorkflowTemplateSummary {
  agents?: Agent[];
  workflows?: Workflow[];
}

export interface WorkflowTemplateInstantiateResult {
  status: 'success';
  templateId: string;
  createdAgents: string[];
  reusedAgents: string[];
  createdWorkflows: string[];
  reusedWorkflows: string[];
}

export interface MCPServerConfig {
  id: string;
  name: string;
  description: string;
  transportType: 'stdio' | 'sse' | 'streamable-http';
  command?: string;
  args?: string[];
  url?: string;
  headers?: Record<string, string>;
  env?: Record<string, string>;
  enabled: boolean;
}

export const agentService = {
  getAgents: () => request('/api/agents'),
  saveAgent: (agent: Agent) =>
    request('/api/agents', {
      method: 'POST',
      body: JSON.stringify(agent)
    }),
  getAgentWorkflowReferences: (id: string) =>
    request(`/api/agents/${id}/workflow-references`) as Promise<AgentWorkflowReference[]>,
  deleteAgent: (id: string) =>
    request(`/api/agents/${id}`, {
      method: 'DELETE'
    }),
  runAgent: (id: string, input: string, date?: string): Promise<AgentExecutionResult> =>
    request(`/api/agents/${id}/run`, {
      method: 'POST',
      body: JSON.stringify({ input, date })
    }),
  runAgentStream: (id: string, input: string, date?: string, onChunk?: (chunk: any) => void) => {
    const token = localStorage.getItem('auth_token');
    return new Promise((resolve, reject) => {
      const url = `/api/agents/${id}/run?stream=true`;
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ input, date, stream: true })
      })
        .then((response) => {
          if (!response.ok) throw new Error('Network response was not ok');
          const reader = response.body?.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          function read() {
            reader
              ?.read()
              .then(({ done, value }) => {
                if (done) {
                  resolve(null);
                  return;
                }
                buffer += decoder.decode(value, { stream: true });
                try {
                  const parsed = parseSseFrames(buffer, (payload) => JSON.parse(payload));
                  buffer = parsed.rest;
                  parsed.events.forEach((data) => onChunk?.(data));
                  if (parsed.done) {
                    resolve(null);
                    return;
                  }
                } catch (e) {
                  devLogger.error('Error parsing SSE chunk', e);
                }
                read();
              })
              .catch(reject);
          }
          read();
        })
        .catch(reject);
    });
  },

  getSkills: () => request('/api/skills'),
  scanSkills: (): Promise<SkillScanResult> =>
    request('/api/skills/scan', {
      method: 'POST'
    }),
  uploadSkill: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const response = await fetch('/api/skills', {
      method: 'POST',
      headers,
      body: formData
    });
    if (response.status === 401) {
      redirectToLogin();
      throw new Error('Unauthorized');
    }
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(err.error || 'Upload failed');
    }
    return response.json();
  },
  deleteSkill: (id: string) =>
    request(`/api/skills/${id}`, {
      method: 'DELETE'
    }),
  getSkillFiles: (id: string) => request(`/api/skills/${id}/files`),
  getSkillFileContent: (id: string, filePath: string) =>
    request(`/api/skills/${id}/file/${filePath}`),
  saveSkillFileContent: (id: string, filePath: string, content: string) =>
    request(`/api/skills/${id}/file/${filePath}`, {
      method: 'POST',
      body: JSON.stringify({ content })
    }),

  getTools: () => request('/api/tools'),
  runTool: (id: string, args: any): Promise<ToolResult> =>
    request(`/api/tools/${id}/run`, {
      method: 'POST',
      body: JSON.stringify(args)
    }),

  getWorkflows: () => request('/api/workflows'),
  getWorkflowTemplates: (): Promise<WorkflowTemplateSummary[]> =>
    request('/api/workflow-templates'),
  getWorkflowTemplate: (id: string): Promise<WorkflowTemplate> =>
    request(`/api/workflow-templates/${id}`),
  instantiateWorkflowTemplate: (
    id: string,
    body: { variables?: Record<string, unknown>; conflictStrategy?: 'reuse' | 'copy' | 'fail' }
  ): Promise<WorkflowTemplateInstantiateResult> =>
    request(`/api/workflow-templates/${id}/instantiate`, {
      method: 'POST',
      body: JSON.stringify(body)
    }),
  saveWorkflow: (workflow: Workflow) =>
    request('/api/workflows', {
      method: 'POST',
      body: JSON.stringify(workflow)
    }),
  deleteWorkflow: (id: string) =>
    request(`/api/workflows/${id}`, {
      method: 'DELETE'
    }),
  runWorkflow: (id: string, input: any, date?: string, runtimeOptions?: Record<string, unknown>) =>
    request(`/api/workflows/${id}/run`, {
      method: 'POST',
      body: JSON.stringify({ input, date, runtimeOptions })
    }),
  dryRunWorkflowStep: (body: {
    workflow: Workflow;
    stepId: string;
    input?: unknown;
    stepResults?: Record<string, unknown>;
    date?: string;
    runtimeOptions?: Record<string, unknown>;
  }): Promise<WorkflowStepDryRunResult> =>
    request('/api/workflows/dry-run-step', {
      method: 'POST',
      body: JSON.stringify(body)
    }),

  getAiBuilderCatalog: (): Promise<AiBuildCatalog> => request('/api/ai-builder/catalog'),
  createAiBuildPlan: (body: AiBuildRequest): Promise<AiBuildPlan> =>
    request('/api/ai-builder/plan', {
      method: 'POST',
      body: JSON.stringify(body)
    }),
  streamAiBuildChat: async (
    body: {
      request?: AiBuildRequest;
      messages: AiBuildChatMessage[];
      currentPlan?: AiBuildPlan;
      currentDraft?: PlanDraft;
      stateGraph?: BuilderStateGraph;
      capabilityGraph?: CapabilityGraph;
      planContract?: PlanContract;
      lineage?: PlanLineage;
      builderMode?: BuilderMode;
      planPhase?: PlanPhase;
      planAnswers?: Record<string, unknown>;
      buildRequested?: boolean;
      compressRequested?: boolean;
      mentions?: AiBuilderMention[];
      contextSummary?: string;
      contextMemory?: BuilderContextMemory;
      providerId?: string;
      model?: string;
    },
    onEvent: (event: AiBuildStreamEvent) => void,
    options?: { signal?: AbortSignal }
  ) => {
    const token = localStorage.getItem('auth_token');
    const response = await fetch('/api/ai-builder/chat-stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      signal: options?.signal,
      body: JSON.stringify(body)
    });
    if (response.status === 401) {
      redirectToLogin();
      throw new Error('Unauthorized');
    }
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || 'Request failed');
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';
        for (const rawEvent of events) {
          const line = rawEvent.split('\n').find((item) => item.startsWith('data: '));
          if (!line) continue;
          const payload = line.slice(6).trim();
          if (!payload || payload === '[DONE]') continue;
          onEvent(JSON.parse(payload) as AiBuildStreamEvent);
        }
      }
    } finally {
      if (options?.signal?.aborted) {
        await reader?.cancel().catch(() => undefined);
      }
    }
  },
  streamAiBuildExecute: async (
    buildRequest: AiBuildApplyRequest,
    onEvent: (event: AiBuildStreamEvent) => void,
    options?: { signal?: AbortSignal }
  ) => {
    const token = localStorage.getItem('auth_token');
    const response = await fetch('/api/ai-builder/build-stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      signal: options?.signal,
      body: JSON.stringify(buildRequest)
    });
    if (response.status === 401) {
      redirectToLogin();
      throw new Error('Unauthorized');
    }
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || 'Request failed');
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';
        for (const rawEvent of events) {
          const line = rawEvent.split('\n').find((item) => item.startsWith('data: '));
          if (!line) continue;
          const payload = line.slice(6).trim();
          if (!payload || payload === '[DONE]') continue;
          onEvent(JSON.parse(payload) as AiBuildStreamEvent);
        }
      }
    } finally {
      if (options?.signal?.aborted) {
        await reader?.cancel().catch(() => undefined);
      }
    }
  },
  reviseAiBuildPlan: (body: {
    request?: AiBuildRequest;
    plan: AiBuildPlan;
    feedback: string;
  }): Promise<AiBuildPlan> =>
    request('/api/ai-builder/revise', {
      method: 'POST',
      body: JSON.stringify(body)
    }),
  validateAiBuildPlan: (plan: AiBuildPlan): Promise<AiBuildPlan['validation']> =>
    request('/api/ai-builder/validate', {
      method: 'POST',
      body: JSON.stringify(plan)
    }),
  dryRunAiBuildPlan: (plan: AiBuildPlan): Promise<AiBuildDryRunResult> =>
    request('/api/ai-builder/dry-run', {
      method: 'POST',
      body: JSON.stringify({ plan })
    }),

  runExecutor: (id: string, input: any, date?: string) => {
    if (!id) throw new Error('Executor ID is required');
    if (id.startsWith('tool:')) {
      const toolId = id.replace('tool:', '');
      return request(`/api/tools/${toolId}/run`, {
        method: 'POST',
        body: JSON.stringify(typeof input === 'string' ? { input, markdown: input } : input)
      });
    } else if (id.startsWith('workflow:')) {
      const workflowId = id.replace('workflow:', '');
      return request(`/api/workflows/${workflowId}/run`, {
        method: 'POST',
        body: JSON.stringify({
          input,
          date
        })
      });
    } else {
      const agentId = id.startsWith('agent:') ? id.replace('agent:', '') : id;
      return request(`/api/agents/${agentId}/run`, {
        method: 'POST',
        body: JSON.stringify({ input, date })
      });
    }
  },

  getMCPConfigs: () => request('/api/mcp-configs'),
  saveMCPConfig: (config: MCPServerConfig) =>
    request('/api/mcp-configs', {
      method: 'POST',
      body: JSON.stringify(config)
    }),
  deleteMCPConfig: (id: string) =>
    request(`/api/mcp-configs/${id}`, {
      method: 'DELETE'
    }),

  // --- Agent Runs ---
  startAgentRun: (body: StartAgentRunRequest): Promise<StartAgentRunResult> =>
    request('/api/agent-runs', {
      method: 'POST',
      body: JSON.stringify(body)
    }),
  listAgentRuns: (filter?: AgentRunFilter, offset = 0, limit = 50): Promise<AgentRunPage> => {
    const params = new URLSearchParams();
    if (filter?.agentId) params.set('agentId', filter.agentId);
    if (filter?.workflowId) params.set('workflowId', filter.workflowId);
    if (filter?.source) params.set('source', Array.isArray(filter.source) ? filter.source.join(',') : filter.source);
    if (filter?.status) params.set('status', Array.isArray(filter.status) ? filter.status.join(',') : filter.status);
    if (filter?.createdAfter) params.set('createdAfter', filter.createdAfter);
    if (filter?.createdBefore) params.set('createdBefore', filter.createdBefore);
    if (filter?.pendingPermission !== undefined) params.set('pendingPermission', String(filter.pendingPermission));
    if (filter?.search) params.set('search', filter.search);
    params.set('offset', String(offset));
    params.set('limit', String(limit));
    return request(`/api/agent-runs?${params.toString()}`);
  },
  getAgentRun: (runId: string): Promise<AgentRun> =>
    request(`/api/agent-runs/${runId}`),
  getAgentRunEvents: async (runId: string): Promise<AgentEventItem[]> =>
    normalizeAgentEvents(await request(`/api/agent-runs/${runId}/events`)),
  subscribeAgentRunEvents: (
    runId: string,
    handlers: {
      onEvent?: (event: AgentEventItem) => void;
      onDone?: () => void;
      onError?: (error: Error) => void;
    }
  ): (() => void) => {
    const controller = new AbortController();

    void (async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`/api/agent-runs/${runId}/events?stream=true`, {
          method: 'GET',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: controller.signal
        });

        if (response.status === 401) {
          redirectToLogin();
          throw new Error('Unauthorized');
        }
        if (!response.ok) {
          throw new Error(`SSE 连接失败 (${response.status})`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('SSE 响应体为空');

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parsed = parseSseFrames(buffer, (payload) => {
            const data = JSON.parse(payload) as AgentEventItem & { error?: string };
            if (data.type === 'error') {
              throw new Error(data.error || 'SSE 流错误');
            }
            return normalizeAgentEventItem(data);
          });
          buffer = parsed.rest;
          for (const event of parsed.events) {
            handlers.onEvent?.(event);
          }
          if (parsed.done) {
            handlers.onDone?.();
            return;
          }
        }

        handlers.onDone?.();
      } catch (error) {
        if (controller.signal.aborted) return;
        handlers.onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    })();

    return () => controller.abort();
  },
  getAgentRunTrace: (runId: string): Promise<unknown> =>
    request(`/api/agent-runs/${runId}/trace`),
  getRunHitl: (runId: string): Promise<RunHitlState> =>
    request(`/api/agent-runs/${runId}/hitl`),
  resolveRunHitl: (runId: string, requestId: string, body: ResolveRunHitlRequest) =>
    request(`/api/agent-runs/${runId}/hitl/${requestId}/resolve`, {
      method: 'POST',
      body: JSON.stringify(body)
    }),
  listPendingHitl: (): Promise<PendingHitlItem[]> =>
    request('/api/agent-runs/hitl/pending'),
  getRunSession: (runId: string) =>
    request(`/api/agent-runs/${runId}/session`),
  getRunMessages: (runId: string): Promise<AgentRunMessage[]> =>
    request(`/api/agent-runs/${runId}/messages`),
  getRunArtifacts: (runId: string): Promise<AgentRunArtifact[]> =>
    request(`/api/agent-runs/${runId}/artifacts`),
  getRunArtifact: (runId: string, artifactId: string) =>
    request(`/api/agent-runs/${runId}/artifacts/${artifactId}`),
  getSessionMessages: (sessionId: string): Promise<AgentRunMessage[]> =>
    request(`/api/agent-sessions/${sessionId}/messages`),
  approveRunPermission: (runId: string, permissionId: string, reason?: string) =>
    request(`/api/agent-runs/${runId}/permissions/${permissionId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    }),
  rejectRunPermission: (runId: string, permissionId: string, reason?: string) =>
    request(`/api/agent-runs/${runId}/permissions/${permissionId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    }),
  approveWorkflowPermission: (workflowRunId: string, permissionId: string, reason?: string) =>
    request(`/api/workflow-runs/${workflowRunId}/permissions/${permissionId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    }),
  rejectWorkflowPermission: (workflowRunId: string, permissionId: string, reason?: string) =>
    request(`/api/workflow-runs/${workflowRunId}/permissions/${permissionId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    }),
  cancelAgentRun: (runId: string): Promise<{ status: string }> =>
    request(`/api/agent-runs/${runId}/cancel`, { method: 'POST' }),
  archiveAgentRun: (runId: string, reason?: string): Promise<{ status: string }> =>
    request(`/api/agent-runs/${runId}/archive`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    }),
  retryAgentRun: (runId: string): Promise<{ runId: string; sessionId: string; status: string }> =>
    request(`/api/agent-runs/${runId}/retry`, { method: 'POST' }),
  listPendingPermissions: (): Promise<PendingPermissionItem[]> =>
    request('/api/agent-runs/permissions/pending'),
  listPermissionHistory: (limit = 50): Promise<PermissionHistoryItem[]> =>
    request(`/api/agent-runs/permissions/history?limit=${limit}`),
  replayAgentRun: (runId: string, execute = true): Promise<AgentRunReplayResult> =>
    request(`/api/agent-runs/${runId}/replay`, {
      method: 'POST',
      body: JSON.stringify({ execute })
    }),
  getAgentRunMetrics: (): Promise<AgentRunMetrics> =>
    request('/api/agent-runs/observability/metrics'),
  getAgentRunAlerts: (): Promise<AgentRunAlert[]> =>
    request('/api/agent-runs/observability/alerts'),

  listWorkflowRuns: (workflowId?: string, offset = 0, limit = 30): Promise<WorkflowRunPage> => {
    const params = new URLSearchParams();
    if (workflowId) params.set('workflowId', workflowId);
    params.set('offset', String(offset));
    params.set('limit', String(limit));
    return request(`/api/workflow-runs?${params.toString()}`);
  },
  getWorkflowRun: (workflowRunId: string): Promise<WorkflowRunRecord> =>
    request(`/api/workflow-runs/${workflowRunId}`),

  getGovernanceStatus: (): Promise<GovernanceStatus> =>
    request('/api/platform/governance/status'),

  getSourceQualityStatus: (): Promise<SourceQualityStatus> =>
    request('/api/platform/source-quality/status'),
  updateSourceQualityConfig: (config: Partial<SourceQualityConfig>): Promise<SourceQualityConfig> =>
    request('/api/platform/source-quality/config', {
      method: 'PUT',
      body: JSON.stringify(config)
    }),

  getBusinessPipelinesStatus: (): Promise<{
    pipelines: Array<{
      id: string;
      label: string;
      description: string;
      workflowId: string;
      scheduleId: string;
      ready: boolean;
      cron?: string;
      enabled?: boolean;
      status?: 'rebuild_required';
    }>;
    editorialAgentsReady: boolean;
    rebuildRequired?: boolean;
    message?: string;
  }> => request('/api/platform/business-pipelines/status'),
  setupBusinessPipelines: (body?: { enableSchedules?: boolean }): Promise<{ status: string; created: string[]; reused: string[]; message?: string }> =>
    request('/api/platform/business-pipelines/setup', {
      method: 'POST',
      body: JSON.stringify(body ?? {})
    }),

  getDigestContext: (date?: string): Promise<import('../types/digestContext').DigestContextPayload> => {
    const params = date ? `?date=${encodeURIComponent(date)}` : '';
    return request(`/api/editorial/digest-context${params}`);
  },

  listRegressionSamples: (): Promise<RegressionSample[]> =>
    request('/api/platform/regression/samples'),
  saveRegressionSample: (sample: Partial<RegressionSample> & { name: string; agentId: string; prompt: string }): Promise<RegressionSample> =>
    request('/api/platform/regression/samples', {
      method: 'POST',
      body: JSON.stringify(sample)
    }),
  deleteRegressionSample: (sampleId: string): Promise<{ status: string }> =>
    request(`/api/platform/regression/samples/${sampleId}`, { method: 'DELETE' }),
  runRegressionSamples: (sampleIds?: string[]): Promise<RegressionRunSummary> =>
    request('/api/platform/regression/run', {
      method: 'POST',
      body: JSON.stringify({ sampleIds })
    }),
  listRegressionRuns: (limit = 30): Promise<RegressionRunRecord[]> =>
    request(`/api/platform/regression/runs?limit=${limit}`),
};
