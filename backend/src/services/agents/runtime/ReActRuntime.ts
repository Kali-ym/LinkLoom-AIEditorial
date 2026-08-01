import { ToolRegistry } from '../../../registries/ToolRegistry.js';
import {
  DefaultContextManager,
  type ContextCompactionRecord,
  type ContextSummarizer,
  type ToolResultContextOutput
} from '../engine/ContextManager.js';
import type { ContextPolicy } from '../engine/ContextPolicy.js';
import type { AgentArtifactRef } from '../engine/AgentSession.js';
import {
  AgentContextBuilder,
  type AgentContextCompactionResult
} from '../context/AgentContextBuilder.js';
import type { TokenCounter } from '../context/TokenCounter.js';
import type { ClassifiedMessageBuilder } from '../context/ClassifiedMessageBuilder.js';
import type { ContextTransformer } from '../context/ContextTransformer.js';
import type { SessionContext, TurnContext, LlmRequestContext } from '../context/PiContextTypes.js';
import { PI_CONTEXT_PROTOCOL_VERSION } from '../context/PiContextTypes.js';
import type { ContextUsageSnapshot, ClassifiedModelInput } from '../context/ContextTokenTypes.js';
import {
  isPermissionPauseError,
  PermissionPauseError,
  type PermissionDecisionResult
} from '../engine/PermissionEngine.js';
import {
  ASK_USER_QUESTION_TOOL_ID,
  createUserInputRequestId,
  extractAskUserQuestionPrompt,
  isAskUserQuestionToolName,
  isUserInputPauseError,
  UserInputPauseError,
  type UserInputPauseRequest
} from '../engine/UserInputEngine.js';
import type {
  AgentDefinition,
  AgentExecutionResult,
  AgentRunRound,
  AgentRunTrace,
  AgentRuntimeMode,
  AgentToolCallTrace,
  AgentToolObservation,
  MCPServerConfig,
  MCPToolExecutionTrace,
  ToolDefinition
} from '../../../types/agent.js';
import type { AgentBudgetPolicy } from '../engine/AgentRunSpec.js';
import type {
  ObservationGuardDecision,
  ObservationPolicy,
  ObservationPolicyTracker
} from '../engine/ObservationPolicy.js';
import { createObservationPolicyTracker } from '../engine/ObservationPolicy.js';
import type { AIMessage, AIResponse } from '../../../types/index.js';
import type { AIProvider } from '../../AIProvider.js';
import {
  buildPromptCacheReplayHistoryMetadata,
  extractPromptCacheReplayContext,
  type ResponseCacheRequest
} from '../engine/responseContextCache.js';
import { LogService } from '../../LogService.js';
import { emitPacedStreamChunks } from './streamTextChunks.js';
import {
  accumulateRuntimeStreamChunk,
  createRuntimeStreamAccumulation
} from './streamChunkAccumulator.js';
import { legacyKnowledgeCategoryScope, mergeKnowledgeScopes } from '../../rag/RagScope.js';
import type { MCPService } from '../MCPService.js';
import type {
  PermissionDecision,
  PermissionPolicy,
  PermissionRequest
} from '../engine/PermissionPolicy.js';
import type { WorkspacePolicy, WorkspaceRef } from '../engine/WorkspacePolicy.js';
import { evaluateWorkspaceSandbox } from '../engine/WorkspaceSandbox.js';
import type { ToolExecutionContext } from '../../ToolExecutionContext.js';
import {
  isProviderGovernanceBudgetError,
  providerGovernanceBudgetErrorToUsage
} from '../providerGovernance.js';
import {
  applyToolObservationAssessment,
  assessToolObservationResult,
  createToolFailureSignature,
  describeToolExecution,
  executeWithToolEnvelope,
  getMaxRepeatedToolErrors,
  getToolExecutionEnvelopeFromError,
  normalizeToolCall,
  normalizeToolCalls,
  shouldStopOnRepeatedToolError,
  toolExecutionEnvelopeToTrace,
  type NormalizedToolCall,
  type ToolExecutionEnvelope
} from './toolProtocol.js';

export interface ReActRuntimePendingToolCallState {
  id?: string;
  name: string;
  arguments: Record<string, unknown>;
  rawArguments?: unknown;
  parseError?: string;
  source?: string;
}

export interface ReActRuntimePermissionPauseState {
  pendingToolCall: ReActRuntimePendingToolCallState;
  roundIndex: number;
  assistantContent?: string;
  acceptedToolCallCount?: number;
  acceptedToolCallsThisRound?: number;
}

export interface ReActRuntimePermissionResumeInput {
  state: ReActRuntimePermissionPauseState;
  decision: PermissionDecision;
}

export interface ReActRuntimeUserInputResumeInput {
  state: ReActRuntimePermissionPauseState;
  resolution: {
    action: 'provide_input' | 'cancel';
    requestId: string;
    input?: unknown;
    reason?: string;
  };
}

export interface ReActRuntimeUserInputContext {
  onUserInputRequired?: (
    request: UserInputPauseRequest,
    state?: ReActRuntimePermissionPauseState
  ) => void | Promise<void>;
}

export interface ReActRuntimePermissionContext {
  runId: string;
  sessionId: string;
  policy?: PermissionPolicy;
  decide: (input: {
    toolName: string;
    toolCallId?: string;
    arguments: unknown;
    exposedName?: string;
    originalName?: string;
    mcpServerId?: string;
  }) => PermissionDecisionResult | Promise<PermissionDecisionResult>;
  onPermissionRequired?: (
    request: PermissionRequest,
    state?: ReActRuntimePermissionPauseState
  ) => void | Promise<void>;
  onPermissionResolved?: (decision: PermissionDecision) => void | Promise<void>;
}

export interface ReActRuntimeContextHooks {
  runId: string;
  sessionId: string;
  policy?: ContextPolicy;
  summarizer?: ContextSummarizer;
  sessionContext?: SessionContext;
  turnContext?: TurnContext;
  contextTransformer?: ContextTransformer;
  onContextCompacted?: (record: ContextCompactionRecord) => void | Promise<void>;
  onArtifactSaved?: (artifact: AgentArtifactRef, content?: unknown) => void | Promise<void>;
}

export interface ReActRuntimeWorkspaceContext {
  workspace?: WorkspaceRef;
  policy?: WorkspacePolicy;
}

export interface ReActRuntimeMiddlewareHooks {
  beforeModelCall?: (input: {
    messages: AIMessage[];
    providerId?: string;
    model?: string;
    systemInstruction?: string;
    turnContextFingerprint?: string;
  }) => void | Promise<void>;
  afterModelCall?: (input: {
    messages: AIMessage[];
    providerId?: string;
    model?: string;
    systemInstruction?: string;
    turnContextFingerprint?: string;
    result: unknown;
  }) => void | Promise<void>;
  beforeToolCall?: (input: {
    toolName: string;
    arguments: unknown;
    permission?: PermissionRequest | PermissionDecision;
  }) => void | Promise<void>;
  afterToolCall?: (input: {
    toolName: string;
    arguments: unknown;
    permission?: PermissionRequest | PermissionDecision;
    result: unknown;
  }) => void | Promise<void>;
}

export interface ReActRuntimeOptions {
  agentDef: AgentDefinition;
  provider: AIProvider;
  tools: ToolDefinition[];
  /** Tool definitions sent to the provider; execution tools remain in `tools`. */
  providerTools?: ToolDefinition[];
  mcpConfigs: MCPServerConfig[];
  mcpService: MCPService;
  toolRegistry: ToolRegistry;
  messages: AIMessage[];
  signal?: AbortSignal;
  permission?: ReActRuntimePermissionContext;
  userInput?: ReActRuntimeUserInputContext;
  context?: ReActRuntimeContextHooks;
  workspace?: ReActRuntimeWorkspaceContext;
  middleware?: ReActRuntimeMiddlewareHooks;
  budgetPolicy?: AgentBudgetPolicy;
  observationPolicy?: ObservationPolicy;
  silent?: boolean;
  toolContextExtras?: Partial<ToolExecutionContext>;
  responseCache?: ResponseCacheRequest;
  /** Live SSE chunks during permission resume (tool result + model continuation). */
  onStreamChunk?: (chunk: unknown) => void | Promise<void>;
  /** Persist the canonical tool-message content before the next model call. */
  onToolObservation?: (observation: AgentToolObservation, round: number) => void | Promise<void>;
  /** Token counter for pre-call context usage measurement */
  tokenCounter?: TokenCounter;
  /** Builder to classify messages into categories for token counting */
  classifiedMessageBuilder?: ClassifiedMessageBuilder;
  /** Callback invoked after each pre-call token measurement */
  onContextUsageMeasured?: (snapshot: ContextUsageSnapshot, round: number) => void | Promise<void>;
}

const DEFAULT_MAX_ROUNDS = 5;

type StreamToolCallAccumulator = {
  requestKey: string;
  id?: string;
  name?: string;
  arguments?: unknown;
};

function normalizePositiveInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : undefined;
}

function readFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function toolCallStreamKey(
  toolCall: { id?: string; name?: string; arguments?: unknown },
  index: number,
  state: Map<string, StreamToolCallAccumulator>
): string {
  const id = String(toolCall.id || '').trim();
  if (id) return `id:${id}`;
  const name = String(toolCall.name || 'unknown').trim() || 'unknown';
  const providerIndex = (toolCall as { index?: unknown }).index;
  const streamIndex =
    typeof providerIndex === 'number' && Number.isFinite(providerIndex)
      ? Math.floor(providerIndex)
      : index;
  const baseKey = `index:${streamIndex}:${name}`;
  const existing = state.get(baseKey);
  if (!existing || shouldMergeStreamToolCall(existing, toolCall)) return baseKey;

  let suffix = 1;
  while (true) {
    const key = `${baseKey}:${suffix}`;
    const candidate = state.get(key);
    if (!candidate || shouldMergeStreamToolCall(candidate, toolCall)) return key;
    suffix++;
  }
}

function shouldMergeStreamToolCall(
  existing: StreamToolCallAccumulator,
  incoming: { name?: string; arguments?: unknown }
): boolean {
  const incomingName = String(incoming.name || '').trim();
  if (incomingName && existing.name && incomingName !== existing.name) return false;
  const previous = existing.arguments;
  const next = incoming.arguments;
  if (next === undefined || next === null) return true;
  if (previous === undefined || previous === null) return true;

  if (typeof previous === 'string' && typeof next === 'string') {
    return (
      next.startsWith(previous) || previous.startsWith(next) || !looksLikeCompleteJson(previous)
    );
  }

  if (
    previous &&
    next &&
    typeof previous === 'object' &&
    typeof next === 'object' &&
    !Array.isArray(previous) &&
    !Array.isArray(next)
  ) {
    return recordsAreCompatibleForStreamMerge(
      previous as Record<string, unknown>,
      next as Record<string, unknown>
    );
  }

  return false;
}

function looksLikeCompleteJson(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

function recordsAreCompatibleForStreamMerge(
  previous: Record<string, unknown>,
  next: Record<string, unknown>
): boolean {
  const previousKeys = Object.keys(previous);
  const nextKeys = Object.keys(next);
  if (previousKeys.length === 0 || nextKeys.length === 0) return true;
  const sharedKeys = previousKeys.filter((key) => key in next);
  if (sharedKeys.length === 0) return false;
  return sharedKeys.every((key) => streamValuesAreCompatible(previous[key], next[key]));
}

function streamValuesAreCompatible(previous: unknown, next: unknown): boolean {
  if (previous === undefined || previous === null || next === undefined || next === null)
    return true;
  if (typeof previous === 'string' && typeof next === 'string') {
    return previous === next || previous.startsWith(next) || next.startsWith(previous);
  }
  return stableStreamValueKey(previous) === stableStreamValueKey(next);
}

function stableStreamValueKey(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function mergeStreamToolCall(
  existing: StreamToolCallAccumulator,
  incoming: { id?: string; name?: string; arguments?: unknown }
): StreamToolCallAccumulator {
  return {
    requestKey: existing.requestKey,
    id: incoming.id || existing.id,
    name: incoming.name || existing.name,
    arguments: mergeStreamToolArguments(existing.arguments, incoming.arguments)
  };
}

function mergeStreamToolArguments(existing: unknown, incoming: unknown): unknown {
  if (incoming === undefined || incoming === null) return existing;
  if (existing === undefined || existing === null) return incoming;

  if (typeof existing === 'string' && typeof incoming === 'string') {
    return incoming.startsWith(existing) ? incoming : `${existing}${incoming}`;
  }

  if (
    existing &&
    incoming &&
    typeof existing === 'object' &&
    typeof incoming === 'object' &&
    !Array.isArray(existing) &&
    !Array.isArray(incoming)
  ) {
    return { ...(existing as Record<string, unknown>), ...(incoming as Record<string, unknown>) };
  }

  return incoming;
}

function compactStreamToolCalls(
  toolCallState: Map<string, StreamToolCallAccumulator>
): Array<{ requestKey: string; id?: string; name: string; arguments?: unknown }> {
  return [...toolCallState.values()]
    .filter(
      (toolCall): toolCall is StreamToolCallAccumulator & { name: string } =>
        typeof toolCall.name === 'string' && toolCall.name.trim().length > 0
    )
    .map((toolCall) => ({ ...toolCall, name: toolCall.name.trim() }));
}

function createToolLimitObservation(params: {
  toolName: string;
  toolCallId?: string;
  round: number;
  scope: 'run' | 'round';
  limit: number;
  current: number;
}): AgentToolObservation {
  const scopeLabel = params.scope === 'round' ? '本轮工具请求数' : '本次运行工具请求总数';
  const instruction =
    '该工具调用已达到预算或策略上限。不要重试同一工具/参数；基于已有 observation 总结方案，信息不足时直接向用户提出澄清问题。';
  const summary = `${scopeLabel}已达到上限 ${params.limit}，已跳过工具 ${params.toolName}。请停止继续批量调用工具，基于已有 observation 总结方案；如果信息仍不足，直接向用户提出澄清问题。`;
  const reactObservation = {
    success: false,
    status: 'limited',
    limited: true,
    error: summary,
    instruction
  };
  const data = {
    status: 'limited',
    limited: true,
    summary,
    reactObservation,
    budget: {
      scope: params.scope,
      limit: params.limit,
      current: params.current,
      round: params.round
    }
  };
  return {
    toolCallId: params.toolCallId,
    toolName: params.toolName,
    success: false,
    content: JSON.stringify(data),
    data,
    error: summary,
    durationMs: 0
  };
}

function getRuntimeMode(agentDef: AgentDefinition): AgentRuntimeMode {
  return agentDef.runtime?.mode || 'classic';
}

function getMaxRounds(agentDef: AgentDefinition, budgetPolicy?: AgentBudgetPolicy): number {
  const configured = budgetPolicy?.maxRounds ?? agentDef.runtime?.maxRounds;
  if (typeof configured === 'number' && Number.isFinite(configured) && configured > 0) {
    return Math.floor(configured);
  }
  return DEFAULT_MAX_ROUNDS;
}

function createRunId(agentId: string): string {
  return `${agentId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function formatFinalContent(finalContent: unknown, lastToolResult: unknown): string {
  let finalString = typeof finalContent === 'string' ? finalContent : JSON.stringify(finalContent);

  if (!finalString.trim() && lastToolResult) {
    if (typeof lastToolResult === 'string') {
      finalString = lastToolResult;
    } else if (typeof lastToolResult === 'object' && lastToolResult !== null) {
      const record = lastToolResult as Record<string, any>;
      if (Array.isArray(record.content)) {
        finalString = record.content
          .filter((c: any) => c.type === 'text')
          .map((c: any) => c.text)
          .join('\n');

        if (!finalString.trim()) {
          finalString = JSON.stringify(record.content);
        }
      } else {
        const fallback = record.content || record.html || record.summary || JSON.stringify(record);
        finalString = typeof fallback === 'string' ? fallback : JSON.stringify(fallback);
      }
    }
  }

  return finalString;
}

function formatToolFailureForUser(observation: AgentToolObservation): string {
  const detail = (observation.error || observation.content || '未知错误').trim();
  const conciseDetail = detail.length > 600 ? `${detail.slice(0, 600)}…` : detail;
  return `工具「${observation.toolName}」执行失败：${conciseDetail}\n已停止继续重试，请检查工作区配置或网络连接后再试。`;
}

function findLastFailedObservation(trace: AgentRunTrace): AgentToolObservation | undefined {
  for (let roundIndex = trace.rounds.length - 1; roundIndex >= 0; roundIndex -= 1) {
    const observations = trace.rounds[roundIndex].observations;
    for (
      let observationIndex = observations.length - 1;
      observationIndex >= 0;
      observationIndex -= 1
    ) {
      const observation = observations[observationIndex];
      if (!observation.success) return observation;
    }
  }
  return undefined;
}

function resolveMcpToolIdentity(
  toolName: string,
  tools: ToolDefinition[]
): { toolDef?: ToolDefinition; mcpServerId?: string; originalName?: string } {
  const toolDef = findExposedTool(toolName, tools);
  if (!toolDef) return {};

  const [configId, ...nameParts] = toolDef.id.split(':');
  if (nameParts.length === 0) return { toolDef };

  return {
    toolDef,
    mcpServerId: configId,
    originalName: nameParts.join(':')
  };
}

function findExposedTool(toolName: string, tools: ToolDefinition[]): ToolDefinition | undefined {
  return tools.find((tool) => tool.name === toolName || tool.id === toolName);
}

function isMcpToolDefinition(tool: ToolDefinition): boolean {
  return tool.id.includes(':');
}

function isExplicitParallelToolCall(
  tc: NormalizedToolCall | any,
  tools: ToolDefinition[]
): boolean {
  const toolDef = findExposedTool(tc.name, tools);
  const execution = toolDef?.execution;
  return (
    execution?.readonly === true &&
    (execution.parallelizable === true || execution.concurrencySafe === true)
  );
}

function toToolCallTrace(
  tc: NormalizedToolCall | any,
  tools: ToolDefinition[]
): AgentToolCallTrace {
  const identity = resolveMcpToolIdentity(tc.name, tools);
  return {
    id: tc.id,
    name: tc.name,
    arguments: tc.arguments,
    rawArguments: 'rawArguments' in tc ? tc.rawArguments : undefined,
    parseError: 'parseError' in tc ? tc.parseError : undefined,
    exposedName: identity.toolDef?.name || tc.name,
    originalName: identity.originalName,
    mcpServerId: identity.mcpServerId,
    execution: identity.toolDef
      ? describeToolExecution(
          identity.toolDef.id,
          identity.toolDef.name,
          identity.toolDef,
          identity.mcpServerId ? 'mcp' : 'local',
          identity.originalName
        )
      : undefined
  };
}

function toObservationContent(result: unknown): string {
  if (typeof result === 'string') return result;
  return JSON.stringify(result);
}

function isToolResultContextOutput(value: unknown): value is ToolResultContextOutput {
  return (
    !!value &&
    typeof value === 'object' &&
    'messageContent' in value &&
    'observationContent' in value
  );
}

function extractProviderGovernanceMetadata(usage: unknown): Record<string, any> | undefined {
  if (!usage || typeof usage !== 'object') return undefined;
  const governance = (usage as { governance?: unknown }).governance;
  return governance && typeof governance === 'object'
    ? (governance as Record<string, any>)
    : undefined;
}

function isSubstantiveProviderUsage(usage: AIResponse['usage'] | undefined): boolean {
  if (!usage || typeof usage !== 'object') return false;
  const record = usage as Record<string, unknown>;
  const promptTokens = Number(record.prompt_tokens ?? record.input_tokens ?? 0);
  if (promptTokens > 0) return true;
  const promptCache =
    record.prompt_cache && typeof record.prompt_cache === 'object'
      ? (record.prompt_cache as Record<string, unknown>)
      : undefined;
  if (Number(promptCache?.cachedInputTokens ?? 0) > 0) return true;
  if (Number(record.cached_tokens ?? 0) > 0) return true;
  if (Number(record.cache_read_input_tokens ?? 0) > 0) return true;
  return false;
}

function toRoundProviderTrace(governance: Record<string, any>): AgentRunRound['provider'] {
  return {
    providerId:
      typeof governance.selectedProviderId === 'string' ? governance.selectedProviderId : undefined,
    providerName:
      typeof governance.selectedProviderName === 'string'
        ? governance.selectedProviderName
        : undefined,
    model: typeof governance.selectedModel === 'string' ? governance.selectedModel : undefined,
    fallbackUsed: governance.fallbackUsed === true,
    retryCount: typeof governance.retryCount === 'number' ? governance.retryCount : undefined,
    attempts: Array.isArray(governance.attempts) ? governance.attempts : undefined,
    capabilities: Array.isArray(governance.capabilities) ? governance.capabilities : undefined,
    health: Array.isArray(governance.health) ? governance.health : undefined
  };
}

function toRoundBudgetTrace(governance: Record<string, any>): AgentRunRound['budget'] {
  const budget =
    governance.budget && typeof governance.budget === 'object'
      ? (governance.budget as Record<string, any>)
      : undefined;
  const cumulative =
    budget?.cumulative && typeof budget.cumulative === 'object'
      ? (budget.cumulative as Record<string, any>)
      : undefined;
  return {
    modelCalls: typeof cumulative?.modelCalls === 'number' ? cumulative.modelCalls : undefined,
    inputTokens: typeof cumulative?.promptTokens === 'number' ? cumulative.promptTokens : undefined,
    outputTokens:
      typeof cumulative?.completionTokens === 'number' ? cumulative.completionTokens : undefined,
    cachedInputTokens:
      typeof cumulative?.cachedInputTokens === 'number' ? cumulative.cachedInputTokens : undefined,
    cacheWriteInputTokens:
      typeof cumulative?.cacheWriteInputTokens === 'number'
        ? cumulative.cacheWriteInputTokens
        : undefined,
    uncachedInputTokens:
      typeof cumulative?.uncachedInputTokens === 'number'
        ? cumulative.uncachedInputTokens
        : undefined,
    estimatedCostUsd:
      typeof cumulative?.estimatedCostUsd === 'number' ? cumulative.estimatedCostUsd : undefined,
    estimatedCacheSavingsUsd:
      typeof cumulative?.estimatedCacheSavingsUsd === 'number'
        ? cumulative.estimatedCacheSavingsUsd
        : undefined,
    limits: budget?.limits && typeof budget.limits === 'object' ? budget.limits : undefined,
    exceeded: Array.isArray(budget?.exceeded) ? budget.exceeded : undefined
  };
}

type RuntimeToolCallResult =
  | { ok: true; result: unknown; envelope?: ToolExecutionEnvelope }
  | { ok: false; errorMessage: string; envelope?: ToolExecutionEnvelope; cancelled?: boolean };

type ParallelRoundToolExecutionInput = {
  toolCalls: NormalizedToolCall[];
  round: AgentRunRound;
  roundIndex: number;
  messages: AIMessage[];
  observationTracker?: ObservationPolicyTracker;
  acceptedToolCallCount: number;
  maxToolCalls?: number;
  maxToolCallsPerRound?: number;
};

type ParallelRoundToolExecutionResult = {
  acceptedToolCallCount: number;
  acceptedToolCallsThisRound: number;
  cancelled?: boolean;
  stopReason?: AgentExecutionResult['stopReason'];
  hasLastToolResult?: boolean;
  lastToolResult?: unknown;
};

type ParallelToolExecutionOutcome = {
  toolCall: NormalizedToolCall;
  startedAt: number;
  success: boolean;
  result?: unknown;
  envelope?: ToolExecutionEnvelope;
  errorMessage?: string;
  cancelled?: boolean;
};

function toolFailureMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return String(error);
}

function isInvalidToolArgumentsError(error: unknown): boolean {
  if ((error as { name?: string } | undefined)?.name === 'ToolArgumentValidationError') return true;
  return getToolExecutionEnvelopeFromError(error)?.error?.code === 'validation_error';
}

function isInvalidToolArgumentsMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return message.includes('参数无效') || normalized.includes('invalid');
}

async function executeMcpToolEnvelope(input: {
  toolDef: ToolDefinition;
  mcpServerId: string;
  originalName: string;
  arguments: unknown;
  workspace?: WorkspaceRef;
  workspacePolicy?: WorkspacePolicy;
  signal?: AbortSignal;
  call: (
    args: Record<string, unknown>,
    signal?: AbortSignal
  ) => Promise<{ result: unknown; trace?: MCPToolExecutionTrace }>;
}): Promise<ToolExecutionEnvelope> {
  let mcpTrace: MCPToolExecutionTrace | undefined;
  const envelope = await executeWithToolEnvelope({
    toolId: input.toolDef.id,
    exposedName: input.toolDef.name,
    originalName: input.originalName,
    source: 'mcp',
    arguments: input.arguments,
    toolDef: input.toolDef,
    workspace: input.workspace,
    sandbox: (args) =>
      evaluateWorkspaceSandbox({
        source: 'mcp',
        toolId: input.toolDef.id,
        exposedName: input.toolDef.name,
        originalName: input.originalName,
        arguments: args,
        toolDef: input.toolDef,
        workspace: input.workspace,
        policy: input.workspacePolicy
      }),
    signal: input.signal,
    execute: async (args, signal) => {
      try {
        const output = await input.call(args, signal);
        mcpTrace = withMcpSchemaTrace(output.trace, input.toolDef);
        return output.result;
      } catch (error) {
        mcpTrace = withMcpSchemaTrace(getMcpTraceFromError(error), input.toolDef);
        throw error;
      }
    }
  });
  if (mcpTrace) envelope.mcp = mcpTrace;
  return envelope;
}

function getMcpTraceFromError(error: unknown): MCPToolExecutionTrace | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const trace = (error as { mcpTrace?: unknown }).mcpTrace;
  return trace && typeof trace === 'object' ? trace : undefined;
}

function withMcpSchemaTrace(
  trace: MCPToolExecutionTrace | undefined,
  toolDef: ToolDefinition
): MCPToolExecutionTrace | undefined {
  const schema = getMcpToolSchemaTrace(toolDef);
  if (!trace && !schema) return undefined;
  return {
    ...(trace || {}),
    ...(schema ? { schema } : {})
  };
}

function getMcpToolSchemaTrace(
  toolDef: ToolDefinition
): MCPToolExecutionTrace['schema'] | undefined {
  const mcpHints = toolDef.uiHints?.mcp;
  if (!isRecord(mcpHints)) return undefined;
  return isMcpToolSchemaTrace(mcpHints.schema) ? mcpHints.schema : undefined;
}

function isMcpToolSchemaTrace(value: unknown): value is MCPToolExecutionTrace['schema'] {
  return isRecord(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export class ReActRuntime {
  private readonly contextManager = new DefaultContextManager();
  private readonly contextBuilder = new AgentContextBuilder(this.contextManager);
  private lastProviderResponseId?: string;
  private lastProviderRequestMessages?: AIMessage[];
  private lastCompactionFingerprint?: string;

  constructor(private readonly options: ReActRuntimeOptions) {}

  private resolveProviderResponseCache(roundIndex: number): ResponseCacheRequest | undefined {
    void roundIndex;
    return this.options.responseCache;
  }

  private captureProviderResponseId(response?: Pick<AIResponse, 'response_id'>): void {
    if (response?.response_id) {
      this.lastProviderResponseId = response.response_id;
    }
  }

  getProviderResponseId(): string | undefined {
    return this.lastProviderResponseId;
  }

  /**
   * Return only the current turn's request-only context. The canonical
   * trajectory is persisted normally; this small hidden metadata is replayed
   * before the next run's assistant/tool suffix to preserve the prior prefix.
   */
  getPromptCacheReplayContext(): AIMessage[] {
    if (!this.lastProviderRequestMessages) return [];
    return extractPromptCacheReplayContext(this.lastProviderRequestMessages, this.options.messages);
  }

  private isCancelled(): boolean {
    return this.options.signal?.aborted === true;
  }

  private isCancellationError(error: unknown): boolean {
    if (this.isCancelled()) return true;
    if (!error || typeof error !== 'object') return false;
    const record = error as { name?: unknown; code?: unknown; message?: unknown };
    return (
      record.name === 'AbortError' ||
      record.code === 'ABORT_ERR' ||
      String(record.message || '')
        .toLowerCase()
        .includes('abort')
    );
  }

  getPromptCacheReplayHistory(): Record<string, unknown> | undefined {
    if (!this.lastProviderRequestMessages) return undefined;
    return buildPromptCacheReplayHistoryMetadata(
      this.lastProviderRequestMessages,
      this.options.messages
    );
  }

  private toCancelledResult(trace: AgentRunTrace, lastToolResult?: unknown): AgentExecutionResult {
    trace.finishedAt = new Date().toISOString();
    return {
      content: '',
      data: lastToolResult ?? undefined,
      usage: trace.rounds.map((round) => round.usage).filter(Boolean),
      stopReason: 'cancelled',
      trace: this.options.agentDef.runtime?.returnTrace === false ? undefined : trace
    };
  }

  async run(): Promise<AgentExecutionResult> {
    const { agentDef, provider, tools, messages, silent, budgetPolicy, observationPolicy } =
      this.options;
    const providerTools = this.options.providerTools ?? tools;

    const mode = getRuntimeMode(agentDef);
    const maxRounds = getMaxRounds(agentDef, budgetPolicy);
    const trace: AgentRunTrace = {
      runId: createRunId(agentDef.id),
      mode,
      startedAt: new Date().toISOString(),
      rounds: []
    };

    let finalContent = '';
    let lastToolResult: unknown = null;
    let stopReason: AgentExecutionResult['stopReason'] = 'max_rounds';
    let rounds = 0;
    const toolFailureCounts = new Map<string, number>();
    const maxRepeatedToolErrors = getMaxRepeatedToolErrors(agentDef);
    const stopOnRepeatedToolError = shouldStopOnRepeatedToolError(agentDef);
    const maxToolCalls = normalizePositiveInteger(
      budgetPolicy?.maxToolCalls ?? agentDef.runtime?.maxToolCalls
    );
    const maxToolCallsPerRound = normalizePositiveInteger(
      budgetPolicy?.maxToolCallsPerRound ?? agentDef.runtime?.maxToolCallsPerRound
    );
    const observationTracker = createObservationPolicyTracker(observationPolicy);
    let acceptedToolCallCount = 0;

    if (this.isCancelled()) return this.toCancelledResult(trace, lastToolResult);

    while (rounds < maxRounds) {
      if (this.isCancelled()) return this.toCancelledResult(trace, lastToolResult);
      const roundIndex = rounds + 1;
      if (!silent) {
        LogService.info(`[Agent ${agentDef.name}] Round ${roundIndex} starting...`);
      }

      const request = await this.buildModelMessages(messages, roundIndex);
      if (this.isCancelled()) return this.toCancelledResult(trace, lastToolResult);
      await this.options.middleware?.beforeModelCall?.({
        messages: request.messages,
        providerId: agentDef.providerId,
        model: agentDef.model,
        systemInstruction: request.systemInstruction,
        turnContextFingerprint: request.requestContext?.turnContextFingerprint
      });
      let response: AIResponse;
      try {
        response = await provider.generateContent(
          request.messages,
          request.providerTools ?? providerTools,
          request.systemInstruction,
          {
            signal: this.options.signal,
            responseCache: this.resolveProviderResponseCache(roundIndex)
          }
        );
        this.captureProviderResponseId(response);
      } catch (error) {
        if (this.isCancellationError(error)) return this.toCancelledResult(trace, lastToolResult);
        if (isProviderGovernanceBudgetError(error)) {
          const usage = providerGovernanceBudgetErrorToUsage(error);
          trace.rounds.push(this.createBudgetExceededRound(roundIndex, usage));
          trace.finishedAt = new Date().toISOString();
          return this.toResult('', lastToolResult, trace, 'budget_exceeded');
        }
        throw error;
      }
      if (this.isCancelled()) return this.toCancelledResult(trace, lastToolResult);
      await this.options.middleware?.afterModelCall?.({
        messages: request.messages,
        providerId: agentDef.providerId,
        model: agentDef.model,
        systemInstruction: request.systemInstruction,
        turnContextFingerprint: request.requestContext?.turnContextFingerprint,
        result: response
      });
      const normalizedToolCalls = normalizeToolCalls(response.tool_calls, 'provider');
      const round = this.createRound(roundIndex, response, tools, normalizedToolCalls);

      if (!silent) {
        LogService.info(
          `[Agent ${agentDef.name}] Provider raw response: ${JSON.stringify({
            content: response.content,
            tool_calls: normalizedToolCalls.map((tc) => tc.name),
            has_raw_parts: !!response.raw_parts
          })}`
        );
      }

      const responseContent = response.content || '';
      if (!silent && responseContent) {
        LogService.info(
          `[Agent ${agentDef.name}] Round ${roundIndex} AI Response: "${responseContent.slice(0, 500)}${responseContent.length > 500 ? '...' : ''}"`
        );
      }

      messages.push({
        role: 'assistant',
        content: responseContent || null,
        tool_calls: normalizedToolCalls.length ? normalizedToolCalls : undefined,
        reasoning: response.reasoning?.trim() || undefined,
        raw_parts: response.raw_parts
      });

      if (normalizedToolCalls.length > 0) {
        if (!silent) {
          LogService.info(
            `Agent ${agentDef.name} calling tools: ${normalizedToolCalls.map((tc) => tc.name).join(', ')}`
          );
        }

        let acceptedToolCallsThisRound = 0;
        const parallelResult = await this.tryExecuteParallelToolBatch({
          toolCalls: normalizedToolCalls,
          round,
          roundIndex,
          messages,
          observationTracker,
          acceptedToolCallCount,
          maxToolCalls,
          maxToolCallsPerRound
        });
        if (parallelResult) {
          if (parallelResult.cancelled) return this.toCancelledResult(trace, lastToolResult);
          acceptedToolCallCount = parallelResult.acceptedToolCallCount;
          if (parallelResult.hasLastToolResult) {
            lastToolResult = parallelResult.lastToolResult;
          }
          if (parallelResult.stopReason) {
            stopReason = parallelResult.stopReason;
            trace.rounds.push(round);
            trace.finishedAt = new Date().toISOString();
            return this.toResult(finalContent, lastToolResult, trace, stopReason);
          }
          trace.rounds.push(round);
          rounds++;
          continue;
        }

        for (const tc of normalizedToolCalls) {
          if (this.isCancelled()) return this.toCancelledResult(trace, lastToolResult);
          const guard = observationTracker?.beforeToolCall({
            toolName: tc.name,
            arguments: tc.arguments
          });
          if (guard && guard.action !== 'allow') {
            const observation = this.createObservationGuardObservation(tc, guard);
            round.observations.push(observation);
            await this.notifyToolObservation(observation, round.index);
            messages.push({
              role: 'tool',
              tool_call_id: tc.id,
              name: tc.name,
              content: observation.content
            });
            if (guard.action === 'stop') {
              stopReason = 'repeated_tool_observation';
              trace.rounds.push(round);
              trace.finishedAt = new Date().toISOString();
              return this.toResult(finalContent, lastToolResult, trace, stopReason);
            }
            continue;
          }

          const runLimitHit =
            typeof maxToolCalls === 'number' && acceptedToolCallCount >= maxToolCalls;
          const roundLimitHit =
            typeof maxToolCallsPerRound === 'number' &&
            acceptedToolCallsThisRound >= maxToolCallsPerRound;
          if (runLimitHit || roundLimitHit) {
            const observation = createToolLimitObservation({
              toolName: tc.name,
              toolCallId: tc.id,
              round: roundIndex,
              scope: runLimitHit ? 'run' : 'round',
              limit: (runLimitHit ? maxToolCalls : maxToolCallsPerRound) || 0,
              current: runLimitHit ? acceptedToolCallCount : acceptedToolCallsThisRound
            });
            observationTracker?.recordObservation({
              toolName: tc.name,
              arguments: tc.arguments,
              observation
            });
            round.observations.push(observation);
            await this.notifyToolObservation(observation, round.index);
            messages.push({
              role: 'tool',
              tool_call_id: tc.id,
              name: tc.name,
              content: observation.content
            });
            if (runLimitHit) {
              stopReason = 'max_tool_calls';
              trace.rounds.push(round);
              trace.finishedAt = new Date().toISOString();
              return this.toResult(finalContent, lastToolResult, trace, stopReason);
            }
            continue;
          }

          acceptedToolCallCount += 1;
          acceptedToolCallsThisRound += 1;
          const startedAt = Date.now();
          let resolvedPermission: PermissionDecision | PermissionRequest | undefined;
          try {
            if (!silent) {
              LogService.info(
                `[Agent ${agentDef.name}] Round ${roundIndex} Tool Call: ${tc.name} with args: ${JSON.stringify(tc.arguments)}`
              );
            }

            await this.maybePauseForUserInput(
              tc,
              roundIndex,
              responseContent,
              acceptedToolCallCount,
              acceptedToolCallsThisRound
            );

            const permission = await this.decideToolPermission(tc);
            resolvedPermission =
              permission.decision.effect === 'ask' ? permission.request : permission.decision;
            await this.options.middleware?.beforeToolCall?.({
              toolName: tc.name,
              arguments: tc.arguments,
              permission: resolvedPermission
            });
            if (permission.decision.effect === 'ask') {
              await this.options.permission?.onPermissionRequired?.(
                permission.request,
                this.createPermissionPauseState(
                  tc,
                  roundIndex,
                  responseContent,
                  acceptedToolCallCount,
                  acceptedToolCallsThisRound
                )
              );
              throw new PermissionPauseError(permission.request);
            }
            await this.options.permission?.onPermissionResolved?.(permission.decision);
            if (permission.decision.effect === 'deny') {
              throw new Error(
                permission.decision.reason || `Permission denied for tool: ${tc.name}`
              );
            }

            const toolOutcome = await this.callTool(tc);
            if (!toolOutcome.ok) {
              if (toolOutcome.cancelled) return this.toCancelledResult(trace, lastToolResult);
              await this.options.middleware?.afterToolCall?.({
                toolName: tc.name,
                arguments: tc.arguments,
                permission: permission.decision,
                result: { success: false, error: toolOutcome.errorMessage }
              });
              const failureResult = await this.recordFailedToolCall({
                tc,
                errorMessage: toolOutcome.errorMessage,
                envelope: toolOutcome.envelope,
                startedAt,
                round,
                messages,
                observationTracker,
                toolFailureCounts,
                stopOnRepeatedToolError,
                maxRepeatedToolErrors,
                agentName: agentDef.name,
                silent,
                permission: resolvedPermission
              });
              if (failureResult.stopReason) {
                stopReason = failureResult.stopReason;
                trace.rounds.push(round);
                trace.finishedAt = new Date().toISOString();
                return this.toResult(finalContent, lastToolResult, trace, stopReason);
              }
              continue;
            }

            const result = toolOutcome.result;
            if (this.isCancelled()) return this.toCancelledResult(trace, lastToolResult);
            await this.options.middleware?.afterToolCall?.({
              toolName: tc.name,
              arguments: tc.arguments,
              permission: permission.decision,
              result
            });
            const toolContext = await this.prepareToolResultContext(tc, result);
            const observation = this.createObservation(
              tc,
              true,
              toolContext,
              startedAt,
              undefined,
              toolOutcome.envelope
            );
            observationTracker?.recordObservation({
              toolName: tc.name,
              arguments: tc.arguments,
              observation
            });
            round.observations.push(observation);
            await this.notifyToolObservation(observation, round.index);

            if (!silent) {
              LogService.info(`[Agent ${agentDef.name}] Round ${roundIndex} Tool Result Success`);
            }

            messages.push({
              role: 'tool',
              tool_call_id: tc.id,
              name: tc.name,
              content: observation.canonicalMessageContent ?? observation.content
            });

            lastToolResult = toolContext.data ?? result;
          } catch (error: any) {
            if (this.isCancellationError(error))
              return this.toCancelledResult(trace, lastToolResult);
            await this.options.middleware?.afterToolCall?.({
              toolName: tc.name,
              arguments: tc.arguments,
              permission: resolvedPermission,
              result: {
                success: false,
                error: error?.message || String(error)
              }
            });
            if (isPermissionPauseError(error)) {
              const observation = this.createObservation(
                tc,
                false,
                undefined,
                startedAt,
                error.message,
                getToolExecutionEnvelopeFromError(error)
              );
              round.observations.push(observation);
              await this.notifyToolObservation(observation, round.index);
              trace.rounds.push(round);
              trace.finishedAt = new Date().toISOString();
              return this.toResult(
                `Permission required: ${error.request.permissionId}`,
                lastToolResult,
                trace,
                'permission_required'
              );
            }
            if (isUserInputPauseError(error)) {
              const observation = this.createObservation(
                tc,
                false,
                undefined,
                startedAt,
                error.message,
                getToolExecutionEnvelopeFromError(error)
              );
              round.observations.push(observation);
              await this.notifyToolObservation(observation, round.index);
              trace.rounds.push(round);
              trace.finishedAt = new Date().toISOString();
              return this.toResult(
                `User input required: ${error.request.requestId}`,
                lastToolResult,
                trace,
                'needs_input'
              );
            }

            const errorMessage = toolFailureMessage(error);
            await this.options.middleware?.afterToolCall?.({
              toolName: tc.name,
              arguments: tc.arguments,
              permission: resolvedPermission,
              result: { success: false, error: errorMessage }
            });
            const failureResult = await this.recordFailedToolCall({
              tc,
              errorMessage,
              envelope: getToolExecutionEnvelopeFromError(error),
              startedAt,
              round,
              messages,
              observationTracker,
              toolFailureCounts,
              stopOnRepeatedToolError,
              maxRepeatedToolErrors,
              agentName: agentDef.name,
              silent,
              permission: resolvedPermission
            });
            if (failureResult.stopReason) {
              stopReason = failureResult.stopReason;
              trace.rounds.push(round);
              trace.finishedAt = new Date().toISOString();
              return this.toResult(finalContent, lastToolResult, trace, stopReason);
            }
          }
        }

        // Tool results appended this round — re-measure so context usage
        // reflects the growth between rounds, not only at the next pre-call.
        await this.measureContextUsage(messages, roundIndex, false);
        trace.rounds.push(round);
        rounds++;
        continue;
      }

      finalContent =
        typeof responseContent === 'string' ? responseContent : JSON.stringify(responseContent);
      await this.maybeOffloadModelOutput(finalContent, roundIndex);
      if (!finalContent.trim()) {
        stopReason = 'empty_response';
        if (!silent) {
          LogService.warn(
            `[Agent ${agentDef.name}] Round ${roundIndex} received empty content and no tool calls.`
          );
        }
      } else {
        stopReason = 'final';
      }
      // Terminal answer — publish a final snapshot so the UI settles on the
      // exact post-turn context size including this assistant message.
      await this.measureContextUsage(messages, roundIndex, false);
      trace.rounds.push(round);
      break;
    }

    if (this.isCancelled()) return this.toCancelledResult(trace, lastToolResult);
    trace.finishedAt = new Date().toISOString();
    return this.toResult(finalContent, lastToolResult, trace, stopReason);
  }

  async resumeFromPermission(
    input: ReActRuntimePermissionResumeInput
  ): Promise<AgentExecutionResult> {
    const { agentDef, tools, messages, silent, budgetPolicy, observationPolicy } = this.options;
    const mode = getRuntimeMode(agentDef);
    const maxRounds = getMaxRounds(agentDef, budgetPolicy);
    const trace: AgentRunTrace = {
      runId: createRunId(agentDef.id),
      mode,
      startedAt: new Date().toISOString(),
      rounds: []
    };
    const observationTracker = createObservationPolicyTracker(observationPolicy);
    const toolFailureCounts = new Map<string, number>();
    const maxRepeatedToolErrors = getMaxRepeatedToolErrors(agentDef);
    const stopOnRepeatedToolError = shouldStopOnRepeatedToolError(agentDef);
    let lastToolResult: unknown = null;
    const finalContent = '';

    if (this.isCancelled()) return this.toCancelledResult(trace, lastToolResult);
    const pendingToolCall = this.resolvePermissionResumeToolCall(input);
    const startedAt = Date.now();
    const resumeRound = this.createRound(
      input.state.roundIndex || 1,
      { content: input.state.assistantContent || '', tool_calls: [pendingToolCall] } as AIResponse,
      tools,
      [pendingToolCall]
    );

    this.preparePermissionResumeMessages(messages, pendingToolCall, input.state.assistantContent);

    if (input.decision.effect === 'ask') {
      trace.rounds.push(resumeRound);
      trace.finishedAt = new Date().toISOString();
      return this.toResult(
        `Permission required: ${input.decision.permissionId}`,
        lastToolResult,
        trace,
        'permission_required'
      );
    }

    if (input.decision.effect === 'deny') {
      const observation = this.createUserDeniedObservation(
        pendingToolCall,
        input.decision.reason || `Permission denied for tool: ${pendingToolCall.name}`,
        startedAt
      );
      resumeRound.observations.push(observation);
      await this.notifyToolObservation(observation, resumeRound.index);
      await this.emitStreamChunk({
        type: 'trace_observation',
        round: resumeRound.index,
        observation
      });
      messages.push({
        role: 'tool',
        tool_call_id: pendingToolCall.id,
        name: pendingToolCall.name,
        content: observation.content
      });
    } else {
      try {
        if (!silent) {
          LogService.info(
            `[Agent ${agentDef.name}] Resuming Tool Call: ${pendingToolCall.name} with args: ${JSON.stringify(pendingToolCall.arguments)}`
          );
        }
        await this.options.middleware?.beforeToolCall?.({
          toolName: pendingToolCall.name,
          arguments: pendingToolCall.arguments,
          permission: input.decision
        });
        const toolOutcome = await this.callTool(pendingToolCall);
        if (!toolOutcome.ok) {
          if (toolOutcome.cancelled) return this.toCancelledResult(trace, lastToolResult);
          await this.options.middleware?.afterToolCall?.({
            toolName: pendingToolCall.name,
            arguments: pendingToolCall.arguments,
            permission: input.decision,
            result: { success: false, error: toolOutcome.errorMessage }
          });
          const failureResult = await this.recordFailedToolCall({
            tc: pendingToolCall,
            errorMessage: toolOutcome.errorMessage,
            envelope: toolOutcome.envelope,
            startedAt,
            round: resumeRound,
            messages,
            observationTracker,
            toolFailureCounts,
            stopOnRepeatedToolError,
            maxRepeatedToolErrors,
            agentName: agentDef.name,
            silent
          });
          await this.emitStreamChunk({
            type: 'trace_observation',
            round: resumeRound.index,
            observation: failureResult.observation
          });
          if (failureResult.stopReason) {
            trace.rounds.push(resumeRound);
            trace.finishedAt = new Date().toISOString();
            return this.toResult(finalContent, lastToolResult, trace, failureResult.stopReason);
          }
        } else {
          const result = toolOutcome.result;
          if (this.isCancelled()) return this.toCancelledResult(trace, lastToolResult);
          await this.options.middleware?.afterToolCall?.({
            toolName: pendingToolCall.name,
            arguments: pendingToolCall.arguments,
            permission: input.decision,
            result
          });
          const toolContext = await this.prepareToolResultContext(pendingToolCall, result);
          const observation = this.createObservation(
            pendingToolCall,
            true,
            toolContext,
            startedAt,
            undefined,
            toolOutcome.envelope
          );
          observationTracker?.recordObservation({
            toolName: pendingToolCall.name,
            arguments: pendingToolCall.arguments,
            observation
          });
          resumeRound.observations.push(observation);
          await this.notifyToolObservation(observation, resumeRound.index);
          await this.emitStreamChunk({
            type: 'trace_observation',
            round: resumeRound.index,
            observation
          });
          messages.push({
            role: 'tool',
            tool_call_id: pendingToolCall.id,
            name: pendingToolCall.name,
            content: observation.canonicalMessageContent ?? observation.content
          });
          lastToolResult = toolContext.data ?? result;
        }
      } catch (error: unknown) {
        if (this.isCancellationError(error)) return this.toCancelledResult(trace, lastToolResult);
        const errorMessage = toolFailureMessage(error);
        await this.options.middleware?.afterToolCall?.({
          toolName: pendingToolCall.name,
          arguments: pendingToolCall.arguments,
          permission: input.decision,
          result: { success: false, error: errorMessage }
        });
        const failureResult = await this.recordFailedToolCall({
          tc: pendingToolCall,
          errorMessage,
          envelope: getToolExecutionEnvelopeFromError(error),
          startedAt,
          round: resumeRound,
          messages,
          observationTracker,
          toolFailureCounts,
          stopOnRepeatedToolError,
          maxRepeatedToolErrors,
          agentName: agentDef.name,
          silent
        });
        await this.emitStreamChunk({
          type: 'trace_observation',
          round: resumeRound.index,
          observation: failureResult.observation
        });
        if (failureResult.stopReason) {
          trace.rounds.push(resumeRound);
          trace.finishedAt = new Date().toISOString();
          return this.toResult(finalContent, lastToolResult, trace, failureResult.stopReason);
        }
      }
    }

    trace.rounds.push(resumeRound);

    const pausedRound = input.state.roundIndex || 1;
    let remainingRounds = Math.max(0, maxRounds - pausedRound);
    if (input.decision.effect === 'allow' || input.decision.effect === 'deny') {
      remainingRounds = Math.max(remainingRounds, 1);
    }
    if (remainingRounds <= 0) {
      trace.finishedAt = new Date().toISOString();
      return this.toResult(finalContent, lastToolResult, trace, 'max_rounds');
    }

    return this.runPermissionContinuation({
      agentDef,
      messages,
      remainingRounds,
      trace,
      resumeRoundIndex: resumeRound.index,
      lastToolResult,
      finalContent
    });
  }

  async resumeFromUserInput(
    input: ReActRuntimeUserInputResumeInput
  ): Promise<AgentExecutionResult> {
    const { agentDef, tools, messages, silent, budgetPolicy, observationPolicy } = this.options;
    const mode = getRuntimeMode(agentDef);
    const maxRounds = getMaxRounds(agentDef, budgetPolicy);
    const trace: AgentRunTrace = {
      runId: createRunId(agentDef.id),
      mode,
      startedAt: new Date().toISOString(),
      rounds: []
    };
    const observationTracker = createObservationPolicyTracker(observationPolicy);
    const toolFailureCounts = new Map<string, number>();
    const maxRepeatedToolErrors = getMaxRepeatedToolErrors(agentDef);
    const stopOnRepeatedToolError = shouldStopOnRepeatedToolError(agentDef);
    let lastToolResult: unknown = null;
    const finalContent = '';

    if (this.isCancelled()) return this.toCancelledResult(trace, lastToolResult);
    if (input.resolution.action === 'cancel') {
      trace.finishedAt = new Date().toISOString();
      return this.toResult(finalContent, lastToolResult, trace, 'cancelled');
    }

    const pendingToolCall = this.normalizeResumeToolCall(input.state.pendingToolCall);
    const startedAt = Date.now();
    const resumeRound = this.createRound(
      input.state.roundIndex || 1,
      { content: input.state.assistantContent || '', tool_calls: [pendingToolCall] } as AIResponse,
      tools,
      [pendingToolCall]
    );

    this.preparePermissionResumeMessages(messages, pendingToolCall, input.state.assistantContent);

    const observation = this.createUserInputObservation(
      pendingToolCall,
      input.resolution,
      startedAt
    );
    resumeRound.observations.push(observation);
    await this.notifyToolObservation(observation, resumeRound.index);
    await this.emitStreamChunk({
      type: 'trace_observation',
      round: resumeRound.index,
      observation
    });
    messages.push({
      role: 'tool',
      tool_call_id: pendingToolCall.id,
      name: pendingToolCall.name,
      content: observation.content
    });
    lastToolResult = observation.data;

    trace.rounds.push(resumeRound);

    const pausedRound = input.state.roundIndex || 1;
    let remainingRounds = Math.max(0, maxRounds - pausedRound);
    remainingRounds = Math.max(remainingRounds, 1);
    if (remainingRounds <= 0) {
      trace.finishedAt = new Date().toISOString();
      return this.toResult(finalContent, lastToolResult, trace, 'max_rounds');
    }

    if (!silent) {
      LogService.info(
        `[Agent ${agentDef.name}] Resumed ask_user_question with input: ${JSON.stringify(input.resolution.input)}`
      );
    }

    return this.runPermissionContinuation({
      agentDef,
      messages,
      remainingRounds,
      trace,
      resumeRoundIndex: resumeRound.index,
      lastToolResult,
      finalContent
    });
  }

  private async emitStreamChunk(chunk: unknown): Promise<void> {
    await this.options.onStreamChunk?.(chunk);
  }

  private async runPermissionContinuation(input: {
    agentDef: AgentDefinition;
    messages: AIMessage[];
    remainingRounds: number;
    trace: AgentRunTrace;
    resumeRoundIndex: number;
    lastToolResult: unknown;
    finalContent: string;
  }): Promise<AgentExecutionResult> {
    const {
      agentDef,
      messages,
      remainingRounds,
      trace,
      resumeRoundIndex,
      lastToolResult,
      finalContent
    } = input;
    const continuationRuntime = new ReActRuntime({
      ...this.options,
      agentDef: {
        ...agentDef,
        runtime: {
          ...agentDef.runtime,
          maxRounds: remainingRounds
        }
      },
      messages
    });

    if (!this.options.onStreamChunk) {
      const continuationResult = await continuationRuntime.run();
      const continuationTrace = continuationResult.trace;
      if (continuationTrace) {
        trace.rounds.push(
          ...continuationTrace.rounds.map((round) => ({
            ...round,
            index: resumeRoundIndex + round.index
          }))
        );
      }
      trace.finishedAt = continuationTrace?.finishedAt ?? new Date().toISOString();

      return {
        ...continuationResult,
        data: continuationResult.data ?? lastToolResult,
        usage: trace.rounds.map((round) => round.usage).filter(Boolean),
        toolCalls: trace.rounds.flatMap((round) => round.toolCalls),
        trace: this.options.agentDef.runtime?.returnTrace === false ? undefined : trace
      };
    }

    const continuationState = createRuntimeStreamAccumulation();
    for await (const chunk of continuationRuntime.stream()) {
      await this.emitStreamChunk(chunk);
      accumulateRuntimeStreamChunk(chunk, continuationState);
    }

    trace.finishedAt = new Date().toISOString();
    return {
      content: continuationState.content || finalContent,
      stopReason: continuationState.stopReason,
      data: lastToolResult,
      usage: trace.rounds.map((round) => round.usage).filter(Boolean),
      toolCalls: trace.rounds.flatMap((round) => round.toolCalls),
      trace: this.options.agentDef.runtime?.returnTrace === false ? undefined : trace
    };
  }

  async *stream(): AsyncIterable<any> {
    const { agentDef, provider, tools, messages, budgetPolicy, observationPolicy } = this.options;
    const providerTools = this.options.providerTools ?? tools;
    if (!provider.streamContent) {
      throw new Error(`Provider ${provider.name} does not support streaming`);
    }

    let rounds = 0;
    const maxRounds = getMaxRounds(agentDef, budgetPolicy);
    const toolFailureCounts = new Map<string, number>();
    const maxRepeatedToolErrors = getMaxRepeatedToolErrors(agentDef);
    const stopOnRepeatedToolError = shouldStopOnRepeatedToolError(agentDef);
    const maxToolCalls = normalizePositiveInteger(
      budgetPolicy?.maxToolCalls ?? agentDef.runtime?.maxToolCalls
    );
    const maxToolCallsPerRound = normalizePositiveInteger(
      budgetPolicy?.maxToolCallsPerRound ?? agentDef.runtime?.maxToolCallsPerRound
    );
    const observationTracker = createObservationPolicyTracker(observationPolicy);
    let acceptedToolCallCount = 0;

    if (this.isCancelled()) {
      yield { type: 'final_trace', stopReason: 'cancelled' };
      return;
    }

    while (rounds < maxRounds) {
      if (this.isCancelled()) {
        yield { type: 'final_trace', stopReason: 'cancelled' };
        return;
      }
      const round = rounds + 1;
      const roundModelStartedAt = Date.now();
      yield { type: 'round_start', round };

      const request = await this.buildModelMessages(messages, round);
      if (this.isCancelled()) {
        yield { type: 'final_trace', stopReason: 'cancelled' };
        return;
      }
      await this.options.middleware?.beforeModelCall?.({
        messages: request.messages,
        providerId: agentDef.providerId,
        model: agentDef.model,
        systemInstruction: request.systemInstruction,
        turnContextFingerprint: request.requestContext?.turnContextFingerprint
      });

      const stream = provider.streamContent(
        request.messages,
        request.providerTools ?? providerTools,
        request.systemInstruction,
        {
          signal: this.options.signal,
          responseCache: this.resolveProviderResponseCache(round)
        }
      );
      let roundContent = '';
      let roundReasoning = '';
      let roundUsage: AIResponse['usage'] | undefined;
      let roundRawParts: AIResponse['raw_parts'];
      let roundProvider: AgentRunRound['provider'] | undefined;
      let roundBudget: AgentRunRound['budget'] | undefined;
      const toolCallState = new Map<string, StreamToolCallAccumulator>();

      try {
        for await (const chunk of stream) {
          if (this.isCancelled()) {
            yield { type: 'final_trace', stopReason: 'cancelled' };
            return;
          }
          const governance = extractProviderGovernanceMetadata(chunk.usage);
          if (chunk.usage && isSubstantiveProviderUsage(chunk.usage)) {
            roundUsage = chunk.usage;
          }
          if (governance) {
            roundProvider = toRoundProviderTrace(governance);
            roundBudget = toRoundBudgetTrace(governance);
          }
          this.captureProviderResponseId(chunk);
          if (chunk.raw_parts?.length) {
            roundRawParts = chunk.raw_parts;
          }
          if (chunk.reasoning) {
            roundReasoning += chunk.reasoning;
            for await (const piece of emitPacedStreamChunks(chunk.reasoning)) {
              yield { type: 'reasoning', content: piece, round };
            }
          }
          if (chunk.content) {
            roundContent += chunk.content;
            yield { type: 'content', content: chunk.content, round };
          }
          if (chunk.tool_calls) {
            const deltaToolCalls = chunk.tool_calls.map((tc, index) => {
              const requestKey = toolCallStreamKey(tc, index, toolCallState);
              const existing = toolCallState.get(requestKey) || { requestKey };
              toolCallState.set(requestKey, mergeStreamToolCall(existing, tc));
              return { ...tc, requestKey };
            });
            yield { type: 'tool_calls_delta', round, tool_calls: deltaToolCalls };
          }
        }
      } catch (error: any) {
        if (this.isCancellationError(error)) {
          yield { type: 'final_trace', stopReason: 'cancelled' };
          return;
        }
        if (isProviderGovernanceBudgetError(error)) {
          yield {
            type: 'provider_governance_budget',
            round,
            usage: providerGovernanceBudgetErrorToUsage(error)
          };
          yield { type: 'final_trace', stopReason: 'budget_exceeded' };
          return;
        }
        const errorMessage = error?.message || String(error);
        const canGracefullyFinish =
          !!roundContent.trim() && compactStreamToolCalls(toolCallState).length === 0;

        if (canGracefullyFinish) {
          LogService.warn(
            `[Agent ${agentDef.name}] Streaming interrupted after partial content, treating as final response: ${errorMessage}`
          );
        } else {
          throw error;
        }
      }

      if (this.isCancelled()) {
        yield { type: 'final_trace', stopReason: 'cancelled' };
        return;
      }

      await this.options.middleware?.afterModelCall?.({
        messages: request.messages,
        providerId: agentDef.providerId,
        model: agentDef.model,
        systemInstruction: request.systemInstruction,
        turnContextFingerprint: request.requestContext?.turnContextFingerprint,
        result: {
          content: roundContent,
          tool_calls: compactStreamToolCalls(toolCallState),
          usage: roundUsage,
          raw_parts: roundRawParts
        }
      });

      let toolCalls = compactStreamToolCalls(toolCallState).map((tc) => {
        const normalized = normalizeToolCall(tc, 'stream');
        const stableId = normalized.id || `stream_${tc.requestKey.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
        return {
          ...normalized,
          id: stableId,
          requestKey: tc.requestKey
        };
      });

      const scheduledToolCalls: Array<{
        toolCall: (typeof toolCalls)[number];
        observation?: AgentToolObservation;
        stopReason?: AgentExecutionResult['stopReason'];
      }> = [];
      let acceptedToolCallsThisRound = 0;
      for (const toolCall of toolCalls) {
        if (this.isCancelled()) {
          yield { type: 'final_trace', stopReason: 'cancelled' };
          return;
        }
        const guard = observationTracker?.beforeToolCall({
          toolName: toolCall.name,
          arguments: toolCall.arguments
        });
        if (guard && guard.action !== 'allow') {
          scheduledToolCalls.push({
            toolCall,
            observation: this.createObservationGuardObservation(toolCall, guard),
            stopReason: guard.action === 'stop' ? 'repeated_tool_observation' : undefined
          });
          continue;
        }

        const runLimitHit =
          typeof maxToolCalls === 'number' && acceptedToolCallCount >= maxToolCalls;
        const roundLimitHit =
          typeof maxToolCallsPerRound === 'number' &&
          acceptedToolCallsThisRound >= maxToolCallsPerRound;
        if (runLimitHit || roundLimitHit) {
          const scope = runLimitHit ? 'run' : 'round';
          const limit = runLimitHit ? maxToolCalls : maxToolCallsPerRound;
          const current = runLimitHit ? acceptedToolCallCount : acceptedToolCallsThisRound;
          const observation = createToolLimitObservation({
            toolName: toolCall.name,
            toolCallId: toolCall.id,
            round,
            scope,
            limit: limit || current,
            current
          });
          observationTracker?.recordObservation({
            toolName: toolCall.name,
            arguments: toolCall.arguments,
            observation
          });
          scheduledToolCalls.push({
            toolCall,
            observation,
            stopReason: runLimitHit ? 'max_tool_calls' : undefined
          });
          continue;
        }

        acceptedToolCallCount += 1;
        acceptedToolCallsThisRound += 1;
        scheduledToolCalls.push({ toolCall });
      }
      toolCalls = scheduledToolCalls
        .filter((item) => !item.observation)
        .map((item) => item.toolCall);

      messages.push({
        role: 'assistant',
        content: roundContent || null,
        tool_calls:
          scheduledToolCalls.length > 0
            ? scheduledToolCalls.map((item) => item.toolCall)
            : undefined,
        reasoning: roundReasoning.trim() || undefined,
        raw_parts: roundRawParts
      });

      if (scheduledToolCalls.length > 0) {
        const reasoningDurationMs = Date.now() - roundModelStartedAt;
        yield {
          type: 'trace_round',
          round,
          assistantContent: roundContent,
          reasoning: roundReasoning.trim() || undefined,
          reasoningStreamed: Boolean(roundReasoning.trim()),
          reasoningDurationMs,
          toolCalls,
          usage: roundUsage,
          provider: roundProvider,
          budget: roundBudget
        };
        if (toolCalls.length > 0) {
          yield { type: 'tool_calls', round, tool_calls: toolCalls };
        }

        for (const scheduled of scheduledToolCalls) {
          if (this.isCancelled()) {
            yield { type: 'final_trace', stopReason: 'cancelled' };
            return;
          }
          const tc = scheduled.toolCall;
          if (scheduled.observation) {
            messages.push({
              role: 'tool',
              tool_call_id: tc.id,
              name: tc.name,
              content: scheduled.observation.content
            });
            yield { type: 'trace_observation', round, observation: scheduled.observation };
            if (scheduled.stopReason) {
              yield { type: 'final_trace', stopReason: scheduled.stopReason };
              return;
            }
            continue;
          }

          const startedAt = Date.now();
          let resolvedPermission: PermissionDecision | PermissionRequest | undefined;
          try {
            yield { type: 'tool_start', tool: tc.name, args: tc.arguments, round };
            await this.maybePauseForUserInput(
              tc,
              round,
              roundContent,
              acceptedToolCallCount,
              acceptedToolCallsThisRound
            );
            const permission = await this.decideToolPermission(tc);
            resolvedPermission =
              permission.decision.effect === 'ask' ? permission.request : permission.decision;
            await this.options.middleware?.beforeToolCall?.({
              toolName: tc.name,
              arguments: tc.arguments,
              permission: resolvedPermission
            });
            if (permission.decision.effect === 'ask') {
              await this.options.permission?.onPermissionRequired?.(
                permission.request,
                this.createPermissionPauseState(
                  tc,
                  round,
                  roundContent,
                  acceptedToolCallCount,
                  acceptedToolCallsThisRound
                )
              );
              throw new PermissionPauseError(permission.request);
            }
            await this.options.permission?.onPermissionResolved?.(permission.decision);
            if (permission.decision.effect === 'deny') {
              throw new Error(
                permission.decision.reason || `Permission denied for tool: ${tc.name}`
              );
            }

            const toolOutcome = await this.callTool(tc);
            if (!toolOutcome.ok) {
              if (toolOutcome.cancelled) {
                yield { type: 'final_trace', stopReason: 'cancelled' };
                return;
              }
              await this.options.middleware?.afterToolCall?.({
                toolName: tc.name,
                arguments: tc.arguments,
                permission: permission.decision,
                result: { success: false, error: toolOutcome.errorMessage }
              });
              const failureResult = await this.recordFailedToolCall({
                tc,
                errorMessage: toolOutcome.errorMessage,
                envelope: toolOutcome.envelope,
                startedAt,
                roundIndex: round,
                messages,
                observationTracker,
                toolFailureCounts,
                stopOnRepeatedToolError,
                maxRepeatedToolErrors,
                agentName: agentDef.name,
                permission: resolvedPermission
              });
              yield {
                type: 'tool_error',
                tool: tc.name,
                toolCallId: tc.id,
                error: toolOutcome.errorMessage,
                round
              };
              yield { type: 'trace_observation', round, observation: failureResult.observation };
              if (failureResult.stopReason) {
                yield {
                  type: 'content',
                  content: formatToolFailureForUser(failureResult.observation)
                };
                yield { type: 'final_trace', stopReason: failureResult.stopReason };
                return;
              }
              continue;
            }

            const result = toolOutcome.result;
            if (this.isCancelled()) {
              yield { type: 'final_trace', stopReason: 'cancelled' };
              return;
            }
            await this.options.middleware?.afterToolCall?.({
              toolName: tc.name,
              arguments: tc.arguments,
              permission: permission.decision,
              result
            });
            const toolContext = await this.prepareToolResultContext(tc, result);
            const observation = this.createObservation(
              tc,
              true,
              toolContext,
              startedAt,
              undefined,
              toolOutcome.envelope
            );
            observationTracker?.recordObservation({
              toolName: tc.name,
              arguments: tc.arguments,
              observation
            });
            await this.notifyToolObservation(observation, round);
            messages.push({
              role: 'tool',
              tool_call_id: tc.id,
              name: tc.name,
              content: observation.canonicalMessageContent ?? observation.content
            });
            yield { type: 'trace_observation', round, observation };
          } catch (error: any) {
            if (this.isCancellationError(error)) {
              yield { type: 'final_trace', stopReason: 'cancelled' };
              return;
            }
            await this.options.middleware?.afterToolCall?.({
              toolName: tc.name,
              arguments: tc.arguments,
              permission: resolvedPermission,
              result: {
                success: false,
                error: error?.message || String(error)
              }
            });
            if (isPermissionPauseError(error)) {
              const observation = this.createObservation(
                tc,
                false,
                undefined,
                startedAt,
                error.message,
                getToolExecutionEnvelopeFromError(error)
              );
              await this.notifyToolObservation(observation, round);
              yield { type: 'trace_observation', round, observation };
              yield { type: 'final_trace', stopReason: 'permission_required' };
              return;
            }
            if (isUserInputPauseError(error)) {
              const observation = this.createObservation(
                tc,
                false,
                undefined,
                startedAt,
                error.message,
                getToolExecutionEnvelopeFromError(error)
              );
              await this.notifyToolObservation(observation, round);
              yield { type: 'trace_observation', round, observation };
              yield { type: 'final_trace', stopReason: 'needs_input' };
              return;
            }

            const errorMessage = toolFailureMessage(error);
            const failureResult = await this.recordFailedToolCall({
              tc,
              errorMessage,
              envelope: getToolExecutionEnvelopeFromError(error),
              startedAt,
              roundIndex: round,
              messages,
              observationTracker,
              toolFailureCounts,
              stopOnRepeatedToolError,
              maxRepeatedToolErrors,
              agentName: agentDef.name,
              permission: resolvedPermission
            });
            yield {
              type: 'tool_error',
              tool: tc.name,
              toolCallId: tc.id,
              error: errorMessage,
              round
            };
            yield { type: 'trace_observation', round, observation: failureResult.observation };
            if (failureResult.stopReason) {
              yield {
                type: 'content',
                content: formatToolFailureForUser(failureResult.observation)
              };
              yield { type: 'final_trace', stopReason: failureResult.stopReason };
              return;
            }
          }
        }
        // All tool results for this round have been appended to `messages`.
        // Re-measure context usage so the UI sees the real growth from tool
        // outputs immediately, rather than waiting for the next round's
        // pre-call measurement.
        await this.measureContextUsage(messages, round, false);
        rounds++;
      } else {
        if (this.isCancelled()) {
          yield { type: 'final_trace', stopReason: 'cancelled' };
          return;
        }
        await this.maybeOffloadModelOutput(roundContent, round);
        // Final answer — publish a terminal snapshot so the UI settles on the
        // exact post-turn context size (includes the last assistant message).
        await this.measureContextUsage(messages, round, false);
        const persistedReasoning = roundReasoning.trim();
        const reasoningDurationMs = Date.now() - roundModelStartedAt;
        yield {
          type: 'final_content',
          content: roundContent,
          reasoning: persistedReasoning || undefined,
          reasoningStreamed: Boolean(persistedReasoning),
          reasoningDurationMs,
          round,
          usage: roundUsage,
          provider: roundProvider,
          budget: roundBudget
        };
        yield {
          type: 'final_trace',
          stopReason: roundContent.trim() || roundReasoning.trim() ? 'final' : 'empty_response'
        };
        break;
      }
    }

    if (rounds >= maxRounds) {
      yield { type: 'final_trace', stopReason: 'max_rounds' };
    }
  }

  private createRound(
    index: number,
    response: AIResponse,
    tools: ToolDefinition[],
    toolCalls: NormalizedToolCall[] = normalizeToolCalls(response.tool_calls, 'runtime')
  ): AgentRunRound {
    const governance = extractProviderGovernanceMetadata(response.usage);
    return {
      index,
      assistantContent: response.content || '',
      toolCalls: toolCalls.map((tc) => toToolCallTrace(tc, tools)),
      observations: [],
      usage: response.usage,
      provider: governance ? toRoundProviderTrace(governance) : undefined,
      budget: governance ? toRoundBudgetTrace(governance) : undefined
    };
  }

  private createBudgetExceededRound(index: number, usage: AIResponse['usage']): AgentRunRound {
    const governance = extractProviderGovernanceMetadata(usage);
    return {
      index,
      assistantContent: '',
      toolCalls: [],
      observations: [],
      usage,
      provider: governance ? toRoundProviderTrace(governance) : undefined,
      budget: governance ? toRoundBudgetTrace(governance) : undefined
    };
  }

  private async decideToolPermission(tc: any): Promise<PermissionDecisionResult> {
    const identity = resolveMcpToolIdentity(tc.name, this.options.tools);
    if (this.options.permission) {
      return await this.options.permission.decide({
        toolName: tc.name,
        toolCallId: tc.id,
        arguments: tc.arguments,
        exposedName: identity.toolDef?.name || tc.name,
        originalName: identity.originalName,
        mcpServerId: identity.mcpServerId
      });
    }

    const now = new Date().toISOString();
    const permissionId = `perm_legacy_${tc.name}_${Date.now().toString(36)}`;
    return {
      request: {
        permissionId,
        runId: 'legacy',
        sessionId: 'legacy',
        subject: {
          toolName: tc.name,
          exposedName: identity.toolDef?.name || tc.name,
          originalName: identity.originalName,
          mcpServerId: identity.mcpServerId
        },
        arguments: tc.arguments,
        requestedAt: now
      },
      decision: {
        permissionId,
        effect: 'allow',
        reason: 'Legacy runtime default allow.',
        resolvedBy: 'policy',
        resolvedAt: now
      }
    };
  }

  private preparePermissionResumeMessages(
    messages: AIMessage[],
    pendingToolCall: NormalizedToolCall,
    assistantContent?: string
  ): void {
    const toolCallId = pendingToolCall.id;

    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message?.role !== 'tool' || message.tool_call_id !== toolCallId) continue;
      const content = typeof message.content === 'string' ? message.content : '';
      if (content.toLowerCase().includes('permission required')) {
        messages.splice(index, 1);
      }
      break;
    }

    const hasAssistantPredecessor = messages.some(
      (message) =>
        message.role === 'assistant' &&
        Array.isArray(message.tool_calls) &&
        message.tool_calls.some((call) => call?.id === toolCallId)
    );

    if (!hasAssistantPredecessor) {
      messages.push({
        role: 'assistant',
        content: assistantContent || null,
        tool_calls: [pendingToolCall]
      });
    }
  }

  private createPermissionPauseState(
    tc: NormalizedToolCall,
    roundIndex: number,
    assistantContent?: string,
    acceptedToolCallCount?: number,
    acceptedToolCallsThisRound?: number
  ): ReActRuntimePermissionPauseState {
    return {
      pendingToolCall: {
        id: tc.id,
        name: tc.name,
        arguments: tc.arguments,
        rawArguments: tc.rawArguments,
        parseError: tc.parseError,
        source: tc.source
      },
      roundIndex,
      assistantContent,
      acceptedToolCallCount,
      acceptedToolCallsThisRound
    };
  }

  private async maybePauseForUserInput(
    tc: NormalizedToolCall,
    roundIndex: number,
    assistantContent?: string,
    acceptedToolCallCount?: number,
    acceptedToolCallsThisRound?: number
  ): Promise<void> {
    if (!isAskUserQuestionToolName(tc.name)) return;
    const runId = this.options.permission?.runId ?? this.options.context?.runId ?? 'unknown';
    const sessionId =
      this.options.permission?.sessionId ?? this.options.context?.sessionId ?? 'unknown';
    const request: UserInputPauseRequest = {
      requestId: createUserInputRequestId(runId, tc.name),
      runId,
      sessionId,
      toolCallId: tc.id,
      toolName: tc.name,
      exposedName: tc.name,
      arguments: tc.arguments,
      prompt: extractAskUserQuestionPrompt(tc.arguments),
      requestedAt: new Date().toISOString(),
      metadata: {
        sourceKind: ASK_USER_QUESTION_TOOL_ID,
        toolCallId: tc.id
      }
    };
    const state = this.createPermissionPauseState(
      tc,
      roundIndex,
      assistantContent,
      acceptedToolCallCount,
      acceptedToolCallsThisRound
    );
    await this.options.userInput?.onUserInputRequired?.(request, state);
    throw new UserInputPauseError(request);
  }

  private resolvePermissionResumeToolCall(
    input: ReActRuntimePermissionResumeInput
  ): NormalizedToolCall {
    const pending = input.state.pendingToolCall;
    if (input.decision.editedArguments === undefined) {
      return this.normalizeResumeToolCall(pending);
    }
    return normalizeToolCall(
      {
        id: pending.id,
        name: pending.name,
        arguments: input.decision.editedArguments
      },
      pending.source === 'stream' || pending.source === 'runtime' ? pending.source : 'provider'
    );
  }

  private normalizeResumeToolCall(input: ReActRuntimePendingToolCallState): NormalizedToolCall {
    return {
      id: input.id,
      name: input.name,
      arguments: input.arguments,
      rawArguments: input.rawArguments ?? input.arguments,
      parseError: input.parseError,
      source: input.source === 'stream' || input.source === 'runtime' ? input.source : 'provider'
    };
  }

  private async tryExecuteParallelToolBatch(
    input: ParallelRoundToolExecutionInput
  ): Promise<ParallelRoundToolExecutionResult | undefined> {
    if (!this.canExecuteToolBatchInParallel(input)) return undefined;

    const outcomes = await Promise.all(
      input.toolCalls.map((toolCall) => this.executeParallelToolCall(toolCall))
    );
    if (outcomes.some((outcome) => outcome.cancelled)) {
      return {
        acceptedToolCallCount: input.acceptedToolCallCount + input.toolCalls.length,
        acceptedToolCallsThisRound: input.toolCalls.length,
        cancelled: true
      };
    }

    let hasLastToolResult = false;
    let lastToolResult: unknown;
    for (const outcome of outcomes) {
      const toolContext = outcome.success
        ? await this.prepareToolResultContext(outcome.toolCall, outcome.result)
        : undefined;
      const observation = this.createObservation(
        outcome.toolCall,
        outcome.success,
        toolContext,
        outcome.startedAt,
        outcome.errorMessage,
        outcome.envelope
      );
      input.round?.observations.push(observation);
      if (input.round) {
        await this.notifyToolObservation(observation, input.round.index);
      }
      input.observationTracker?.recordObservation({
        toolName: outcome.toolCall.name,
        arguments: outcome.toolCall.arguments,
        observation
      });
      input.messages.push({
        role: 'tool',
        tool_call_id: outcome.toolCall.id,
        name: outcome.toolCall.name,
        content:
          outcome.success && toolContext
            ? (observation.canonicalMessageContent ?? observation.content)
            : observation.content
      });
      if (outcome.success) {
        hasLastToolResult = true;
        lastToolResult = toolContext?.data ?? outcome.result;
      }
    }

    return {
      acceptedToolCallCount: input.acceptedToolCallCount + input.toolCalls.length,
      acceptedToolCallsThisRound: input.toolCalls.length,
      hasLastToolResult,
      lastToolResult
    };
  }

  private canExecuteToolBatchInParallel(input: ParallelRoundToolExecutionInput): boolean {
    if (input.toolCalls.length <= 1) return false;
    if (
      this.options.permission ||
      this.options.middleware?.beforeToolCall ||
      this.options.middleware?.afterToolCall
    ) {
      return false;
    }
    if (input.observationTracker) return false;
    const nextAcceptedCount = input.acceptedToolCallCount + input.toolCalls.length;
    if (typeof input.maxToolCalls === 'number' && nextAcceptedCount > input.maxToolCalls)
      return false;
    if (
      typeof input.maxToolCallsPerRound === 'number' &&
      input.toolCalls.length > input.maxToolCallsPerRound
    ) {
      return false;
    }
    return input.toolCalls.every((toolCall) =>
      isExplicitParallelToolCall(toolCall, this.options.tools)
    );
  }

  private async recordFailedToolCall(input: {
    tc: NormalizedToolCall;
    errorMessage: string;
    envelope?: ToolExecutionEnvelope;
    startedAt: number;
    round?: { index?: number; observations: AgentToolObservation[] };
    roundIndex?: number;
    messages: AIMessage[];
    observationTracker?: ObservationPolicyTracker;
    toolFailureCounts: Map<string, number>;
    stopOnRepeatedToolError: boolean;
    maxRepeatedToolErrors: number;
    agentName: string;
    silent?: boolean;
    permission?: PermissionDecision | PermissionRequest;
  }): Promise<{
    stopReason: AgentExecutionResult['stopReason'] | null;
    observation: AgentToolObservation;
  }> {
    void input.permission;
    if (!input.silent) {
      LogService.error(
        `[Agent ${input.agentName}] Tool ${input.tc.name} failed: ${input.errorMessage}`
      );
    }
    const observation = this.createObservation(
      input.tc,
      false,
      undefined,
      input.startedAt,
      input.errorMessage,
      input.envelope
    );
    input.observationTracker?.recordObservation({
      toolName: input.tc.name,
      arguments: input.tc.arguments,
      observation
    });
    input.round?.observations.push(observation);
    await this.notifyToolObservation(observation, input.round?.index ?? input.roundIndex ?? 0);
    input.messages.push({
      role: 'tool',
      tool_call_id: input.tc.id,
      name: input.tc.name,
      content: observation.content
    });

    const failureSignature = createToolFailureSignature(
      input.tc.name,
      input.tc.arguments,
      input.errorMessage
    );
    const failureCount = (input.toolFailureCounts.get(failureSignature) || 0) + 1;
    input.toolFailureCounts.set(failureSignature, failureCount);
    const toolErrorSignature = JSON.stringify({
      toolName: input.tc.name,
      errorMessage: input.errorMessage
    });
    const toolErrorCount = (input.toolFailureCounts.get(toolErrorSignature) || 0) + 1;
    input.toolFailureCounts.set(toolErrorSignature, toolErrorCount);
    // A policy denial is an observation for the model, not a terminal runtime
    // failure. Let the next round choose a non-network fallback instead of
    // ending the run before the provider can see the denial.
    const policyObservation =
      input.envelope?.error?.code === 'sandbox_denied' &&
      input.envelope.sandbox?.code === 'network_disabled';
    const nonRetryable =
      input.envelope?.error?.retryable === false &&
      input.envelope.error.code !== 'validation_error' &&
      !policyObservation;
    if (
      nonRetryable ||
      (input.stopOnRepeatedToolError &&
        (failureCount >= input.maxRepeatedToolErrors ||
          toolErrorCount >= input.maxRepeatedToolErrors))
    ) {
      return {
        stopReason: nonRetryable
          ? 'tool_error'
          : isInvalidToolArgumentsMessage(input.errorMessage)
            ? 'invalid_tool_arguments'
            : 'repeated_tool_error',
        observation
      };
    }
    return { stopReason: null, observation };
  }

  private async executeParallelToolCall(
    toolCall: NormalizedToolCall
  ): Promise<ParallelToolExecutionOutcome> {
    const startedAt = Date.now();
    const outcome = await this.callTool(toolCall);
    if (!outcome.ok) {
      return {
        toolCall,
        startedAt,
        success: false,
        cancelled: outcome.cancelled === true,
        errorMessage: outcome.errorMessage,
        envelope: outcome.envelope
      };
    }
    return {
      toolCall,
      startedAt,
      success: true,
      result: outcome.result,
      envelope: outcome.envelope
    };
  }

  private async callTool(tc: any): Promise<RuntimeToolCallResult> {
    if (this.isCancelled()) {
      return { ok: false, errorMessage: 'Agent run cancelled', cancelled: true };
    }
    const { agentDef, tools, mcpConfigs, mcpService, toolRegistry } = this.options;
    const exposedTool = findExposedTool(tc.name, tools);
    if (!exposedTool) {
      return { ok: false, errorMessage: `工具未在本次运行中暴露，已拒绝执行: ${tc.name}` };
    }

    try {
      if (!isMcpToolDefinition(exposedTool)) {
        const localTool =
          toolRegistry.getTool(exposedTool.id) || toolRegistry.getTool(exposedTool.name);
        if (!localTool) {
          return { ok: false, errorMessage: `未找到工具定义: ${tc.name}` };
        }
        const mergedArgs = this.mergeAgentToolArguments(agentDef, exposedTool.id, tc.arguments);
        const envelope = await toolRegistry.callToolEnvelope(
          exposedTool.id,
          mergedArgs,
          this.createToolContext()
        );
        if (this.isCancelled()) {
          return { ok: false, errorMessage: 'Agent run cancelled', cancelled: true };
        }
        if (envelope.error) {
          return {
            ok: false,
            errorMessage: envelope.error.message || `Tool ${exposedTool.name} execution failed`,
            envelope
          };
        }
        return { ok: true, result: envelope.result, envelope };
      }

      const identity = resolveMcpToolIdentity(tc.name, tools);
      if (!identity.toolDef || !identity.mcpServerId || !identity.originalName) {
        return { ok: false, errorMessage: `未找到工具定义: ${tc.name}` };
      }

      const mcpConfig = mcpConfigs.find((cfg) => cfg.id === identity.mcpServerId);
      if (this.isCancelled()) {
        return { ok: false, errorMessage: 'Agent run cancelled', cancelled: true };
      }
      const envelope = await executeMcpToolEnvelope({
        toolDef: identity.toolDef,
        mcpServerId: identity.mcpServerId,
        originalName: identity.originalName,
        arguments: tc.arguments,
        workspace: this.options.workspace?.workspace,
        workspacePolicy: this.options.workspace?.policy,
        signal: this.options.signal,
        call: (args, signal) =>
          mcpService.callToolWithTrace(
            mcpConfig || ({ id: identity.mcpServerId } as MCPServerConfig),
            identity.originalName!,
            args,
            signal
          )
      });
      if (this.isCancelled()) {
        return { ok: false, errorMessage: 'Agent run cancelled', cancelled: true };
      }
      if (envelope.error) {
        return {
          ok: false,
          errorMessage: envelope.error.message || `Tool ${identity.toolDef.name} execution failed`,
          envelope
        };
      }
      return { ok: true, result: envelope.result, envelope };
    } catch (error: unknown) {
      if (this.isCancellationError(error)) {
        return { ok: false, errorMessage: toolFailureMessage(error), cancelled: true };
      }
      return {
        ok: false,
        errorMessage: toolFailureMessage(error),
        envelope: getToolExecutionEnvelopeFromError(error)
      };
    }
  }

  private createToolContext(): Partial<ToolExecutionContext> | undefined {
    const workspace = this.options.workspace?.workspace;
    const workspacePolicy = this.options.workspace?.policy;
    const extras = this.options.toolContextExtras;
    const knowledgeScope = mergeKnowledgeScopes(
      mergeKnowledgeScopes(
        this.options.agentDef.knowledgeScope,
        legacyKnowledgeCategoryScope(this.options.agentDef.knowledgeCategoryIds)
      ),
      extras?.knowledgeScope
    );
    if (!workspace && !workspacePolicy && !extras && !this.options.signal && !knowledgeScope)
      return undefined;
    return {
      ...(extras || {}),
      ...(workspace ? { workspace } : {}),
      ...(workspacePolicy ? { workspacePolicy } : {}),
      ...(knowledgeScope ? { knowledgeScope } : {}),
      ...(this.options.signal ? { signal: this.options.signal } : {})
    };
  }

  private createObservation(
    tc: any,
    success: boolean,
    result: unknown,
    startedAt: number,
    error?: string,
    envelope?: ToolExecutionEnvelope
  ): AgentToolObservation {
    const identity = resolveMcpToolIdentity(tc.name, this.options.tools);
    const toolContext = isToolResultContextOutput(result) ? result : undefined;
    const errorPayload = success ? undefined : this.createToolErrorObservationPayload(error);
    const rawContent = success
      ? toolContext?.observationContent || toObservationContent(result)
      : JSON.stringify(errorPayload);
    const data = success ? toolContext?.data : errorPayload;
    const assessment = success
      ? assessToolObservationResult(data ?? result, { toolName: tc.name })
      : undefined;
    const observationSuccess = success && (assessment?.success ?? true);
    const content = assessment
      ? applyToolObservationAssessment(rawContent, assessment)
      : rawContent;

    const observation: AgentToolObservation = {
      toolCallId: tc.id,
      toolName: tc.name,
      success: observationSuccess,
      content,
      data,
      error: error ?? (observationSuccess ? undefined : assessment?.error),
      durationMs: envelope?.durationMs ?? Date.now() - startedAt,
      exposedName: identity.toolDef?.name || tc.name,
      originalName: identity.originalName,
      mcpServerId: identity.mcpServerId,
      artifactId: toolContext?.artifact?.artifactId,
      execution: envelope ? toolExecutionEnvelopeToTrace(envelope) : undefined
    };
    observation.canonicalMessageContent = toolContext
      ? this.createToolMessageContent(toolContext, observation)
      : content;
    return observation;
  }

  private async notifyToolObservation(
    observation: AgentToolObservation,
    round: number
  ): Promise<void> {
    observation.canonicalMessageContent ??= observation.content;
    await this.options.onToolObservation?.(observation, round);
  }

  private createToolMessageContent(
    toolContext: ToolResultContextOutput,
    observation: AgentToolObservation
  ): string {
    if (this.observationRequiresStructuredMessage(observation)) return observation.content;
    return toolContext.messageContent || observation.content;
  }

  private observationRequiresStructuredMessage(observation: AgentToolObservation): boolean {
    if (!observation.success || observation.error) return true;
    return (
      observation.content.includes('"reactObservation"') ||
      observation.content.includes('"instruction"')
    );
  }

  private createToolErrorObservationPayload(error?: string): Record<string, unknown> {
    const errorMessage = error || '工具调用失败';
    const normalized = errorMessage.toLowerCase();
    const status =
      errorMessage.includes('参数无效') || normalized.includes('invalid') ? 'invalid' : 'error';
    const instruction =
      status === 'invalid'
        ? '工具参数无效。不要原样重试同一工具/参数；请修正参数结构，或在缺少必要信息时向用户澄清。'
        : '工具调用失败。不要原样重试同一工具/参数；请根据错误调整路径、换参数，或向用户澄清缺失信息。';

    return {
      success: false,
      status,
      error: errorMessage,
      reactObservation: {
        success: false,
        status,
        error: errorMessage,
        instruction
      }
    };
  }

  private createUserDeniedObservationPayload(reason: string): Record<string, unknown> {
    const userReason = reason.trim() || '用户拒绝了此工具调用';
    return {
      success: false,
      status: 'user_denied',
      error: userReason,
      reactObservation: {
        success: false,
        status: 'user_denied',
        error: userReason,
        instruction: `用户拒绝了此工具调用。理由：${userReason}。请根据用户的反馈调整方案，不要原样重试同一工具/参数。`
      }
    };
  }

  private createUserInputObservationPayload(
    input: ReActRuntimeUserInputResumeInput['resolution']
  ): Record<string, unknown> {
    const skipped =
      input.input &&
      typeof input.input === 'object' &&
      !Array.isArray(input.input) &&
      (input.input as Record<string, unknown>).skipped === true;
    return {
      success: true,
      status: skipped ? 'skipped' : 'answered',
      input: input.input,
      reason: input.reason,
      requestId: input.requestId,
      reactObservation: {
        success: true,
        status: skipped ? 'skipped' : 'answered',
        input: input.input,
        instruction: skipped
          ? '用户跳过了此问题。请根据已有上下文继续，必要时换一种方式提问。'
          : '用户已回答问题。请根据回答继续执行后续步骤。'
      }
    };
  }

  private createUserInputObservation(
    tc: { id?: string; name: string },
    resolution: ReActRuntimeUserInputResumeInput['resolution'],
    startedAt: number
  ): AgentToolObservation {
    const identity = resolveMcpToolIdentity(tc.name, this.options.tools);
    const payload = this.createUserInputObservationPayload(resolution);
    const content = JSON.stringify(payload);
    return {
      toolCallId: tc.id,
      toolName: tc.name,
      success: true,
      content,
      data: payload,
      durationMs: Date.now() - startedAt,
      exposedName: identity.toolDef?.name || tc.name,
      originalName: identity.originalName,
      mcpServerId: identity.mcpServerId
    };
  }

  private createUserDeniedObservation(
    tc: { id?: string; name: string },
    reason: string,
    startedAt: number
  ): AgentToolObservation {
    const identity = resolveMcpToolIdentity(tc.name, this.options.tools);
    const errorPayload = this.createUserDeniedObservationPayload(reason);
    const content = JSON.stringify(errorPayload);
    return {
      toolCallId: tc.id,
      toolName: tc.name,
      success: false,
      content,
      data: errorPayload,
      error: errorPayload.error as string,
      durationMs: Date.now() - startedAt,
      exposedName: identity.toolDef?.name || tc.name,
      originalName: identity.originalName,
      mcpServerId: identity.mcpServerId
    };
  }

  private createObservationGuardObservation(
    tc: { id?: string; name: string },
    guard: ObservationGuardDecision
  ): AgentToolObservation {
    const identity = resolveMcpToolIdentity(tc.name, this.options.tools);
    const data = guard.data || {
      status: 'blocked',
      blocked: true,
      reason: guard.reason || 'repeated_tool_observation'
    };
    return {
      toolCallId: tc.id,
      toolName: tc.name,
      success: false,
      content: guard.content || JSON.stringify(data),
      data,
      error: guard.error || guard.reason || 'repeated_tool_observation',
      durationMs: 0,
      exposedName: identity.toolDef?.name || tc.name,
      originalName: identity.originalName,
      mcpServerId: identity.mcpServerId
    };
  }

  private toResult(
    finalContent: unknown,
    lastToolResult: unknown,
    trace: AgentRunTrace,
    stopReason: AgentExecutionResult['stopReason']
  ): AgentExecutionResult {
    const finalString = formatFinalContent(finalContent, lastToolResult);
    const failureFallback =
      !finalString.trim() && stopReason !== 'final' ? findLastFailedObservation(trace) : undefined;
    const content =
      finalString || (failureFallback ? formatToolFailureForUser(failureFallback) : '');
    if (!content.trim()) {
      LogService.error(
        `[Agent ${this.options.agentDef.name}] Failed to generate any content after ${trace.rounds.length} rounds.`
      );
    }

    const toolCalls = trace.rounds.flatMap((round) => round.toolCalls);
    return {
      content: content || 'No response generated (AI returned empty content)',
      toolCalls,
      data: lastToolResult,
      usage: trace.rounds.map((round) => round.usage).filter(Boolean),
      stopReason,
      trace: this.options.agentDef.runtime?.returnTrace === false ? undefined : trace
    };
  }

  private async buildModelMessages(
    messages: AIMessage[],
    roundIndex: number
  ): Promise<{
    messages: AIMessage[];
    systemInstruction?: string;
    providerTools?: ToolDefinition[];
    requestContext?: LlmRequestContext;
    classified?: ClassifiedModelInput;
    snapshot?: ContextUsageSnapshot;
  }> {
    const result = await this.contextBuilder.compactMessages(messages, {
      policy: this.options.context?.policy,
      summarizer: this.options.context?.summarizer,
      signal: this.options.signal
    });
    if (result.compacted) {
      this.contextBuilder.replaceMessagesInPlace(messages, result.messages);
      if (this.lastCompactionFingerprint !== result.fingerprint) {
        this.lastCompactionFingerprint = result.fingerprint;
        await this.options.context?.onContextCompacted?.(
          this.toCompactionRecord(result, messages.length)
        );
      }
    }

    const sessionContext = this.options.context?.sessionContext;
    const turnContext = this.options.context?.turnContext;
    const contextTransformer = this.options.context?.contextTransformer;

    if (sessionContext?.protocolVersion === PI_CONTEXT_PROTOCOL_VERSION) {
      if (!turnContext || !contextTransformer) {
        throw new Error('context_runtime_not_initialized');
      }

      const requestContext = contextTransformer.transform({
        session: {
          ...sessionContext,
          trajectory: structuredClone(messages)
        },
        turn: turnContext
      });
      const snapshot = await this.measureContextUsage(
        requestContext.messages,
        roundIndex,
        result.compacted,
        requestContext.systemInstruction
      );
      this.lastProviderRequestMessages = structuredClone(requestContext.messages);

      return {
        messages: requestContext.messages,
        systemInstruction: requestContext.systemInstruction,
        providerTools: requestContext.providerTools,
        requestContext,
        snapshot
      };
    }

    const modelMessages = result.compacted ? messages : result.messages;
    const snapshot = await this.measureContextUsage(modelMessages, roundIndex, result.compacted);
    this.lastProviderRequestMessages = structuredClone(modelMessages);
    return {
      messages: modelMessages,
      providerTools: this.options.providerTools ?? this.options.tools,
      classified: undefined,
      snapshot
    };
  }

  private toCompactionRecord(
    result: AgentContextCompactionResult,
    currentMessageCount: number
  ): ContextCompactionRecord {
    return {
      compacted: true,
      strategy: String(
        result.metadata?.strategy || 'hybrid'
      ) as ContextCompactionRecord['strategy'],
      beforeMessages: Number(result.metadata?.beforeMessages || currentMessageCount),
      afterMessages: Number(result.metadata?.afterMessages || result.messages.length),
      summary: result.summary,
      artifactIds: result.artifactIds || [],
      beforeTokens: readFiniteNumber(result.metadata?.beforeTokens),
      afterTokens: readFiniteNumber(result.metadata?.afterTokens),
      fingerprint: result.fingerprint,
      builderVersion: result.builderVersion,
      summarySource: result.summarySource,
      summarizedMessages: readFiniteNumber(result.metadata?.summarizedMessages),
      retainedMessages: readFiniteNumber(result.metadata?.retainedMessages)
    };
  }

  /**
   * Count tokens for the current message list and publish a context usage
   * snapshot. Extracted from buildModelMessages so it can also be invoked
   * after tool results land (between rounds) — the context grows as tool
   * outputs accumulate, and the UI needs that growth reflected in real time
   * rather than only at the next pre-call measurement.
   */
  private async measureContextUsage(
    messages: AIMessage[],
    roundIndex: number,
    compacted: boolean,
    systemInstruction?: string
  ): Promise<ContextUsageSnapshot | undefined> {
    if (!this.options.tokenCounter || !this.options.classifiedMessageBuilder) return undefined;
    const messagesForCounting =
      systemInstruction?.trim() && !messages.some((message) => message.role === 'system')
        ? [{ role: 'system' as const, content: systemInstruction }, ...messages]
        : messages;
    const classified = this.options.classifiedMessageBuilder.build(
      messagesForCounting,
      this.options.tools ?? [],
      this.collectMcpToolIds()
    );
    const breakdown = this.options.tokenCounter.count(classified);
    const snapshot = this.options.tokenCounter.toSnapshot(breakdown, {
      round: roundIndex,
      compacted,
      source: 'counter'
    });
    await this.options.onContextUsageMeasured?.(snapshot, roundIndex);
    return snapshot;
  }

  private collectMcpToolIds(): Set<string> {
    const ids = new Set<string>();
    for (const cfg of this.options.mcpConfigs ?? []) {
      const serverId =
        (cfg as { serverId?: string; id?: string; name?: string }).serverId ??
        (cfg as { id?: string }).id ??
        (cfg as { name?: string }).name ??
        '';
      if (serverId) {
        ids.add(`mcp_${serverId}`);
      }
    }
    return ids;
  }

  private async maybeOffloadModelOutput(content: string, round?: number): Promise<void> {
    if (!content.trim()) return;
    const modelContext = this.contextManager.offloadModelOutput({
      runId: this.options.context?.runId || this.options.permission?.runId || 'legacy',
      sessionId: this.options.context?.sessionId || this.options.permission?.sessionId || 'legacy',
      round,
      content,
      policy: this.options.context?.policy
    });
    if (modelContext.artifact) {
      await this.options.context?.onArtifactSaved?.(
        modelContext.artifact,
        modelContext.artifactContent
      );
    }
  }

  private async prepareToolResultContext(
    tc: any,
    result: unknown
  ): Promise<ToolResultContextOutput> {
    const toolContext = this.contextManager.offloadToolResult({
      runId: this.options.context?.runId || this.options.permission?.runId || 'legacy',
      sessionId: this.options.context?.sessionId || this.options.permission?.sessionId || 'legacy',
      toolName: tc.name,
      toolCallId: tc.id,
      result,
      policy: this.options.context?.policy
    });
    if (toolContext.artifact) {
      await this.options.context?.onArtifactSaved?.(
        toolContext.artifact,
        toolContext.artifactContent
      );
    }
    return toolContext;
  }

  private mergeAgentToolArguments(
    agentDef: AgentDefinition,
    toolName: string,
    args: Record<string, unknown> | unknown
  ): Record<string, unknown> {
    const merged: Record<string, unknown> =
      args && typeof args === 'object' && !Array.isArray(args)
        ? { ...(args as Record<string, unknown>) }
        : {};
    if (
      typeof args === 'string' &&
      (toolName === 'query_knowledge' || toolName === 'query_memory')
    ) {
      merged.query = args;
    }
    if (toolName === 'query_knowledge' || toolName === 'query_memory') {
      const key = toolName === 'query_knowledge' ? 'knowledgeCategoryIds' : 'memoryCategoryIds';
      const bound = agentDef[key];
      if (bound?.length && !merged.categoryIds) {
        merged.categoryIds = bound;
      }
    }
    if (toolName === 'save_knowledge' && !merged.categoryId) {
      const saveIds = agentDef.knowledgeSaveCategoryIds?.length
        ? agentDef.knowledgeSaveCategoryIds
        : agentDef.knowledgeCategoryIds;
      if (saveIds?.length) merged.categoryId = saveIds[0];
    }
    if (toolName === 'save_memory' && !merged.targetCategoryId) {
      const saveIds = agentDef.memorySaveCategoryIds?.length
        ? agentDef.memorySaveCategoryIds
        : agentDef.memoryCategoryIds;
      if (saveIds?.length) merged.targetCategoryId = saveIds[0];
    }
    return merged;
  }
}
