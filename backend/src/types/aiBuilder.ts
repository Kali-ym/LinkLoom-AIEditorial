import type {
  AgentDefinition,
  MCPServerConfig,
  SkillDefinition,
  ToolDefinition,
  WorkflowDefinition,
  WorkflowInputSpec,
  WorkflowStepType
} from './agent.js';

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
export type AiBuilderGeneratedBy = 'agent-builder' | 'workflow-builder' | 'skill-builder';

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

export interface AiBuilderContract {
  inputSchema?: unknown;
  outputSchema?: unknown;
  outputExamples?: unknown[];
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

export interface AiBuildChatRequest {
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
}

/**
 * AI Builder 规划阶段使用的步骤抽象。
 *
 * - `kind` 覆盖所有受支持的 WorkflowStepType（"经典" agent/tool/workflow 与 pipeline 步骤）。
 * - `config` / `configOverrides` 用于 pipeline 步骤（adapter / store-query / store-write / kv-write / transform / batch-iterate）。
 *   AI 只需输出关键覆盖字段，由 WorkflowPlanCompiler 与 StepCatalog.defaultConfig 合并。
 * - classic 步骤继续使用 `resourceRef`，不需要 config。
 */
export interface WorkflowPlanStep {
  id: string;
  goal: string;
  kind: WorkflowStepType;
  consumes?: string[];
  produces?: string[];
  resourceRef?: string;
  needsNewAgent?: boolean;
  needsNewSkill?: boolean;
  /** Pipeline 步骤的步骤配置（完整覆盖 defaultConfig）。 */
  config?: Record<string, unknown>;
  /** Pipeline 步骤的配置覆盖（按 key 合并到 defaultConfig 之上）。 */
  configOverrides?: Record<string, unknown>;
  execution?: WorkflowDefinition['steps'][number]['execution'];
  agentOptions?: WorkflowDefinition['steps'][number]['agentOptions'];
}

export interface WorkflowPlan {
  id?: string;
  name: string;
  description?: string;
  /**
   * 工作流运行时入参声明；推荐仅在需要外部输入或兼容 $.input 引用时使用 WorkflowInputSpec.fields 结构。
   * 为兼容历史 plan，仍允许任意 schema 描述；Compiler 在写入 inputSpec 时会做最小化校验。
   */
  inputSchema?: WorkflowInputSpec | unknown;
  outputSchema?: unknown;
  steps: WorkflowPlanStep[];
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

export type AiBuildChange =
  | { action: 'createAgent'; agent: AgentDefinition }
  | { action: 'updateAgent'; agent: AgentDefinition }
  | { action: 'createWorkflow'; workflow: WorkflowDefinition }
  | { action: 'updateWorkflow'; workflow: WorkflowDefinition }
  | { action: 'createSkillFile'; skillId: string; filePath: string; content: string }
  | { action: 'updateSkillFile'; skillId: string; filePath: string; content: string };

export interface AiBuildValidation {
  status: 'ok' | 'needs_input' | 'invalid';
  errors: string[];
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
  validation: AiBuildValidation;
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

/**
 * 步骤类型在 catalog 中的描述。AI Builder 用它给 LLM 生成 pipeline 步骤的提示
 * （知道哪些 kind 可用、关键 config 字段是什么、缺省值是什么）。
 */
export interface AiBuildStepTypeDescriptor {
  type: WorkflowStepType;
  label: string;
  category: 'pipeline' | 'classic';
  description: string;
  /** 给 AI Builder/LLM 的规划提示：输入、输出、适用场景和常用引用。 */
  builderHints?: {
    input?: string;
    output?: string;
    useWhen?: string;
    configGuidance?: string;
    commonRefs?: string[];
  };
  /** 关键字段摘要：key + label + 是否必填 + 类型 + 简短描述。 */
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

/** 旧版业务枚举摘要。保留给已有前端和旧 prompt 兼容；新代码优先读取 domainCatalog。 */
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

/** 业务域目录：AI Builder 可读的领域语义层，不属于平台 runtime。 */
export interface AiBuildDomainCatalog {
  domains: AiBuildDomainDescriptor[];
}

export interface AiBuildCatalog {
  agents: Array<
    Pick<
      AgentDefinition,
      'id' | 'name' | 'description' | 'toolIds' | 'skillIds' | 'mcpServerIds' | 'category' | 'runtime'
    > & {
      contract?: AiBuilderContract;
    }
  >;
  tools: Array<
    Pick<ToolDefinition, 'id' | 'name' | 'displayName' | 'description' | 'parameters' | 'scope'>
  >;
  mcpServers?: Array<
    Pick<MCPServerConfig, 'id' | 'name' | 'description' | 'transportType' | 'enabled'>
  >;
  skills: Array<
    Pick<SkillDefinition, 'id' | 'name' | 'description' | 'files'> & {
      instructionsSummary?: string;
      isBuiltin?: boolean;
    }
  >;
  workflows: Array<
    Pick<WorkflowDefinition, 'id' | 'name' | 'description' | 'inputSpec' | 'outputSpec'> & {
      stepCount: number;
      steps: Array<{
        id: string;
        type: string;
        resourceRef?: string;
        produces?: string[];
        configSummary?: Record<string, unknown>;
      }>;
      contract?: AiBuilderContract;
    }
  >;
  /** StepCatalog 暴露给 LLM 的步骤类型字典。 */
  stepTypes?: AiBuildStepTypeDescriptor[];
  /** 业务域目录：当前产品注册给 AI Builder 的领域语义。 */
  domainCatalog?: AiBuildDomainCatalog;
  /** 旧版业务枚举摘要。保留兼容；新代码优先读取 domainCatalog。 */
  businessEnums?: AiBuildBusinessEnums;
  defaults: {
    providerId: string;
    model: string;
  };
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
