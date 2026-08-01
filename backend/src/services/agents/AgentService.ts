import { ToolRegistry } from '../../registries/ToolRegistry.js';
import type {
  AgentDefinition,
  AgentExecutionResult,
  AgentRunRound,
  MCPServerConfig,
  ToolDefinition,
  ToolExecutionCapability
} from '../../types/agent.js';
import type { AiBuildStreamEvent } from '../../types/aiBuilder.js';
import type { AIProviderConfig, SystemSettings } from '../../types/config.js';
import { AIMessage } from '../../types/index.js';
import type { AIProvider } from '../AIProvider.js';
import {
  createAIProvider,
  resolveEffectiveApiEndpoint
} from '../AIProvider.js';
import { LocalStore } from '../LocalStore.js';
import { LogService } from '../LogService.js';
import { KnowledgeRetrievalService } from '../rag/KnowledgeRetrievalService.js';
import { RagContextBuilder } from '../rag/RagContextBuilder.js';
import { legacyKnowledgeCategoryScope, mergeKnowledgeScopes } from '../rag/RagScope.js';
import type { ContextSummarizer } from './engine/ContextManager.js';
import type { ObservationPolicy } from './engine/ObservationPolicy.js';
import type {
  AgentBudgetPolicy,
  AgentMessage,
  AgentRunSource,
  AgentRunSpec
} from './engine/AgentRunSpec.js';
import type { AgentSession } from './engine/AgentSession.js';
import { LocalStoreAgentSessionStore } from './engine/AgentSessionStore.js';
import {
  InMemoryAgentRunEventChannel,
  PgAgentRunEventChannel,
  type AgentRunEventChannel
} from './engine/AgentRunEventChannel.js';
import type {
  PermissionDecision,
  PermissionEffect,
  PermissionPolicy
} from './engine/PermissionPolicy.js';
import type { AgentRunRegistry } from './engine/AgentRunRegistry.js';
import type { WorkspacePolicy } from './engine/WorkspacePolicy.js';
import {
  isReusableConversationRun,
  isSupersedeableApprovalRun,
  newConversationBlockedMessage
} from './conversationRunGuards.js';
import type { UserTurnMessageMetadata } from './userTurnPayload.js';
import { resolveTurnSkillIds } from './userTurnPayload.js';
import { applyWebSearchPolicy, resolveWebSearchPolicy } from './search/WebSearchPolicyResolver.js';
import type { WebSearchPolicy } from './search/types.js';
import { AgentUploadService } from './AgentUploadService.js';
import {
  buildRuntimeUserContent,
  collectUploadAllowlistFileIds,
  readUserTurnMetadata,
  READ_UPLOAD_TOOL_ID,
  resolveSupportsVision,
  runtimeMessagePlainText
} from './userTurnRuntime.js';
import { MCPService } from './MCPService.js';
import {
  createToolFailureSignature,
  getMaxRepeatedToolErrors,
  normalizeToolCall,
  shouldStopOnRepeatedToolError
} from './runtime/toolProtocol.js';
import type { ReActRuntimeContextHooks, ReActRuntimeOptions } from './runtime/ReActRuntime.js';
import type { ToolExecutionContext } from '../ToolExecutionContext.js';
import type {
  AgentEvent,
  AgentEventListener,
  AgentHitlAction,
  AgentHitlKind,
  AgentHitlRequest,
  AgentHitlResolution
} from './engine/AgentEvent.js';
import { mapAiBuilderStreamToAgentEvents } from './engine/AgentEventMapper.js';
import type { AgentMiddleware } from './engine/AgentMiddleware.js';
import { AgentSandboxPool } from './engine/AgentSandboxPool.js';
import type { ContextPolicy } from './engine/ContextPolicy.js';
import {
  TokenCounter,
  TokenEstimator,
  ClassifiedMessageBuilder,
  resolveContextProfile,
  TurnContextAssembler,
  type ModelContextProfile,
  type TurnContext,
  type TurnContextResolverInput
} from './context/index.js';
import { AgentContextBuilder } from './context/AgentContextBuilder.js';
import { createLLMSummarizer } from './engine/LLMSummarizer.js';
import { ReActAgentEngine } from './engine/ReActAgentEngine.js';
import {
  buildResponseCacheRequest,
  normalizeRuntimeMessageContent,
  pickRicherRuntimeHistory,
  resolvePinnedSessionEndpoint,
  resolveResponseCacheFromSessions,
  type ResponseCacheRequest
} from './engine/responseContextCache.js';
import {
  canonicalizeToolDefinitions,
  CANONICAL_MESSAGE_SERIALIZATION_VERSION,
  sortToolDefinitions
} from './engine/canonicalMessageSerializer.js';
import {
  buildPromptCacheContract,
  readPromptCacheContract,
  type PromptCacheContract,
  type PromptCachePolicy,
  type PromptCacheRuntimeMode
} from './engine/promptCacheContract.js';
import { resolvePromptCacheCapability } from './engine/promptCacheCapabilities.js';
import { applyMultiAgentPromptCachePolicy } from './engine/multiAgentPromptCache.js';
import {
  rehydratePersistedAgentMessage,
  rehydratePersistedMessages
} from './engine/runtimeHistoryRehydrator.js';
import { resolveWorkspacePolicyFromAgent } from './engine/WorkspacePolicyResolver.js';
import {
  AgentGovernanceManager,
  withResolvedProviderModel,
  type GovernanceProviderInput,
  type ProviderRuntimeOptions,
  type ResolvedAgentProvider
} from './managers/AgentGovernanceManager.js';
import { AgentRunManager } from './managers/AgentRunManager.js';
import {
  AgentRunQueueManager,
  type AgentRunQueueBackend,
  type AgentRunQueueJob
} from './managers/AgentRunQueueManager.js';
import { AgentRuntimeManager } from './managers/AgentRuntimeManager.js';
import { AgentSessionManager } from './managers/AgentSessionManager.js';
import {
  assembleSystemMessages,
  buildPromptPipelineContext,
  isCanUseFC,
  replaceMessageVariables,
  type AssembledMessages
} from './prompt/index.js';
import type { ProviderGovernanceLedger } from './providerGovernance.js';
import { createWorkspaceManagerForStore } from './sandbox/AgentSandboxRuntime.js';
import { SkillService } from './SkillService.js';
import type { AgentWorkspaceState } from './workspace/AgentWorkspaceState.js';

export interface AgentRunOptions {
  silent?: boolean;
  noTools?: boolean;
  noSkills?: boolean;
  runSource?: AgentRunSource;
  middleware?: AgentMiddleware[];
  metadata?: Record<string, unknown>;
  contextPolicy?: ContextPolicy;
  observationPolicy?: ObservationPolicy;
  permissionPolicy?: PermissionPolicy;
  workspacePolicy?: WorkspacePolicy;
  budgetPolicy?: AgentBudgetPolicy;
  signal?: AbortSignal;
  threadId?: string;
  sessionId?: string;
  toolContextExtras?: Partial<ToolExecutionContext>;
  onRunCreated?: (spec: AgentRunSpec) => void | Promise<void>;
  /**
   * Optional LLM summarizer for context compaction. When provided, the agent uses
   * LLM-generated summaries instead of heuristic truncation during hybrid compaction.
   */
  summarizer?: ContextSummarizer;
  /**
   * Optional conversation history after the system instruction. When provided,
   * the agent continues from these messages instead of starting from a single
   * user prompt string.
   */
  messages?: AIMessage[];
  attachments?: AgentRunSpec['input']['attachments'];
  userTurnMetadata?: UserTurnMessageMetadata;
  promptCachePolicy?: PromptCachePolicy;
  parentPromptCacheContract?: PromptCacheContract;
  promptCacheMode?: PromptCacheRuntimeMode;
}

type ResumeRuntimeContext = {
  runSpec: AgentRunSpec;
  provider: AIProvider;
  runtimeOptions: Omit<ReActRuntimeOptions, 'provider' | 'budgetPolicy' | 'observationPolicy'>;
};

function normalizePositiveInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : undefined;
}

type AgentRunRoundLike = Pick<AgentRunRound, 'budget'>;

type StreamToolCallAccumulator = {
  requestKey: string;
  id?: string;
  name?: string;
  arguments?: unknown;
};

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

function resolveAgentKnowledgeScope(
  agentDef: AgentDefinition,
  extras?: Partial<ToolExecutionContext>
): Partial<ToolExecutionContext> | undefined {
  const knowledgeScope = mergeKnowledgeScopes(
    mergeKnowledgeScopes(
      agentDef.knowledgeScope,
      legacyKnowledgeCategoryScope(agentDef.knowledgeCategoryIds)
    ),
    extras?.knowledgeScope
  );
  if (!knowledgeScope) return extras;
  return {
    ...(extras || {}),
    knowledgeScope
  };
}

function resolveUserTurnRuntimeExtras(
  agentDef: AgentDefinition,
  options: AgentRunOptions,
  extras?: Partial<ToolExecutionContext>
): Partial<ToolExecutionContext> | undefined {
  const fileIds = collectUploadAllowlistFileIds(options.userTurnMetadata?.fileList);
  const uploadAllowlist = fileIds.size > 0 ? { agentId: agentDef.id, fileIds } : undefined;
  const merged = resolveAgentKnowledgeScope(agentDef, extras);
  if (!uploadAllowlist && !merged) return undefined;
  return {
    ...(merged || {}),
    ...(uploadAllowlist ? { uploadAllowlist } : {})
  };
}

function mergeAgentRunToolExtras(
  runSpec: Pick<AgentRunSpec, 'sessionId' | 'runId'>,
  extras?: Partial<ToolExecutionContext>
): Partial<ToolExecutionContext> | undefined {
  const agentRun = { sessionId: runSpec.sessionId, runId: runSpec.runId };
  if (!extras) return { agentRun };
  return { ...extras, agentRun };
}

function resolveRuntimeToolExtras(
  runSpec: Pick<AgentRunSpec, 'sessionId' | 'runId'>,
  agentDef: AgentDefinition,
  options: AgentRunOptions,
  extras?: Partial<ToolExecutionContext>
): Partial<ToolExecutionContext> | undefined {
  const userTurnExtras = resolveUserTurnRuntimeExtras(agentDef, options, extras);
  const exposedSkillIds = resolveTurnSkillIds({
    agentSkillIds: agentDef.skillIds ?? [],
    userTurnMetadata: options.userTurnMetadata
  });
  const withSkills: Partial<ToolExecutionContext> | undefined =
    exposedSkillIds.length > 0 ? { ...(userTurnExtras ?? {}), exposedSkillIds } : userTurnExtras;
  return mergeAgentRunToolExtras(runSpec, withSkills);
}

const WORKSPACE_TOOL_IDS = [
  'execute_command',
  'read_workspace_file',
  'write_workspace_file',
  'edit_workspace_file',
  'list_dir',
  'glob',
  'grep'
] as const;

function isWorkspaceSystemTool(tool: { id: string }): boolean {
  return (WORKSPACE_TOOL_IDS as readonly string[]).includes(tool.id);
}

function ensureReadUploadTool(toolIds: Set<string>, options: AgentRunOptions): void {
  if ((options.userTurnMetadata?.fileList?.length ?? 0) > 0) {
    toolIds.add(READ_UPLOAD_TOOL_ID);
  }
}

/**
 * Console「工具与技能」开关 → agentDef.toolIds / skillIds，决定本轮暴露给大模型的工具列表。
 * 人类审批（PermissionEngine / HITL）与此独立：在已暴露工具实际执行时再拦截。
 */
function resolveAgentExposedToolIds(
  agentDef: AgentDefinition,
  options: Pick<AgentRunOptions, 'noTools' | 'userTurnMetadata'>
): Set<string> {
  const toolIds = new Set<string>();
  if (!options.noTools) {
    agentDef.toolIds?.forEach((id: string) => toolIds.add(id));
    ensureReadUploadTool(toolIds, options);
  }
  return toolIds;
}

function lookupAgentProviderType(
  agentDef: AgentDefinition,
  settings?: Partial<SystemSettings>
): string {
  const providers = settings?.AI_PROVIDERS || [];
  const providerId = String(agentDef.providerId || '').trim();
  const providerConfig = providerId
    ? providers.find((p) => p.id === providerId)
    : providers.find((p) => p.id === settings?.ACTIVE_AI_PROVIDER_ID) || providers[0];
  return providerConfig?.type ?? '';
}

function readExposedToolIdsFromSession(
  agentDef: AgentDefinition,
  session?: AgentSession
): string[] {
  const fromRun = session?.metadata?.exposedToolIds;
  if (Array.isArray(fromRun)) {
    return fromRun.filter((id): id is string => typeof id === 'string' && id.length > 0);
  }
  const agentSpec = session?.metadata?.agentSpec as { tools?: { toolIds?: string[] } } | undefined;
  const fromSpec = agentSpec?.tools?.toolIds;
  if (Array.isArray(fromSpec) && fromSpec.length > 0) {
    return fromSpec;
  }
  return [...(agentDef.toolIds ?? [])];
}

function resolveAgentRunWorkspacePolicy(
  agentDef: AgentDefinition,
  options: AgentRunOptions
): WorkspacePolicy | undefined {
  return resolveWorkspacePolicyFromAgent(agentDef, options.workspacePolicy);
}

function resolveAgentMaxConcurrentRuns(settings?: Partial<SystemSettings>): number | undefined {
  const value = settings?.AGENT_RUN_CONFIG?.maxConcurrentRuns;
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : undefined;
}

/**
 * Build the cross-process event channel. Uses PostgreSQL LISTEN/NOTIFY when a real DB
 * connection is available, otherwise an in-memory channel (single-process / tests).
 */
function resolveAgentRunEventChannel(store: LocalStore): AgentRunEventChannel {
  const conn =
    typeof (store as { getConnection?: () => unknown }).getConnection === 'function'
      ? (store as { getConnection: () => unknown }).getConnection()
      : null;
  if (conn) {
    return new PgAgentRunEventChannel(conn as any);
  }
  return new InMemoryAgentRunEventChannel();
}

/**
 * Bind the durable queue backend when the store exposes the agent_run_queue repository.
 * Returns undefined for test/mocked stores so the queue manager keeps its pure
 * in-process semaphore behavior.
 */
function resolveAgentRunQueueBackend(store: LocalStore): AgentRunQueueBackend | undefined {
  const repo = (store as { repositories?: { agentRunQueue?: unknown } }).repositories
    ?.agentRunQueue;
  if (!repo) return undefined;
  const queue = repo as {
    enqueue: (input: {
      runId: string;
      sessionId?: string;
      maxAttempts?: number;
      payload?: Record<string, unknown>;
    }) => Promise<void>;
    claim: (owner: string, limit: number) => Promise<AgentRunQueueJob[]>;
    claimRun: (runId: string, owner: string) => Promise<unknown>;
    heartbeat: (runId: string, owner: string) => Promise<boolean>;
    complete: (runId: string) => Promise<void>;
    requeueForResume: (runId: string) => Promise<void>;
    fail: (runId: string, error: string) => Promise<unknown>;
    cancel: (runId: string) => Promise<boolean>;
  };
  return {
    enqueue: (input) => queue.enqueue(input),
    claim: (owner: string, limit: number) => queue.claim(owner, limit),
    claimRun: (runId: string, owner: string) => queue.claimRun(runId, owner),
    heartbeat: (runId: string, owner: string) => queue.heartbeat(runId, owner),
    complete: (runId: string) => queue.complete(runId),
    requeueForResume: (runId: string) => queue.requeueForResume(runId),
    fail: (runId: string, error: string) => queue.fail(runId, error),
    cancel: (runId: string) => queue.cancel(runId)
  };
}

function createToolLimitObservation(params: {
  toolName: string;
  round: number;
  scope: 'run' | 'round';
  limit: number;
  current: number;
}) {
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
  return {
    toolName: params.toolName,
    success: false,
    content: JSON.stringify({
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
    }),
    data: {
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
    },
    error: summary,
    durationMs: 0
  };
}

export function buildRuntimeContextHooks(input: {
  runSpec: Pick<AgentRunSpec, 'runId' | 'sessionId' | 'contextPolicy'>;
  summarizer?: ContextSummarizer;
  turnContext?: TurnContext;
}): ReActRuntimeContextHooks {
  return {
    runId: input.runSpec.runId,
    sessionId: input.runSpec.sessionId,
    ...(input.runSpec.contextPolicy ? { policy: input.runSpec.contextPolicy } : {}),
    ...(input.summarizer ? { summarizer: input.summarizer } : {}),
    ...(input.turnContext ? { turnContext: input.turnContext } : {}),
  };
}

export function buildContextPolicyFromChatConfig(
  chatConfig: Record<string, unknown>,
  profile: ModelContextProfile
): ContextPolicy {
  const enableMaxContextWindow = chatConfig.enableMaxContextWindow === true;
  const maxContextWindowRaw = chatConfig.maxContextWindow;
  const maxContextWindow =
    enableMaxContextWindow && typeof maxContextWindowRaw === 'number' && maxContextWindowRaw > 0
      ? maxContextWindowRaw
      : profile.theoreticalMax;
  const enableHistoryCount = chatConfig.enableHistoryCount === true;
  const historyCountRaw = chatConfig.historyCount;
  const maxMessages =
    enableHistoryCount && typeof historyCountRaw === 'number' && historyCountRaw > 0
      ? historyCountRaw
      : 30;
  return {
    maxInputTokens: maxContextWindow,
    reserveOutputTokens: profile.maxOutput ?? 8192,
    compactionBuffer: Math.min(20000, Math.ceil(maxContextWindow * 0.1)),
    compactionStrategy: chatConfig.enableContextCompression === false ? 'none' : 'hybrid',
    maxMessages,
    summarizeOlderThanMessages: 24
  };
}

export function mergeAgentConsoleRuntimeMetadata(
  agentDef: AgentDefinition,
  metadata?: Record<string, unknown>
): AgentDefinition {
  const runtimeConsole = metadata?.agentConsole;
  if (!runtimeConsole || typeof runtimeConsole !== 'object') {
    if (!agentDef.metadata?.agentConsole) return agentDef;
    const { agentConsole: _removed, ...restMetadata } = agentDef.metadata ?? {};
    return {
      ...agentDef,
      metadata: Object.keys(restMetadata).length > 0 ? restMetadata : undefined
    };
  }

  const current = agentDef.metadata?.agentConsole;
  const currentObj =
    current && typeof current === 'object' ? (current as Record<string, unknown>) : {};
  const runtimeObj = runtimeConsole as Record<string, unknown>;
  const runtimeChat =
    runtimeObj.chatConfig && typeof runtimeObj.chatConfig === 'object'
      ? (runtimeObj.chatConfig as Record<string, unknown>)
      : {};
  const runtimeParams =
    runtimeObj.params && typeof runtimeObj.params === 'object'
      ? (runtimeObj.params as Record<string, unknown>)
      : {};
  const currentChat =
    currentObj.chatConfig && typeof currentObj.chatConfig === 'object'
      ? (currentObj.chatConfig as Record<string, unknown>)
      : {};
  const currentParams =
    currentObj.params && typeof currentObj.params === 'object'
      ? (currentObj.params as Record<string, unknown>)
      : {};

  return {
    ...agentDef,
    model:
      typeof runtimeObj.model === 'string' && runtimeObj.model.trim()
        ? runtimeObj.model.trim()
        : agentDef.model,
    providerId:
      typeof runtimeObj.provider === 'string' && runtimeObj.provider.trim()
        ? runtimeObj.provider.trim()
        : agentDef.providerId,
    metadata: {
      ...agentDef.metadata,
      agentConsole: {
        ...currentObj,
        ...runtimeObj,
        chatConfig: { ...currentChat, ...runtimeChat },
        params: { ...currentParams, ...runtimeParams }
      }
    }
  };
}

export class AgentService {
  private store: LocalStore;
  private aiProvider: AIProvider;
  private skillService: SkillService;
  private mcpService: MCPService;
  private toolRegistry: ToolRegistry;
  private agentEngine: ReActAgentEngine;
  private proxyAgent?: any;
  private runRegistry?: AgentRunRegistry;
  private runManager: AgentRunManager;
  private governanceManager: AgentGovernanceManager;
  private runtimeManager: AgentRuntimeManager;
  private sessionManager: AgentSessionManager;
  private readonly contextBuilder = new AgentContextBuilder();
  private eventChannel?: AgentRunEventChannel;

  constructor(
    store: LocalStore,
    aiProvider: AIProvider,
    skillService: SkillService,
    mcpService: MCPService,
    proxyAgent?: any,
    runRegistry?: AgentRunRegistry,
    settings?: Partial<SystemSettings>
  ) {
    this.store = store;
    this.aiProvider = aiProvider;
    this.skillService = skillService;
    this.mcpService = mcpService;
    this.toolRegistry = ToolRegistry.getInstance();
    this.runRegistry = runRegistry;
    this.eventChannel = resolveAgentRunEventChannel(store);
    const workspaceManager = createWorkspaceManagerForStore(store);
    this.agentEngine = new ReActAgentEngine(
      undefined,
      new LocalStoreAgentSessionStore(store),
      runRegistry,
      this.eventChannel,
      workspaceManager
    );
    this.proxyAgent = proxyAgent;
    this.runManager = new AgentRunManager();
    this.governanceManager = new AgentGovernanceManager(store, aiProvider, proxyAgent);
    this.runtimeManager = new AgentRuntimeManager(
      this.agentEngine,
      new AgentRunQueueManager({
        maxConcurrentRuns: resolveAgentMaxConcurrentRuns(settings),
        backend: resolveAgentRunQueueBackend(store)
      })
    );
    this.sessionManager = new AgentSessionManager();
  }

  private createAgentRunSpec(params: {
    agentDef: AgentDefinition;
    input: string;
    messages: AIMessage[];
    attachments?: AgentRunSpec['input']['attachments'];
    tools: ToolDefinition[];
    mcpConfigs: MCPServerConfig[];
    skillInstructions: string[];
    date?: string;
    source?: AgentRunSource;
    metadata?: Record<string, unknown>;
    contextPolicy?: ContextPolicy;
    observationPolicy?: ObservationPolicy;
    permissionPolicy?: PermissionPolicy;
    workspacePolicy?: WorkspacePolicy;
    budgetPolicy?: AgentBudgetPolicy;
    threadId?: string;
    sessionId?: string;
    userTurnMetadata?: UserTurnMessageMetadata;
  }): AgentRunSpec {
    return this.runManager.createSpec(params);
  }

  private async resolveProviderForAgent(
    agentDef: AgentDefinition,
    silent?: boolean,
    settingsInput?: Partial<SystemSettings>,
    runtimeOptions?: ProviderRuntimeOptions,
    sessionId?: string
  ): Promise<ResolvedAgentProvider> {
    const resolved = await this.governanceManager.resolveProviderForAgent(
      agentDef,
      silent,
      settingsInput,
      runtimeOptions
    );
    return this.applySessionEndpointAffinity(resolved, agentDef, sessionId);
  }

  /** Prefer a previously successful endpoint for the same session cache route. */
  private async applySessionEndpointAffinity(
    resolved: ResolvedAgentProvider,
    agentDef: AgentDefinition,
    sessionId?: string
  ): Promise<ResolvedAgentProvider> {
    const normalizedSessionId = normalizeRuntimeId(sessionId);
    if (!normalizedSessionId || !resolved.providerConfig) return resolved;

    const configured = resolved.providerConfig.apiEndpoint;
    if (configured && configured !== 'auto') return resolved;

    const model = String(resolved.model ?? agentDef.model ?? '').trim();
    const providerId = String(resolved.providerConfig.id ?? agentDef.providerId ?? '').trim();
    if (!model || !providerId) return resolved;

    const sessions = await this.getSessionRuns(normalizedSessionId);
    const pinned = resolvePinnedSessionEndpoint(sessions, model, providerId);
    if (!pinned) return resolved;

    const provider =
      createAIProvider(
        {
          ...resolved.providerConfig,
          model,
          apiEndpoint: pinned as AIProviderConfig['apiEndpoint'],
          reasoningEffort: (resolved.providerConfig as { reasoningEffort?: string }).reasoningEffort
        },
        resolved.providerConfig.useProxy === true ? this.proxyAgent : undefined
      ) || resolved.provider;

    return {
      provider,
      providerConfig: {
        ...resolved.providerConfig,
        apiEndpoint: pinned as AIProviderConfig['apiEndpoint']
      },
      model: resolved.model
    };
  }

  private createGovernedProvider(input: GovernanceProviderInput): AIProvider {
    return this.governanceManager.createGovernedProvider(input);
  }

  async runAgent(
    agentId: string,
    input: string,
    date?: string,
    options: AgentRunOptions = {}
  ): Promise<AgentExecutionResult> {
    const agentDefRaw = await this.store.getAgent(agentId);
    if (!agentDefRaw) throw new Error(`Agent ${agentId} not found`);
    let agentDef = mergeAgentConsoleRuntimeMetadata(agentDefRaw, options.metadata);

    if (!options.silent) {
      LogService.info(`Running agent: ${agentDef.name}${date ? ` for date: ${date}` : ''}`);
    }

    const settings = await this.store.get('system_settings');

    const { policy: webSearchPolicy, toolIdSet } = this.resolveWebSearchRunContext(
      agentDef,
      options,
      settings
    );

    // 0. Resolve AI Provider from agent's own config
    const resolvedProvider = await this.resolveProviderForAgent(
      agentDef,
      options.silent,
      settings,
      { builtinSearch: webSearchPolicy.enableProviderBuiltinSearch ? 'full' : 'off' },
      options.sessionId
    );
    agentDef = withResolvedProviderModel(agentDef, resolvedProvider.model);

    // 1. Prepare Skills (metadata only; full content via read_skill)
    const turnSkillMetadata = this.buildTurnSkillMetadata(agentDef, options, input);

    // 2. Prepare Tools — agentDef.toolIds (+ read_upload when attachments), adjusted by web search policy.
    const tools = await this.materializeAgentLocalTools(toolIdSet);

    // 2.1 Prepare MCP Tools
    const mcpConfigs: MCPServerConfig[] = [];
    if (!options.noTools && agentDef.mcpServerIds && agentDef.mcpServerIds.length > 0) {
      for (const id of agentDef.mcpServerIds) {
        const config = await this.store.getMCPConfig(id);
        if (config) {
          mcpConfigs.push(config);
        }
      }
    }

    const mcpTools = options.noTools ? [] : await this.mcpService.getTools(mcpConfigs);
    const combinedTools = sortToolDefinitions([...tools, ...mcpTools]);

    // useNativeFC gate:!FC 时不向 provider 传 tools 数组,只靠 ToolSystemProvider 的 XML 注入,
    // 避免双重工具描述(系统 XML + provider bindTools)。工具仍注册到 runSpec 供 toolRegistry 执行。
    const useNativeFC = isCanUseFC(resolvedProvider.providerConfig?.type ?? '', agentDef.model);
    const providerTools = useNativeFC ? combinedTools : [];

    // 3. Construct System Message via PromptPipeline
    const turnId = this.runManager.createRuntimeId(agentDef.id, 'run');
    const turnContext = await this.assembleTurnContext({
      turnId,
      agentDef,
      userInput: input,
      sessionId: options.sessionId,
      metadata: options.metadata,
      settings,
      date,
      webSearchPolicy
    });
    const variables: Record<string, string> = {
      agentId: agentDef.id,
      agentName: agentDef.name
    };
    if (options.sessionId) variables.sessionId = options.sessionId;
    if (date) variables.date = date;
    const promptCtx = buildPromptPipelineContext({
      agentDef,
      providerId: resolvedProvider.providerConfig?.type ?? '',
      providerConfig: resolvedProvider.providerConfig,
      model: resolvedProvider.model ?? agentDef.model,
      tools,
      skills: [],
      mcpTools,
      skillMetadata: turnSkillMetadata,
      variables,
    });
    const assembled = assembleSystemMessages(promptCtx);
    const systemInstruction = assembled.systemMessage.content;

    if (!options.silent) {
      LogService.info(
        `[Agent ${agentDef.name}] System Instruction: ${systemInstruction.slice(0, 500)}...`
      );
    }

    // 4. Execution Loop (Maintain message history to avoid repeated tool calls)
    const messages = await this.buildRunMessages({
      input,
      assembled,
      options,
      agentDef,
      providerConfig: resolvedProvider.providerConfig,
      variables
    });
    const cacheContract = await this.buildPromptCacheContractForRun(
      options,
      agentDef,
      resolvedProvider.providerConfig,
      resolvedProvider.provider,
      resolvedProvider.model,
      assembled,
      combinedTools
    );
    const responseCache = await this.resolveResponseCacheForRun(
      options,
      agentDef,
      messages,
      cacheContract
    );
    const workspacePolicy = resolveAgentRunWorkspacePolicy(agentDef, options);

    const resolvedContextPolicy =
      options.contextPolicy ??
      this.resolveContextPolicyFromAgentDef(agentDef, resolvedProvider.providerConfig?.type ?? '');

    const runSpec = this.createAgentRunSpec({
      agentDef,
      input,
      messages,
      attachments: options.attachments,
      tools: combinedTools,
      mcpConfigs,
      skillInstructions: [],
      date,
      source: options.runSource,
      contextPolicy: resolvedContextPolicy,
      observationPolicy: options.observationPolicy,
      permissionPolicy: options.permissionPolicy,
      workspacePolicy,
      budgetPolicy: options.budgetPolicy,
      threadId: options.threadId,
      sessionId: options.sessionId,
      userTurnMetadata: options.userTurnMetadata,
      metadata: {
        streaming: false,
        noTools: !!options.noTools,
        noSkills: !!options.noSkills,
        agentId: agentDef.id,
        promptCacheContract: cacheContract,
        ...(workspacePolicy ? { workspacePolicy } : {}),
        ...(options.metadata ?? {})
      }
    });
    await this.agentEngine.prepareRun(runSpec);
    await options.onRunCreated?.(runSpec);

    const provider = this.createGovernedProvider({
      ...resolvedProvider,
      agentDef,
      runSpec,
      budgetPolicy: runSpec.budgetPolicy,
      settings
    });

    const summarizer = options.summarizer ?? createLLMSummarizer({ provider });

    return this.runtimeManager.run({
      runSpec,
      provider,
      runtimeOptions: {
        agentDef,
        tools: combinedTools,
        providerTools,
        mcpConfigs,
        mcpService: this.mcpService,
        toolRegistry: this.toolRegistry,
        messages,
        responseCache,
        silent: options.silent,
        context: buildRuntimeContextHooks({ runSpec, summarizer, turnContext }),
        toolContextExtras: resolveRuntimeToolExtras(
          runSpec,
          agentDef,
          options,
          options.toolContextExtras
        ),
        tokenCounter: this.resolveTokenCounterForAgent(
          agentDef,
          resolvedProvider.providerConfig?.type ?? ''
        ),
        classifiedMessageBuilder: new ClassifiedMessageBuilder()
      },
      middleware: options.middleware,
      signal: options.signal,
      metadata: {
        agentId: agentDef.id,
        ...(options.metadata ?? {})
      }
    });
  }

  async *streamAgent(
    agentId: string,
    input: string,
    date?: string,
    options: AgentRunOptions = {}
  ): AsyncIterable<any> {
    const agentDefRaw = await this.store.getAgent(agentId);
    if (!agentDefRaw) throw new Error(`Agent ${agentId} not found`);
    let agentDef = mergeAgentConsoleRuntimeMetadata(agentDefRaw, options.metadata);

    if (!options.silent) {
      LogService.info(`Streaming agent: ${agentDef.name}${date ? ` for date: ${date}` : ''}`);
    }

    const settings = await this.store.get('system_settings');

    const { policy: webSearchPolicy, toolIdSet } = this.resolveWebSearchRunContext(
      agentDef,
      options,
      settings
    );

    const resolvedProvider = await this.resolveProviderForAgent(
      agentDef,
      options.silent,
      settings,
      { builtinSearch: webSearchPolicy.enableProviderBuiltinSearch ? 'full' : 'off' },
      options.sessionId
    );
    agentDef = withResolvedProviderModel(agentDef, resolvedProvider.model);

    const turnSkillMetadata = this.buildTurnSkillMetadata(agentDef, options, input);
    const tools = await this.materializeAgentLocalTools(toolIdSet);

    const mcpConfigs: MCPServerConfig[] = [];
    if (!options.noTools && agentDef.mcpServerIds && agentDef.mcpServerIds.length > 0) {
      for (const id of agentDef.mcpServerIds) {
        const config = await this.store.getMCPConfig(id);
        if (config) mcpConfigs.push(config);
      }
    }
    const mcpTools = options.noTools ? [] : await this.mcpService.getTools(mcpConfigs);
    const combinedTools = sortToolDefinitions([...tools, ...mcpTools]);

    // useNativeFC gate(同 runAgent):!FC 时不向 provider 传 tools,避免双重工具描述。
    const useNativeFC = isCanUseFC(resolvedProvider.providerConfig?.type ?? '', agentDef.model);
    const providerTools = useNativeFC ? combinedTools : [];

    // Construct System Message via PromptPipeline
    const turnId = this.runManager.createRuntimeId(agentDef.id, 'run');
    const turnContext = await this.assembleTurnContext({
      turnId,
      agentDef,
      userInput: input,
      sessionId: options.sessionId,
      metadata: options.metadata,
      settings,
      date,
      webSearchPolicy
    });
    const variables: Record<string, string> = {
      agentId: agentDef.id,
      agentName: agentDef.name
    };
    if (options.sessionId) variables.sessionId = options.sessionId;
    if (date) variables.date = date;
    const promptCtx = buildPromptPipelineContext({
      agentDef,
      providerId: resolvedProvider.providerConfig?.type ?? '',
      providerConfig: resolvedProvider.providerConfig,
      model: resolvedProvider.model ?? agentDef.model,
      tools,
      skills: [],
      mcpTools,
      skillMetadata: turnSkillMetadata,
      variables,
    });
    const assembled = assembleSystemMessages(promptCtx);

    const messages = await this.buildRunMessages({
      input,
      assembled,
      options,
      agentDef,
      providerConfig: resolvedProvider.providerConfig,
      variables
    });
    const cacheContract = await this.buildPromptCacheContractForRun(
      options,
      agentDef,
      resolvedProvider.providerConfig,
      resolvedProvider.provider,
      resolvedProvider.model,
      assembled,
      combinedTools
    );
    const responseCache = await this.resolveResponseCacheForRun(
      options,
      agentDef,
      messages,
      cacheContract
    );
    const workspacePolicy = resolveAgentRunWorkspacePolicy(agentDef, options);

    const resolvedContextPolicy =
      options.contextPolicy ??
      this.resolveContextPolicyFromAgentDef(agentDef, resolvedProvider.providerConfig?.type ?? '');

    const runSpec = this.createAgentRunSpec({
      agentDef,
      input,
      messages,
      attachments: options.attachments,
      tools: combinedTools,
      mcpConfigs,
      skillInstructions: [],
      date,
      source: options.runSource,
      contextPolicy: resolvedContextPolicy,
      observationPolicy: options.observationPolicy,
      permissionPolicy: options.permissionPolicy,
      workspacePolicy,
      budgetPolicy: options.budgetPolicy,
      threadId: options.threadId,
      sessionId: options.sessionId,
      userTurnMetadata: options.userTurnMetadata,
      metadata: {
        streaming: true,
        noTools: !!options.noTools,
        noSkills: !!options.noSkills,
        agentId: agentDef.id,
        promptCacheContract: cacheContract,
        ...(workspacePolicy ? { workspacePolicy } : {}),
        ...(options.metadata ?? {})
      }
    });
    await this.agentEngine.prepareRun(runSpec);
    await options.onRunCreated?.(runSpec);

    const provider = this.createGovernedProvider({
      ...resolvedProvider,
      agentDef,
      runSpec,
      budgetPolicy: runSpec.budgetPolicy,
      settings
    });
    if (!provider.streamContent) {
      throw new Error(`Provider ${provider.name} does not support streaming`);
    }

    const summarizer = options.summarizer ?? createLLMSummarizer({ provider });

    yield* this.runtimeManager.stream({
      runSpec,
      provider,
      runtimeOptions: {
        agentDef,
        tools: combinedTools,
        providerTools,
        mcpConfigs,
        mcpService: this.mcpService,
        toolRegistry: this.toolRegistry,
        messages: messages.map((message) => ({ ...message })),
        responseCache,
        silent: options.silent,
        context: buildRuntimeContextHooks({ runSpec, summarizer, turnContext }),
        toolContextExtras: resolveRuntimeToolExtras(
          runSpec,
          agentDef,
          options,
          options.toolContextExtras
        ),
        tokenCounter: this.resolveTokenCounterForAgent(
          agentDef,
          resolvedProvider.providerConfig?.type ?? ''
        ),
        classifiedMessageBuilder: new ClassifiedMessageBuilder()
      },
      middleware: options.middleware,
      signal: options.signal,
      metadata: {
        agentId: agentDef.id,
        ...(options.metadata ?? {})
      }
    });
  }

  async runTemporaryAgent(params: {
    agentDef: AgentDefinition;
    messages: AIMessage[];
    tools?: ToolDefinition[];
    mcpConfigs?: MCPServerConfig[];
    provider?: AIProvider;
    runSource?: AgentRunSource;
    metadata?: Record<string, unknown>;
    contextPolicy?: ContextPolicy;
    observationPolicy?: ObservationPolicy;
    permissionPolicy?: PermissionPolicy;
    workspacePolicy?: WorkspacePolicy;
    budgetPolicy?: AgentBudgetPolicy;
    signal?: AbortSignal;
    toolContextExtras?: Partial<ToolExecutionContext>;
    middleware?: AgentMiddleware[];
    onRunCreated?: (spec: AgentRunSpec) => void | Promise<void>;
    threadId?: string;
    sessionId?: string;
    silent?: boolean;
    summarizer?: ContextSummarizer;
    promptCachePolicy?: PromptCachePolicy;
    parentPromptCacheContract?: PromptCacheContract;
    promptCacheMode?: PromptCacheRuntimeMode;
  }): Promise<AgentExecutionResult> {
    const tools = params.tools ?? [];
    const mcpConfigs = params.mcpConfigs ?? [];
    const settings = await this.store.get('system_settings');
    const resolvedProvider = params.provider
      ? { provider: params.provider, model: params.agentDef.model, providerConfig: undefined }
      : await this.resolveProviderForAgent(
          params.agentDef,
          params.silent,
          settings,
          undefined,
          params.sessionId
        );
    const agentDef = withResolvedProviderModel(params.agentDef, resolvedProvider.model);
    const cacheOptions: AgentRunOptions = {
      sessionId: params.sessionId,
      promptCachePolicy: params.promptCachePolicy,
      parentPromptCacheContract: params.parentPromptCacheContract,
      promptCacheMode: params.promptCacheMode,
      metadata: params.metadata
    };
    const cacheContract = await this.buildPromptCacheContractForMessages(
      cacheOptions,
      agentDef,
      resolvedProvider.providerConfig,
      resolvedProvider.provider,
      resolvedProvider.model,
      params.messages,
      tools
    );
    const responseCache = await this.resolveResponseCacheForRun(
      cacheOptions,
      agentDef,
      params.messages,
      cacheContract
    );

    const runSpec = this.createAgentRunSpec({
      agentDef,
      input: runtimeMessagePlainText(params.messages.find((m) => m.role === 'user')?.content ?? ''),
      messages: params.messages,
      tools,
      mcpConfigs,
      skillInstructions: [],
      source: params.runSource ?? 'builder',
      contextPolicy: params.contextPolicy,
      observationPolicy: params.observationPolicy,
      permissionPolicy: params.permissionPolicy,
      workspacePolicy: params.workspacePolicy,
      budgetPolicy: params.budgetPolicy,
      threadId: params.threadId,
      sessionId: params.sessionId,
      metadata: {
        streaming: false,
        noTools: tools.length === 0,
        noSkills: true,
        temporaryAgent: true,
        promptCacheContract: cacheContract,
        ...params.metadata
      }
    });
    await this.agentEngine.prepareRun(runSpec);
    await params.onRunCreated?.(runSpec);

    const provider = this.createGovernedProvider({
      ...resolvedProvider,
      agentDef,
      runSpec,
      budgetPolicy: runSpec.budgetPolicy,
      settings
    });

    const summarizer = params.summarizer ?? createLLMSummarizer({ provider });

    return this.runtimeManager.run({
      runSpec,
      provider,
      runtimeOptions: {
        agentDef,
        tools,
        mcpConfigs,
        mcpService: this.mcpService,
        toolRegistry: this.toolRegistry,
        messages: this.contextBuilder.snapshotFromMessages(params.messages).messages,
        responseCache,
        silent: params.silent,
        context: buildRuntimeContextHooks({ runSpec, summarizer }),
        toolContextExtras: mergeAgentRunToolExtras(
          runSpec,
          resolveAgentKnowledgeScope(agentDef, params.toolContextExtras)
        )
      },
      middleware: params.middleware,
      signal: params.signal,
      metadata: params.metadata
    });
  }

  async *streamTemporaryAgent(params: {
    agentDef: AgentDefinition;
    messages: AIMessage[];
    tools: ToolDefinition[];
    mcpConfigs?: MCPServerConfig[];
    provider?: AIProvider;
    runSource?: AgentRunSource;
    metadata?: Record<string, unknown>;
    contextPolicy?: ContextPolicy;
    observationPolicy?: ObservationPolicy;
    permissionPolicy?: PermissionPolicy;
    workspacePolicy?: WorkspacePolicy;
    budgetPolicy?: AgentBudgetPolicy;
    signal?: AbortSignal;
    toolContextExtras?: Partial<ToolExecutionContext>;
    middleware?: AgentMiddleware[];
    onRunCreated?: (spec: AgentRunSpec) => void | Promise<void>;
    threadId?: string;
    sessionId?: string;
    summarizer?: ContextSummarizer;
    promptCachePolicy?: PromptCachePolicy;
    parentPromptCacheContract?: PromptCacheContract;
    promptCacheMode?: PromptCacheRuntimeMode;
  }): AsyncIterable<any> {
    const tools = params.tools ?? [];
    const mcpConfigs = params.mcpConfigs ?? [];
    const settings = await this.store.get('system_settings');
    const resolvedProvider = params.provider
      ? { provider: params.provider, model: params.agentDef.model, providerConfig: undefined }
      : await this.resolveProviderForAgent(
          params.agentDef,
          undefined,
          settings,
          undefined,
          params.sessionId
        );
    const agentDef = withResolvedProviderModel(params.agentDef, resolvedProvider.model);
    const cacheOptions: AgentRunOptions = {
      sessionId: params.sessionId,
      promptCachePolicy: params.promptCachePolicy,
      parentPromptCacheContract: params.parentPromptCacheContract,
      promptCacheMode: params.promptCacheMode,
      metadata: params.metadata
    };
    const cacheContract = await this.buildPromptCacheContractForMessages(
      cacheOptions,
      agentDef,
      resolvedProvider.providerConfig,
      resolvedProvider.provider,
      resolvedProvider.model,
      params.messages,
      tools
    );
    const responseCache = await this.resolveResponseCacheForRun(
      cacheOptions,
      agentDef,
      params.messages,
      cacheContract
    );

    const runSpec = this.createAgentRunSpec({
      agentDef,
      input: runtimeMessagePlainText(params.messages.find((m) => m.role === 'user')?.content ?? ''),
      messages: params.messages,
      tools,
      mcpConfigs,
      skillInstructions: [],
      source: params.runSource ?? 'builder',
      contextPolicy: params.contextPolicy,
      observationPolicy: params.observationPolicy,
      permissionPolicy: params.permissionPolicy,
      workspacePolicy: params.workspacePolicy,
      budgetPolicy: params.budgetPolicy,
      threadId: params.threadId,
      sessionId: params.sessionId,
      metadata: {
        streaming: true,
        noTools: tools.length === 0,
        noSkills: true,
        temporaryAgent: true,
        promptCacheContract: cacheContract,
        ...params.metadata
      }
    });
    await this.agentEngine.prepareRun(runSpec);
    await params.onRunCreated?.(runSpec);

    const provider = this.createGovernedProvider({
      ...resolvedProvider,
      agentDef,
      runSpec,
      budgetPolicy: runSpec.budgetPolicy,
      settings
    });
    if (!provider.streamContent) {
      throw new Error(`Provider ${provider.name} does not support streaming`);
    }

    const summarizer = params.summarizer ?? createLLMSummarizer({ provider });

    yield* this.runtimeManager.stream({
      runSpec,
      provider,
      runtimeOptions: {
        agentDef,
        tools,
        mcpConfigs,
        mcpService: this.mcpService,
        toolRegistry: this.toolRegistry,
        messages: this.contextBuilder.snapshotFromMessages(params.messages).messages,
        responseCache,
        context: buildRuntimeContextHooks({ runSpec, summarizer }),
        toolContextExtras: mergeAgentRunToolExtras(
          runSpec,
          resolveAgentKnowledgeScope(agentDef, params.toolContextExtras)
        )
      },
      middleware: params.middleware,
      signal: params.signal,
      metadata: params.metadata
    });
  }

  private async *streamAgentCore(params: {
    agentDef: AgentDefinition;
    provider: AIProvider;
    messages: AIMessage[];
    combinedTools: ToolDefinition[];
    mcpConfigs: MCPServerConfig[];
    toolContextExtras?: Partial<ToolExecutionContext>;
  }): AsyncIterable<any> {
    const { agentDef, provider, messages, combinedTools, mcpConfigs } = params;
    let rounds = 0;
    const configuredMaxRounds = agentDef.runtime?.maxRounds;
    const maxRounds =
      typeof configuredMaxRounds === 'number' &&
      Number.isFinite(configuredMaxRounds) &&
      configuredMaxRounds > 0
        ? Math.floor(configuredMaxRounds)
        : 5;
    const toolFailureCounts = new Map<string, number>();
    const maxRepeatedToolErrors = getMaxRepeatedToolErrors(agentDef);
    const stopOnRepeatedToolError = shouldStopOnRepeatedToolError(agentDef);
    const maxToolCalls = normalizePositiveInteger(agentDef.runtime?.maxToolCalls);
    const maxToolCallsPerRound = normalizePositiveInteger(agentDef.runtime?.maxToolCallsPerRound);
    let acceptedToolCallCount = 0;

    while (rounds < maxRounds) {
      yield { type: 'round_start', round: rounds + 1 };

      const stream = provider.streamContent!(messages, combinedTools);
      let roundContent = '';
      const toolCallState = new Map<string, StreamToolCallAccumulator>();

      try {
        for await (const chunk of stream) {
          if (chunk.content) {
            roundContent += chunk.content;
            yield { type: 'content', content: chunk.content };
          }
          if (chunk.tool_calls) {
            const deltaToolCalls = chunk.tool_calls.map((tc, index) => {
              const requestKey = toolCallStreamKey(tc, index, toolCallState);
              const existing = toolCallState.get(requestKey) || { requestKey };
              toolCallState.set(requestKey, mergeStreamToolCall(existing, tc));
              return { ...tc, requestKey };
            });
            yield { type: 'tool_calls_delta', round: rounds + 1, tool_calls: deltaToolCalls };
          }
        }
      } catch (error: any) {
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

      let tool_calls = compactStreamToolCalls(toolCallState).map((tc) => {
        const normalized = normalizeToolCall(tc, 'stream');
        const stableId = normalized.id || `stream_${tc.requestKey.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
        return {
          ...normalized,
          id: stableId,
          requestKey: tc.requestKey
        };
      });

      const scheduledToolCalls: Array<{
        toolCall: (typeof tool_calls)[number];
        observation?: ReturnType<typeof createToolLimitObservation> & { toolCallId?: string };
      }> = [];
      let acceptedToolCallsThisRound = 0;
      for (const toolCall of tool_calls) {
        const runLimitHit =
          typeof maxToolCalls === 'number' && acceptedToolCallCount >= maxToolCalls;
        const roundLimitHit =
          typeof maxToolCallsPerRound === 'number' &&
          acceptedToolCallsThisRound >= maxToolCallsPerRound;
        if (runLimitHit || roundLimitHit) {
          const scope = runLimitHit ? 'run' : 'round';
          const limit = runLimitHit ? maxToolCalls : maxToolCallsPerRound;
          const current = runLimitHit ? acceptedToolCallCount : acceptedToolCallsThisRound;
          scheduledToolCalls.push({
            toolCall,
            observation: {
              ...createToolLimitObservation({
                toolName: toolCall.name,
                round: rounds + 1,
                scope,
                limit: limit || current,
                current
              }),
              toolCallId: toolCall.id
            }
          });
          continue;
        }
        acceptedToolCallCount += 1;
        acceptedToolCallsThisRound += 1;
        scheduledToolCalls.push({ toolCall });
      }
      tool_calls = scheduledToolCalls
        .filter((item) => !item.observation)
        .map((item) => item.toolCall);

      messages.push({
        role: 'assistant',
        content: roundContent || null,
        tool_calls:
          scheduledToolCalls.length > 0
            ? scheduledToolCalls.map((item) => item.toolCall)
            : undefined
      });

      if (scheduledToolCalls.length > 0) {
        if (tool_calls.length > 0) {
          yield { type: 'tool_calls', round: rounds + 1, tool_calls };
        }
        yield {
          type: 'trace_round',
          round: rounds + 1,
          assistantContent: roundContent,
          toolCalls: tool_calls
        };
        for (const scheduled of scheduledToolCalls) {
          const tc = scheduled.toolCall;
          if (scheduled.observation) {
            messages.push({
              role: 'tool',
              tool_call_id: tc.id,
              name: tc.name,
              content: scheduled.observation.content
            });
            yield {
              type: 'trace_observation',
              round: rounds + 1,
              observation: scheduled.observation
            };
            continue;
          }
          const startedAt = Date.now();
          try {
            yield { type: 'tool_start', tool: tc.name, args: tc.arguments };
            let result: any;
            const localTool = this.toolRegistry.getTool(tc.name);
            if (localTool) {
              const mergedArgs = this.mergeAgentToolArguments(agentDef, tc.name, tc.arguments);
              result = await this.toolRegistry.callTool(
                tc.name,
                mergedArgs,
                params.toolContextExtras
              );
            } else {
              const toolDef = combinedTools.find((t) => t.name === tc.name);
              if (toolDef) {
                const [configId, ...nameParts] = toolDef.id.split(':');
                const originalToolName = nameParts.join(':');
                const mcpConfig = mcpConfigs.find((cfg) => cfg.id === configId);
                result = await this.mcpService.callTool(
                  mcpConfig || ({ id: configId } as any),
                  originalToolName,
                  tc.arguments,
                  params.toolContextExtras?.signal
                );
              } else {
                throw new Error(`Tool not found: ${tc.name}`);
              }
            }
            const content = typeof result === 'string' ? result : JSON.stringify(result);
            messages.push({ role: 'tool', tool_call_id: tc.id, name: tc.name, content });
            yield { type: 'tool_result', tool: tc.name, result };
            yield {
              type: 'trace_observation',
              round: rounds + 1,
              observation: {
                toolCallId: tc.id,
                toolName: tc.name,
                success: true,
                content,
                data: result,
                durationMs: Date.now() - startedAt
              }
            };
          } catch (error: any) {
            const errorContent = `Error: ${error.message}`;
            messages.push({
              role: 'tool',
              tool_call_id: tc.id,
              name: tc.name,
              content: errorContent
            });
            yield { type: 'tool_error', tool: tc.name, error: error.message };
            yield {
              type: 'trace_observation',
              round: rounds + 1,
              observation: {
                toolCallId: tc.id,
                toolName: tc.name,
                success: false,
                content: errorContent,
                error: error.message,
                durationMs: Date.now() - startedAt
              }
            };

            const failureSignature = createToolFailureSignature(
              tc.name,
              tc.arguments,
              error.message
            );
            const failureCount = (toolFailureCounts.get(failureSignature) || 0) + 1;
            toolFailureCounts.set(failureSignature, failureCount);
            if (stopOnRepeatedToolError && failureCount >= maxRepeatedToolErrors) {
              yield {
                type: 'final_trace',
                stopReason:
                  error?.name === 'ToolArgumentValidationError'
                    ? 'invalid_tool_arguments'
                    : 'repeated_tool_error'
              };
              return;
            }
          }
        }
        rounds++;
      } else {
        yield { type: 'final_content', content: roundContent };
        yield { type: 'final_trace', stopReason: roundContent.trim() ? 'final' : 'empty_response' };
        break;
      }
    }

    if (rounds >= maxRounds) {
      yield { type: 'final_trace', stopReason: 'max_rounds' };
    }
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

  async getRunSession(runId: string): Promise<AgentSession | null> {
    return this.agentEngine.getSessionByRunId(runId);
  }

  async getSession(sessionId: string): Promise<AgentSession | null> {
    return this.agentEngine.getSession(sessionId);
  }

  async getSessionRuns(sessionId: string): Promise<AgentSession[]> {
    const sessions = await this.agentEngine.getSessionsBySessionId(sessionId);
    return sessions.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  /** Reject a new user turn while a prior run is still executing; supersede abandoned approval waits. */
  async assertConversationCanAcceptNewRun(sessionId: string): Promise<void> {
    const sessions = await this.getSessionRuns(sessionId);

    for (const session of sessions) {
      if (
        session.status === 'running' ||
        session.status === 'queued' ||
        session.status === 'cancelling'
      ) {
        throw new Error(newConversationBlockedMessage(session));
      }
    }

    for (const session of sessions) {
      if (!isSupersedeableApprovalRun(session)) continue;
      if (
        session.status === 'cancelled' ||
        session.status === 'failed' ||
        session.status === 'succeeded' ||
        session.status === 'archived'
      ) {
        continue;
      }
      try {
        await this.cancelRun(session.runId, 'superseded_by_new_message');
      } catch (error) {
        LogService.warn(
          `[AgentService] supersede stale run failed runId=${session.runId}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  async getThreadSessions(threadId: string): Promise<AgentSession[]> {
    const sessions = await this.agentEngine.getSessionsByThreadId(threadId);
    return sessions.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async listRunSessions(): Promise<AgentSession[]> {
    return this.agentEngine.listSessions();
  }

  getRunRegistryInstance(): AgentRunRegistry | undefined {
    return this.runRegistry;
  }

  async getRunEvents(runId: string): Promise<AgentEvent[]> {
    return this.agentEngine.getEvents(runId);
  }

  getRunLiveEvents(runId: string): AgentEvent[] {
    return this.agentEngine.getLiveEvents(runId);
  }

  async recordRunEvent(event: AgentEvent): Promise<void> {
    return this.agentEngine.recordExternalEvent(event);
  }

  async recordBuilderRunEvent(input: {
    runId: string;
    sessionId: string;
    event: AiBuildStreamEvent;
    sequenceStart?: number;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const session = await this.agentEngine.getSessionByRunId(input.runId);
    if (!session || session.sessionId !== input.sessionId) return;

    const currentEvents = await this.agentEngine.getEvents(input.runId);
    const events = mapAiBuilderStreamToAgentEvents(input.event, {
      runId: input.runId,
      sessionId: input.sessionId,
      sequenceStart: input.sequenceStart ?? currentEvents.length + 1,
      metadata: {
        source: 'builder',
        bridge: 'ai-builder-chat-service',
        ...input.metadata
      }
    });
    for (const event of events) {
      await this.agentEngine.recordExternalEvent(event);
    }
  }

  async cancelRun(runId: string, reason?: string) {
    this.runtimeManager.cancelQueuedRun(runId);
    return this.agentEngine.cancelRun(runId, reason);
  }

  async archiveRun(runId: string, reason?: string) {
    return this.agentEngine.archiveRun(runId, reason);
  }

  async saveRunSession(session: AgentSession): Promise<void> {
    return this.agentEngine.saveRunSession(session);
  }

  subscribeRunEvents(runId: string, listener: AgentEventListener): () => void {
    return this.agentEngine.subscribe(runId, listener);
  }

  /**
   * Subscribe to cross-process "new event" signals for any run. Returns an unsubscribe
   * fn. When no cross-process channel is configured this is a no-op (single-instance
   * delivery already happens via {@link subscribeRunEvents}).
   */
  subscribeRunEventSignals(
    handler: (signal: { runId: string; seq: number; instanceId: string }) => void
  ): () => void {
    const channel = this.agentEngine.getEventChannel();
    if (!channel) return () => undefined;
    return channel.onSignal(handler);
  }

  getRunEventChannelInstanceId(): string | undefined {
    return this.agentEngine.getEventChannel()?.instanceId;
  }

  /** Begin LISTENing for cross-process run-event signals. Idempotent and best-effort. */
  async startEventChannel(): Promise<void> {
    await this.eventChannel?.start();
  }

  async stopEventChannel(): Promise<void> {
    await this.eventChannel?.close();
  }

  startRunQueueWorker(): () => void {
    return this.runtimeManager.startQueueWorker((job) => this.runDurableQueueJob(job));
  }

  stopRunQueueWorker(): void {
    this.runtimeManager.stopQueueWorker();
  }

  private async runDurableQueueJob(job: AgentRunQueueJob): Promise<void> {
    const session = await this.agentEngine.getSessionByRunId(job.runId);
    if (!session) {
      throw new Error(`Agent run session not found for queued job: ${job.runId}`);
    }

    if (!isRecoverableQueueSessionStatus(session.status)) {
      return;
    }

    const agentId = readString(session.metadata?.agentId) ?? readString(job.payload?.agentId);
    if (!agentId) {
      throw new Error(`Agent id not found for queued job: ${job.runId}`);
    }

    const agentDefRaw = await this.store.getAgent(agentId);
    if (!agentDefRaw) {
      throw new Error(`Agent ${agentId} not found for queued job: ${job.runId}`);
    }
    let agentDef = mergeAgentConsoleRuntimeMetadata(agentDefRaw, session.metadata);

    const settings = await this.store.get('system_settings');
    const noTools = session.metadata?.noTools === true || job.payload?.noTools === true;
    const queueWorkspacePolicy = this.readWorkspacePolicyFromMetadata(
      session.metadata?.workspacePolicy
    );
    const resolvedProvider = await this.resolveProviderForAgent(
      agentDef,
      true,
      settings,
      undefined,
      session.sessionId
    );
    agentDef = withResolvedProviderModel(agentDef, resolvedProvider.model);
    const tools = await this.resolveAgentLocalTools(agentDef, noTools, session);
    const mcpConfigs = await this.resolveAgentMcpConfigs(agentDef, noTools);
    const mcpTools = noTools ? [] : await this.mcpService.getTools(mcpConfigs);
    const combinedTools = sortToolDefinitions([...tools, ...mcpTools]);
    const budgetPolicy = this.resolveResumeBudgetPolicy(agentDef, session);
    const runSpec: AgentRunSpec = {
      ...this.runSpecFromSessionForGovernance(session, agentDef, budgetPolicy),
      tools: combinedTools,
      mcpConfigs,
      skillInstructions: []
    };
    // useNativeFC gate(同 runAgent/streamAgent):!FC 时不向 provider 传 tools。
    const useNativeFC = isCanUseFC(resolvedProvider.providerConfig?.type ?? '', agentDef.model);
    const providerTools = useNativeFC ? combinedTools : [];
    const provider = this.createGovernedProvider({
      ...resolvedProvider,
      agentDef,
      runSpec,
      budgetPolicy: runSpec.budgetPolicy,
      settings
    });
    const summarizer = createLLMSummarizer({ provider });
    const recoveredMessages = this.toRuntimeMessages(session.messages);
    const { responseCache } = await this.rebuildResponseCacheForRecoveredSession(
      session,
      agentDef,
      resolvedProvider.providerConfig,
      resolvedProvider.model,
      recoveredMessages
    );

    await this.runtimeManager.runClaimed({
      runSpec,
      provider,
      runtimeOptions: {
        agentDef,
        tools: combinedTools,
        providerTools,
        mcpConfigs,
        mcpService: this.mcpService,
        toolRegistry: this.toolRegistry,
        messages: recoveredMessages,
        responseCache,
        silent: true,
        context: buildRuntimeContextHooks({ runSpec, summarizer }),
        toolContextExtras: mergeAgentRunToolExtras(runSpec, resolveAgentKnowledgeScope(agentDef))
      },
      metadata: {
        agentId,
        recoveredFromQueue: true,
        queueAttempts: job.attempts,
        queueMaxAttempts: job.maxAttempts
      }
    });
  }

  async getRunEventsAfter(runId: string, afterSeq: number): Promise<AgentEvent[]> {
    return this.agentEngine.getEventsAfter(runId, afterSeq);
  }

  async getRunTrace(runId: string): Promise<unknown> {
    const session = await this.agentEngine.getSessionByRunId(runId);
    return session?.output?.trace ?? null;
  }

  getSessionMessages(session: AgentSession): AgentMessage[] {
    return this.sessionManager.getSessionMessages(session);
  }

  getSessionTurnMessages(session: AgentSession): AgentMessage[] {
    return this.sessionManager.getThreadRunMessages(session);
  }

  async getThreadMessages(threadId: string): Promise<AgentMessage[]> {
    const sessions = await this.getThreadSessions(threadId);
    return sessions.flatMap((session) => this.sessionManager.getThreadRunMessages(session));
  }

  async getRunHitl(runId: string): Promise<AgentHitlRequest | null> {
    const session = await this.agentEngine.getSessionByRunId(runId);
    return session?.pendingHitl ?? null;
  }

  async listPendingHitl(): Promise<
    Array<AgentHitlRequest & { runId: string; sessionId: string; runStatus: string }>
  > {
    const sessions = await this.listRunSessions();
    return sessions
      .filter((session) => session.pendingHitl)
      .map((session) => ({
        ...(session.pendingHitl as AgentHitlRequest),
        runId: session.runId,
        sessionId: session.sessionId,
        runStatus: session.status
      }))
      .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')));
  }

  async resolveRunHitl(input: {
    runId: string;
    requestId: string;
    action: AgentHitlAction;
    kind?: AgentHitlKind;
    reason?: string;
    editedArguments?: unknown;
    input?: unknown;
    externalResult?: unknown;
    metadata?: Record<string, unknown>;
  }) {
    const session = await this.agentEngine.getSessionByRunId(input.runId);
    if (!session) throw new Error(`Agent run not found: ${input.runId}`);
    if (!isActiveHitlRunStatus(session.status)) {
      throw new Error(`Only active HITL runs can be resolved (current: ${session.status})`);
    }
    const pendingHitl = session.pendingHitl;
    if (!pendingHitl) throw new Error(`Agent run has no pending HITL request: ${input.runId}`);
    if (pendingHitl.requestId !== input.requestId) {
      throw new Error(`HITL resolution does not match pending request: ${input.requestId}`);
    }

    validateHitlResolutionInput(pendingHitl, input);

    if (pendingHitl.permissionId) {
      if (input.action === 'cancel') {
        const resolution = this.createHitlResolution(session, pendingHitl, input);
        await this.recordHitlResolutionEvent(session, resolution);
        await this.cancelRun(input.runId, input.reason ?? 'manual');
        return {
          content: 'HITL decision cancelled the run.',
          stopReason: 'cancelled',
          metadata: {
            requestId: input.requestId,
            permissionId: pendingHitl.permissionId
          }
        };
      }
      const effect = input.action === 'deny' ? 'deny' : 'allow';
      return this.resolveRunPermission({
        runId: input.runId,
        permissionId: pendingHitl.permissionId,
        effect,
        reason: input.reason,
        resolvedBy: 'human',
        editedArguments: input.action === 'edit_arguments' ? input.editedArguments : undefined,
        metadata: {
          ...(input.metadata ?? {}),
          hitlRequestId: input.requestId,
          hitlKind: pendingHitl.kind,
          hitlAction: input.action
        }
      });
    }

    const resolution = this.createHitlResolution(session, pendingHitl, input);
    const resumeContext = await this.buildResumeRuntimeContext(session);
    if (!resumeContext) {
      return this.agentEngine.resumeHitl(session.sessionId, { runId: session.runId, resolution });
    }
    return this.runtimeManager.resumeHitl({
      sessionId: session.sessionId,
      resolution,
      runSpec: resumeContext.runSpec,
      provider: resumeContext.provider,
      runtimeOptions: resumeContext.runtimeOptions,
      metadata: {
        agentId: session.metadata?.agentId,
        resume: {
          checkpointId: session.checkpoints.at(-1)?.checkpointId,
          hitlRequestId: input.requestId,
          hitlAction: input.action
        }
      }
    });
  }

  async resolveRunPermission(input: {
    runId: string;
    permissionId: string;
    effect: Extract<PermissionDecision['effect'], 'allow' | 'deny'>;
    reason?: string;
    resolvedBy?: PermissionDecision['resolvedBy'];
    editedArguments?: unknown;
    metadata?: Record<string, unknown>;
  }) {
    const session = await this.agentEngine.getSessionByRunId(input.runId);
    if (!session) throw new Error(`Agent run not found: ${input.runId}`);

    const decision: PermissionDecision = {
      permissionId: input.permissionId,
      effect: input.effect,
      reason: input.reason,
      resolvedBy: input.resolvedBy ?? 'human',
      resolvedAt: new Date().toISOString(),
      editedArguments: input.editedArguments,
      metadata: input.metadata
    };
    const resumeContext = await this.buildResumeRuntimeContext(session);
    if (!resumeContext) {
      return this.agentEngine.resume(session.sessionId, { runId: session.runId, decision });
    }
    return this.runtimeManager.resume({
      sessionId: session.sessionId,
      decision,
      runSpec: resumeContext.runSpec,
      provider: resumeContext.provider,
      runtimeOptions: resumeContext.runtimeOptions,
      metadata: {
        agentId: session.metadata?.agentId,
        resume: {
          checkpointId: session.checkpoints.at(-1)?.checkpointId,
          permissionId: input.permissionId
        }
      }
    });
  }

  private createHitlResolution(
    _session: AgentSession,
    pendingHitl: AgentHitlRequest,
    input: {
      requestId: string;
      action: AgentHitlAction;
      kind?: AgentHitlKind;
      reason?: string;
      editedArguments?: unknown;
      input?: unknown;
      externalResult?: unknown;
      metadata?: Record<string, unknown>;
    }
  ): AgentHitlResolution {
    return {
      requestId: input.requestId,
      kind: input.kind ?? pendingHitl.kind,
      status: 'resolved',
      action: input.action,
      editedArguments: input.editedArguments,
      input: input.input,
      externalResult: input.externalResult,
      reason: input.reason,
      resolvedAt: new Date().toISOString(),
      resolvedBy: { type: 'user' },
      metadata: input.metadata
    };
  }

  private async recordHitlResolutionEvent(
    session: AgentSession,
    resolution: AgentHitlResolution
  ): Promise<void> {
    await this.agentEngine.recordExternalEvent({
      id: `${session.runId}:hitl_resolved:${Date.now().toString(36)}`,
      type: 'hitl_resolved',
      runId: session.runId,
      sessionId: session.sessionId,
      timestamp: resolution.resolvedAt ?? new Date().toISOString(),
      payload: resolution
    });
  }

  private async buildResumeRuntimeContext(
    session: AgentSession
  ): Promise<ResumeRuntimeContext | undefined> {
    const checkpoint = session.checkpoints.at(-1);
    const agentId = session.metadata?.agentId;
    if (typeof agentId !== 'string' || !agentId.trim()) return undefined;

    const agentDefRaw = await this.store.getAgent(agentId);
    if (!agentDefRaw) return undefined;
    // Keep the same provider/model as the initial stream run (console topic selection
    // is stored on session.metadata.agentConsole, not on the persisted agent record).
    let agentDef = mergeAgentConsoleRuntimeMetadata(agentDefRaw, session.metadata);

    const noTools = session.metadata?.noTools === true;
    const settings = await this.store.get('system_settings');
    const resolvedProvider = await this.resolveProviderForAgent(
      agentDef,
      true,
      settings,
      undefined,
      session.sessionId
    );
    agentDef = withResolvedProviderModel(agentDef, resolvedProvider.model);
    const tools = await this.resolveAgentLocalTools(agentDef, noTools, session);
    const mcpConfigs = await this.resolveAgentMcpConfigs(agentDef, noTools);
    const mcpTools = noTools ? [] : await this.mcpService.getTools(mcpConfigs);
    let messages = this.toRuntimeMessages(
      checkpoint?.messages?.length ? checkpoint.messages : session.messages
    );
    if (checkpoint?.messages?.length) {
      const checkpointSnapshot = this.contextBuilder.buildFromCheckpoint(checkpoint, messages);
      if (!checkpointSnapshot) {
        LogService.warn(
          `[AgentService] Ignoring invalid context checkpoint ${checkpoint.checkpointId}; rebuilding runtime history.`
        );
        messages = this.toRuntimeMessages(session.messages);
      }
    }
    const budgetPolicy = this.resolveResumeBudgetPolicy(agentDef, session);
    const runSpec = this.runSpecFromSessionForGovernance(session, agentDef, budgetPolicy);
    const provider = this.createGovernedProvider({
      ...resolvedProvider,
      agentDef,
      runSpec,
      budgetPolicy,
      settings,
      initialLedger: this.extractProviderGovernanceLedger(session)
    });

    const summarizer = createLLMSummarizer({ provider });
    const { responseCache } = await this.rebuildResponseCacheForRecoveredSession(
      session,
      agentDef,
      resolvedProvider.providerConfig,
      resolvedProvider.model,
      messages
    );

    return {
      runSpec,
      provider,
      runtimeOptions: {
        agentDef,
        tools: [...tools, ...mcpTools],
        mcpConfigs,
        mcpService: this.mcpService,
        toolRegistry: this.toolRegistry,
        messages,
        responseCache,
        silent: true,
        context: buildRuntimeContextHooks({ runSpec, summarizer }),
        // Run-context tools (create_todos, writeFile, …) need the active agentRun;
        // without it they fail with "requires an active agent run context".
        toolContextExtras: mergeAgentRunToolExtras(runSpec, resolveAgentKnowledgeScope(agentDef))
      }
    };
  }

  private resolveResumeBudgetPolicy(
    agentDef: AgentDefinition,
    session: AgentSession
  ): AgentBudgetPolicy {
    const metadataPolicy = this.readBudgetPolicyFromMetadata(session.metadata?.budgetPolicy);
    return {
      maxRounds: metadataPolicy?.maxRounds ?? agentDef.runtime?.maxRounds,
      maxModelCalls: metadataPolicy?.maxModelCalls,
      maxToolCalls: metadataPolicy?.maxToolCalls ?? agentDef.runtime?.maxToolCalls,
      maxToolCallsPerRound:
        metadataPolicy?.maxToolCallsPerRound ?? agentDef.runtime?.maxToolCallsPerRound,
      maxInputTokens: metadataPolicy?.maxInputTokens,
      maxOutputTokens: metadataPolicy?.maxOutputTokens,
      timeoutMs: metadataPolicy?.timeoutMs,
      maxCostUsd: metadataPolicy?.maxCostUsd,
      providerGovernance: metadataPolicy?.providerGovernance
    };
  }

  private readBudgetPolicyFromMetadata(value: unknown): AgentBudgetPolicy | undefined {
    return value && typeof value === 'object' ? value : undefined;
  }

  private readContextPolicyFromMetadata(value: unknown): ContextPolicy | undefined {
    return value && typeof value === 'object'
      ? { ...(value as Record<string, unknown>) }
      : undefined;
  }

  private resolveContextPolicyFromAgentDef(
    agentDef: AgentDefinition,
    providerId: string
  ): ContextPolicy | undefined {
    const chatConfig = this.readAgentConsoleChatConfig(agentDef);
    if (!chatConfig) return undefined;
    const profile = resolveContextProfile(providerId, agentDef.model, {
      maxContextWindow:
        chatConfig.enableMaxContextWindow === true
          ? Number(chatConfig.maxContextWindow) || undefined
          : undefined
    });
    return buildContextPolicyFromChatConfig(chatConfig, profile);
  }

  private resolveWebSearchRunContext(
    agentDef: AgentDefinition,
    options: Pick<AgentRunOptions, 'noTools' | 'userTurnMetadata'>,
    settings?: Partial<SystemSettings>
  ): { policy: WebSearchPolicy; toolIdSet: Set<string> } {
    const chatConfig = this.readAgentConsoleChatConfig(agentDef);
    const providerType = lookupAgentProviderType(agentDef, settings);
    const policy = resolveWebSearchPolicy(chatConfig, providerType);
    const baseToolIds = resolveAgentExposedToolIds(agentDef, options);
    const toolIdSet = applyWebSearchPolicy(baseToolIds, policy);
    return { policy, toolIdSet };
  }

  private readAgentConsoleChatConfig(
    agentDef: AgentDefinition
  ): Record<string, unknown> | undefined {
    const agentConsole = agentDef.metadata?.agentConsole;
    if (!agentConsole || typeof agentConsole !== 'object') return undefined;
    const chatConfig = (agentConsole as Record<string, unknown>).chatConfig;
    if (!chatConfig || typeof chatConfig !== 'object') return undefined;
    return chatConfig as Record<string, unknown>;
  }

  private resolveTokenCounterForAgent(agentDef: AgentDefinition, providerId: string): TokenCounter {
    const chatConfig = this.readAgentConsoleChatConfig(agentDef);
    const profile = resolveContextProfile(providerId, agentDef.model, {
      maxContextWindow:
        chatConfig?.enableMaxContextWindow === true
          ? Number(chatConfig?.maxContextWindow) || undefined
          : undefined
    });
    return new TokenCounter(
      new TokenEstimator({ driftMultiplier: profile.driftMultiplier, encoding: profile.encoding }),
      profile
    );
  }

  private readObservationPolicyFromMetadata(value: unknown): ObservationPolicy | undefined {
    return value && typeof value === 'object'
      ? { ...(value as Record<string, unknown>) }
      : undefined;
  }

  private readPermissionPolicyFromMetadata(value: unknown): PermissionPolicy | undefined {
    if (!value || typeof value !== 'object') return undefined;
    const policy = value as Record<string, unknown>;
    const defaultEffect = policy.defaultEffect;
    if (!isPermissionEffect(defaultEffect)) return undefined;

    return {
      defaultEffect,
      rules: readPermissionPolicyRules(policy.rules),
      readonlyMode: typeof policy.readonlyMode === 'boolean' ? policy.readonlyMode : undefined,
      simulateMode: typeof policy.simulateMode === 'boolean' ? policy.simulateMode : undefined,
      requireReasonForAsk:
        typeof policy.requireReasonForAsk === 'boolean' ? policy.requireReasonForAsk : undefined,
      metadata:
        policy.metadata && typeof policy.metadata === 'object'
          ? { ...(policy.metadata as Record<string, unknown>) }
          : undefined
    };
  }

  private readWorkspacePolicyFromMetadata(value: unknown): WorkspacePolicy | undefined {
    if (!value || typeof value !== 'object') return undefined;
    const policy = value as Record<string, unknown>;
    const mode = policy.mode;
    if (!isWorkspaceMode(mode)) return undefined;

    const pool = policy.pool === 'per-agent' || policy.pool === 'per-run' ? policy.pool : undefined;

    const network = isWorkspaceNetworkPolicy(policy.network) ? policy.network : undefined;
    const writes = isWorkspaceWritePolicy(policy.writes) ? policy.writes : undefined;
    const cleanup = isWorkspaceCleanupPolicy(policy.cleanup) ? policy.cleanup : undefined;
    const rootDir = typeof policy.rootDir === 'string' ? policy.rootDir : undefined;
    const allowedWritePaths = readStringArrayPolicy(policy.allowedWritePaths);
    const envAllowlist = readStringArrayPolicy(
      policy.sandbox && typeof policy.sandbox === 'object'
        ? (policy.sandbox as Record<string, unknown>).envAllowlist
        : undefined
    );
    const allowCapabilities = readToolCapabilityArrayPolicy(
      policy.sandbox && typeof policy.sandbox === 'object'
        ? (policy.sandbox as Record<string, unknown>).allowCapabilities
        : undefined
    );
    const denyCapabilities = readToolCapabilityArrayPolicy(
      policy.sandbox && typeof policy.sandbox === 'object'
        ? (policy.sandbox as Record<string, unknown>).denyCapabilities
        : undefined
    );
    const sandbox =
      policy.sandbox && typeof policy.sandbox === 'object'
        ? {
            enabled:
              typeof (policy.sandbox as Record<string, unknown>).enabled === 'boolean'
                ? ((policy.sandbox as Record<string, unknown>).enabled as boolean)
                : undefined,
            allowCapabilities,
            denyCapabilities,
            denyUnsupportedModes:
              typeof (policy.sandbox as Record<string, unknown>).denyUnsupportedModes === 'boolean'
                ? ((policy.sandbox as Record<string, unknown>).denyUnsupportedModes as boolean)
                : undefined,
            envAllowlist
          }
        : undefined;

    return {
      mode,
      pool,
      rootDir,
      network,
      writes,
      allowedWritePaths,
      cleanup,
      sandbox,
      metadata:
        policy.metadata && typeof policy.metadata === 'object'
          ? { ...(policy.metadata as Record<string, unknown>) }
          : undefined
    };
  }

  private runSpecFromSessionForGovernance(
    session: AgentSession,
    agentDef: AgentDefinition,
    budgetPolicy?: AgentBudgetPolicy
  ): AgentRunSpec {
    return {
      runId: session.runId,
      sessionId: session.sessionId,
      threadId: session.threadId,
      source: session.source,
      agentDef,
      input: {
        messages: session.messages
      },
      budgetPolicy,
      contextPolicy: this.readContextPolicyFromMetadata(session.metadata?.contextPolicy),
      observationPolicy: this.readObservationPolicyFromMetadata(
        session.metadata?.observationPolicy
      ),
      permissionPolicy: this.readPermissionPolicyFromMetadata(session.metadata?.permissionPolicy),
      workspacePolicy: this.readWorkspacePolicyFromMetadata(session.metadata?.workspacePolicy),
      metadata: session.metadata
    };
  }

  private extractProviderGovernanceLedger(
    session: AgentSession
  ): Partial<ProviderGovernanceLedger> {
    const rounds = this.extractProviderGovernanceRounds(session);
    const lastBudget = [...rounds]
      .reverse()
      .map((round) => round.budget)
      .find((budget): budget is NonNullable<AgentRunRoundLike['budget']> => Boolean(budget));
    return {
      modelCalls: this.nonNegativeInteger(lastBudget?.modelCalls),
      promptTokens: this.nonNegativeInteger(lastBudget?.inputTokens),
      completionTokens: this.nonNegativeInteger(lastBudget?.outputTokens),
      totalTokens: this.nonNegativeInteger(
        (lastBudget?.inputTokens ?? 0) + (lastBudget?.outputTokens ?? 0)
      ),
      cachedInputTokens: this.nonNegativeInteger(lastBudget?.cachedInputTokens),
      cacheWriteInputTokens: this.nonNegativeInteger(lastBudget?.cacheWriteInputTokens),
      uncachedInputTokens: this.nonNegativeInteger(lastBudget?.uncachedInputTokens),
      estimatedCostUsd: this.nonNegativeNumber(lastBudget?.estimatedCostUsd),
      estimatedCacheSavingsUsd: this.nonNegativeNumber(lastBudget?.estimatedCacheSavingsUsd)
    };
  }

  private extractProviderGovernanceRounds(session: AgentSession): AgentRunRoundLike[] {
    const eventRounds = session.events.flatMap((event) => {
      if (event.type !== 'model_finished') return [];
      const payload = event.payload as Record<string, unknown>;
      const budget =
        payload.budget && typeof payload.budget === 'object' ? payload.budget : undefined;
      return budget ? [{ budget }] : [];
    });
    if (eventRounds.length > 0) return eventRounds;
    const trace = session.output?.trace;
    if (!trace || typeof trace !== 'object') return [];
    const rounds = (trace as { rounds?: unknown }).rounds;
    return Array.isArray(rounds) ? (rounds as AgentRunRoundLike[]) : [];
  }

  private nonNegativeInteger(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0
      ? Math.floor(value)
      : undefined;
  }

  private nonNegativeNumber(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
  }

  private async materializeAgentLocalTools(toolIds: Set<string>): Promise<ToolDefinition[]> {
    const settings = await this.store.get('system_settings');
    const closedPlugins = settings?.CLOSED_PLUGINS || [];
    return Array.from(toolIds)
      .filter((id) => !closedPlugins.includes(id))
      .map((id) => this.toolRegistry.getTool(id))
      .filter(
        (tool) =>
          tool &&
          (isWorkspaceSystemTool(tool) ||
            tool.scope === undefined ||
            tool.scope === 'agent' ||
            tool.scope === 'both')
      )
      .filter(Boolean) as ToolDefinition[];
  }

  private async resolveAgentLocalTools(
    agentDef: AgentDefinition,
    noTools: boolean,
    session?: AgentSession
  ): Promise<ToolDefinition[]> {
    if (noTools) return [];
    const toolIds = new Set(readExposedToolIdsFromSession(agentDef, session));
    return this.materializeAgentLocalTools(toolIds);
  }

  private async resolveAgentMcpConfigs(
    agentDef: AgentDefinition,
    noTools: boolean
  ): Promise<MCPServerConfig[]> {
    if (noTools || !agentDef.mcpServerIds?.length) return [];
    const mcpConfigs: MCPServerConfig[] = [];
    for (const id of agentDef.mcpServerIds) {
      const config = await this.store.getMCPConfig(id);
      if (config) mcpConfigs.push(config);
    }
    return mcpConfigs;
  }

  private buildTurnSkillMetadata(
    agentDef: AgentDefinition,
    options: AgentRunOptions,
    input: string
  ) {
    if (options.noSkills) return [];
    const skillIds = resolveTurnSkillIds({
      agentSkillIds: agentDef.skillIds || [],
      message: input,
      userTurnMetadata: options.userTurnMetadata
    });
    return this.skillService.listSkillMetadata(skillIds);
  }

  private createTurnContextAssembler(): TurnContextAssembler {
    return new TurnContextAssembler({
      knowledge: async (input) => {
        const content = await this.resolveKnowledgeContext(
          input.agentDef,
          input.userInput,
          input.settings
        );
        return { content };
      },
      memory: async (input) => {
        const content = await this.resolveMemoryContext(input.agentDef, input.userInput, {
          sessionId: input.sessionId,
          metadata: input.metadata
        });
        return { content };
      },
      workspace: async (input) => ({
        content: formatWorkspaceState(await this.resolveTodoState(input.sessionId))
      })
    });
  }

  private async assembleTurnContext(
    input: TurnContextResolverInput & { turnId: string }
  ): Promise<TurnContext> {
    return this.createTurnContextAssembler().assemble(input);
  }

  /** 预检索知识库:复用 KnowledgeRetrievalService + RagContextBuilder,不走 synthesis agent。 */
  private async resolveKnowledgeContext(
    agentDef: AgentDefinition,
    input: string,
    settings: SystemSettings | null | undefined
  ): Promise<string | undefined> {
    const scope = mergeKnowledgeScopes(
      agentDef.knowledgeScope,
      legacyKnowledgeCategoryScope(agentDef.knowledgeCategoryIds)
    );
    const categoryIds = scope?.allowedCategoryIds;
    if (!categoryIds || categoryIds.length === 0) return undefined;
    const query = input.trim();
    if (!query) return undefined;
    try {
      const retrieval = new KnowledgeRetrievalService(this.store, () => settings);
      const result = await retrieval.search(query, { categoryIds, limit: 5 });
      if (!result.evidence || result.evidence.length === 0) return undefined;
      const built = new RagContextBuilder().build(result.evidence, { maxTokens: 3200 });
      return built.context || undefined;
    } catch (error) {
      LogService.warn(
        `[AgentService] resolveKnowledgeContext failed: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /** 预检索记忆:读 chatConfig.memory.enabled(默认 true),调 LocalStore.searchMemories 直出原始片段。 */
  private async resolveMemoryContext(
    agentDef: AgentDefinition,
    input: string,
    options: { sessionId?: string; metadata?: Record<string, unknown> }
  ): Promise<string | undefined> {
    const categoryIds = agentDef.memoryCategoryIds;
    if (!categoryIds || categoryIds.length === 0) return undefined;
    const memoryEnabled = readAgentChatConfigMemoryEnabled(agentDef, options.metadata);
    if (memoryEnabled === false) return undefined;
    const query = input.trim();
    if (!query) return undefined;
    try {
      const results = await this.store.searchMemories(query, { categoryIds, limit: 5 });
      if (!results || results.length === 0) return undefined;
      return formatMemoryContext(results);
    } catch (error) {
      LogService.warn(
        `[AgentService] resolveMemoryContext failed: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /** 读 session 组内最新非空 workspaceState,跨 run 继承 todo。 */
  private async resolveTodoState(sessionId?: string): Promise<AgentWorkspaceState | undefined> {
    if (!sessionId) return undefined;
    try {
      const sessions = await this.getSessionRuns(sessionId);
      for (let i = sessions.length - 1; i >= 0; i -= 1) {
        const todos = sessions[i].workspaceState?.todos;
        if (todos && todos.length > 0) {
          return sessions[i].workspaceState;
        }
      }
      return undefined;
    } catch (error) {
      LogService.warn(
        `[AgentService] resolveTodoState failed: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  private async buildRunMessages(input: {
    input: string;
    assembled: AssembledMessages;
    options: AgentRunOptions;
    agentDef: AgentDefinition;
    providerConfig?: AIProviderConfig;
    variables?: Record<string, string>;
  }): Promise<AIMessage[]> {
    const uploadService = input.options.userTurnMetadata?.imageList?.length
      ? new AgentUploadService(this.store)
      : undefined;
    const supportsVision = resolveSupportsVision(input.agentDef, input.providerConfig);
    const dynamicSuffix = resolveInputTemplateSuffix(
      input.agentDef,
      input.options.metadata,
      input.variables
    );
    const turnContent = await buildRuntimeUserContent({
      message: input.input,
      fileList: input.options.userTurnMetadata?.fileList,
      imageList: input.options.userTurnMetadata?.imageList,
      dynamicSuffix,
      supportsVision,
      uploadService
    });
    const turnMessage: AIMessage = { role: 'user', content: turnContent };
    const sessionHistory = await this.buildSessionHistory(
      input.options,
      input.agentDef,
      input.providerConfig
    );
    const clientHistory = this.normalizeClientRunMessages(input.options.messages);
    const mergedHistory = pickRicherRuntimeHistory(sessionHistory, clientHistory);
    const conversation = [...mergedHistory, turnMessage];

    return this.contextBuilder.buildInitial({
      systemMessage: input.assembled.systemMessage,
      preUserMessages: [],
      conversationMessages: conversation,
      tailMessages: input.assembled.variantMessages
    }).messages;
  }

  private async buildSessionHistory(
    options: AgentRunOptions,
    agentDef: AgentDefinition,
    providerConfig?: AIProviderConfig
  ): Promise<AIMessage[]> {
    const sessionId = normalizeRuntimeId(options.sessionId);
    const threadId = normalizeRuntimeId(options.threadId);
    const historySessions = sessionId
      ? await this.getSessionRuns(sessionId)
      : threadId
        ? await this.getThreadSessions(threadId)
        : [];
    if (historySessions.length === 0) return [];

    const uploadService = new AgentUploadService(this.store);
    const supportsVision = resolveSupportsVision(agentDef, providerConfig);
    const runtimeContext = { uploadService, supportsVision };
    const messages: AIMessage[] = [];

    for (const session of historySessions.filter((item) => isReusableConversationRun(item))) {
      for (const message of this.sessionManager.getThreadRunMessages(session)) {
        const converted = await this.agentMessageToRuntimeMessage(message, runtimeContext);
        messages.push(...converted);
      }
    }

    return dedupeAdjacentRuntimeMessages(messages);
  }

  private normalizeClientRunMessages(messages: AgentRunOptions['messages']): AIMessage[] {
    if (!messages?.length) return [];
    return dedupeAdjacentRuntimeMessages(
      messages
        .filter(
          (message) =>
            message.role === 'system' ||
            message.role === 'user' ||
            message.role === 'assistant' ||
            message.role === 'tool'
        )
        .map((message) => ({ ...message }))
    );
  }

  private async buildPromptCacheContractForRun(
    options: AgentRunOptions,
    agentDef: AgentDefinition,
    providerConfig: AIProviderConfig | undefined,
    provider: AIProvider,
    providerModel: string | undefined,
    assembled: AssembledMessages,
    tools: ToolDefinition[]
  ): Promise<PromptCacheContract> {
    const providerId = String(providerConfig?.id ?? agentDef.providerId ?? '').trim();
    const providerType = String(providerConfig?.type ?? providerId).trim();
    const model = String(providerModel ?? agentDef.model ?? '').trim();
    const reasoningMode = String(
      (providerConfig as { reasoningEffort?: string } | undefined)?.reasoningEffort ?? 'none'
    );
    const contributions = assembled.contributions ?? [];
    const unsafeReasons: string[] = [];

    for (const contribution of contributions) {
      if (contribution.phase === 'system_accumulate' && contribution.cacheClass !== 'stable') {
        unsafeReasons.push(`unstable_system_contribution:${contribution.providerId}`);
      }
      // Variant providers must use variant cacheClass. Dynamic contributions are
      // rejected by PromptPipeline, but keep this guard for synthetic assembled input.
      if (
        contribution.phase === 'variant_accumulate' &&
        contribution.cacheClass !== 'variant'
      ) {
        unsafeReasons.push(`unstable_variant_contribution:${contribution.providerId}`);
      }
    }

    const variantParts = contributions
      .filter((contribution) => contribution.cacheClass === 'variant')
      .map((contribution) => ({
        providerId: contribution.providerId,
        variantKey: contribution.variantKey,
        content: contribution.content
      }));

    const sessionId = normalizeRuntimeId(options.sessionId);
    if (!sessionId) {
      LogService.info(
        `[AgentService] Session-scoped prompt cache disabled: session_id_required (agent=${agentDef.id})`
      );
    }

    const sessions = sessionId ? await this.getSessionRuns(sessionId) : [];
    const pinnedEndpoint = resolvePinnedSessionEndpoint(sessions, model, providerId);
    const endpoint = resolveEffectiveApiEndpoint({
      configuredEndpoint: providerConfig?.apiEndpoint,
      pinnedEndpoint,
      providerType,
      apiUrl: providerConfig?.apiUrl,
      model,
      providerLabel: providerConfig?.name ?? provider.name,
      reasoningEffort: reasoningMode
    });

    const contract = buildPromptCacheContract({
      providerId,
      model,
      endpoint,
      reasoningMode,
      stablePrefix: assembled.systemMessage.content,
      variantParts,
      toolset: canonicalizeToolDefinitions(tools),
      capability:
        provider.promptCacheCapability ??
        resolvePromptCacheCapability(providerType, endpoint),
      cacheRequested:
        (options.promptCacheMode ?? 'enforced') !== 'disabled' &&
        !this.isResponseCacheDisabled(options),
      cachePolicy: options.promptCachePolicy,
      cacheMode: options.promptCacheMode,
      sessionId,
      unsafeReasons
    });
    return applyMultiAgentPromptCachePolicy(
      contract,
      options.promptCachePolicy ?? 'isolated',
      options.parentPromptCacheContract
    );
  }

  private async buildPromptCacheContractForMessages(
    options: AgentRunOptions,
    agentDef: AgentDefinition,
    providerConfig: AIProviderConfig | undefined,
    provider: AIProvider,
    providerModel: string | undefined,
    messages: AIMessage[],
    tools: ToolDefinition[]
  ): Promise<PromptCacheContract> {
    const systemMessages = messages.filter((message) => message.role === 'system');
    const assembled: AssembledMessages = {
      systemMessage: {
        role: 'system',
        content: normalizeRuntimeMessageContent(
          systemMessages[0]?.content ?? 'You are a helpful assistant.'
        )
      },
      variantMessages: [],
      contributions: systemMessages.map((message, index) => ({
        providerId: `temporary_system_${index}`,
        phase: 'system_accumulate' as const,
        content: normalizeRuntimeMessageContent(message.content),
        cacheClass: index === 0 ? ('stable' as const) : ('dynamic' as const)
      }))
    };
    return this.buildPromptCacheContractForRun(
      options,
      agentDef,
      providerConfig,
      provider,
      providerModel,
      assembled,
      tools
    );
  }

  private async resolveResponseCacheForRun(
    options: AgentRunOptions,
    agentDef: AgentDefinition,
    messages: AIMessage[],
    contract: PromptCacheContract
  ): Promise<ResponseCacheRequest | undefined> {
    if (this.isResponseCacheDisabled(options) || !contract.cacheEligibility) {
      return disabledResponseCacheRequest(
        contract,
        contract.cacheDisableReason ?? 'cache_ineligible'
      );
    }
    if (contract.cacheMode === 'shadow') {
      return disabledResponseCacheRequest(contract, 'shadow_mode');
    }

    const sessionId = normalizeRuntimeId(options.sessionId);
    const sessions = sessionId ? await this.getSessionRuns(sessionId) : [];
    if (
      hasLegacyToolHistory(sessions) ||
      messages.some(
        (message) =>
          (message.role === 'tool' ||
            (Array.isArray(message.tool_calls) && message.tool_calls.length > 0)) &&
          message.canonical_message_version !== CANONICAL_MESSAGE_SERIALIZATION_VERSION
      )
    ) {
      return disabledResponseCacheRequest(
        contract,
        hasLegacyToolHistory(sessions) ? 'legacy_tool_history' : 'legacy_runtime_messages'
      );
    }
    const cacheEntry = sessionId
      ? resolveResponseCacheFromSessions(sessions, contract.model, contract.providerId, contract.cacheKey)
      : undefined;
    return buildResponseCacheRequest(messages, cacheEntry, {
      enableStore: true,
      roundIndex: 1,
      cacheKey: contract.cacheKey,
      contract
    });
  }

  /**
   * Rebuild responseCache for HITL/permission resume and durable queue recovery.
   * Reuses the persisted contract only when provider/model/endpoint still match.
   */
  private async rebuildResponseCacheForRecoveredSession(
    session: AgentSession,
    agentDef: AgentDefinition,
    providerConfig: AIProviderConfig | undefined,
    providerModel: string | undefined,
    messages: AIMessage[]
  ): Promise<{ contract?: PromptCacheContract; responseCache?: ResponseCacheRequest }> {
    const persisted = readPromptCacheContract(session.metadata?.promptCacheContract);
    if (!persisted) {
      return {};
    }

    const providerId = String(providerConfig?.id ?? agentDef.providerId ?? '').trim();
    const model = String(providerModel ?? agentDef.model ?? '').trim();
    const sessions = await this.getSessionRuns(session.sessionId);
    const pinnedEndpoint = resolvePinnedSessionEndpoint(sessions, model, providerId);
    const endpoint = resolveEffectiveApiEndpoint({
      configuredEndpoint: providerConfig?.apiEndpoint,
      pinnedEndpoint: pinnedEndpoint ?? persisted.endpoint,
      providerType: providerConfig?.type,
      apiUrl: providerConfig?.apiUrl,
      model,
      providerLabel: providerConfig?.name,
      reasoningEffort: persisted.reasoningMode
    });

    const routeMismatchReasons: string[] = [];
    if (persisted.providerId && providerId && persisted.providerId !== providerId) {
      routeMismatchReasons.push('resume_provider_mismatch');
    }
    if (persisted.model && model && persisted.model !== model) {
      routeMismatchReasons.push('resume_model_mismatch');
    }
    if (
      persisted.endpoint &&
      endpoint &&
      persisted.endpoint !== 'default' &&
      persisted.endpoint !== 'auto' &&
      endpoint !== persisted.endpoint
    ) {
      routeMismatchReasons.push('resume_endpoint_mismatch');
    }
    if (
      persisted.stablePrefixHash &&
      // Prefix changes after compaction / prompt edits are expected; refuse reuse.
      typeof session.metadata?.promptCacheContract === 'object' &&
      routeMismatchReasons.length === 0
    ) {
      // Keep persisted contract when route matches; resolveResponseCacheForRun
      // still validates eligibility / legacy history.
    }

    if (routeMismatchReasons.length > 0) {
      return {
        contract: persisted,
        responseCache: disabledResponseCacheRequest(persisted, routeMismatchReasons.join(';'))
      };
    }

    const options: AgentRunOptions = {
      sessionId: session.sessionId,
      metadata: session.metadata
    };
    const responseCache = await this.resolveResponseCacheForRun(
      options,
      agentDef,
      messages,
      persisted
    );
    return { contract: persisted, responseCache };
  }

  private isResponseCacheDisabled(options: AgentRunOptions): boolean {
    const agentConsole = options.metadata?.agentConsole;
    if (!agentConsole || typeof agentConsole !== 'object') return false;
    const chatConfig = (agentConsole as Record<string, unknown>).chatConfig;
    if (!chatConfig || typeof chatConfig !== 'object') return false;
    return (chatConfig as Record<string, unknown>).enableResponseCache === false;
  }

  private async agentMessageToRuntimeMessage(
    message: AgentMessage,
    runtime: {
      uploadService: AgentUploadService;
      supportsVision: boolean;
    }
  ): Promise<AIMessage[]> {
    if (
      message.role !== 'system' &&
      message.role !== 'user' &&
      message.role !== 'assistant' &&
      message.role !== 'tool'
    ) {
      return [];
    }

    if (message.role === 'user') {
      const { fileList, imageList } = readUserTurnMetadata(message.metadata);
      const baseText = typeof message.content === 'string' ? message.content : '';
      if (fileList.length > 0 || imageList.length > 0) {
        const content = await buildRuntimeUserContent({
          message: baseText,
          fileList,
          imageList,
          supportsVision: runtime.supportsVision,
          uploadService: runtime.uploadService
        });
        return [
          {
            role: 'user',
            content,
            name: message.name,
            tool_call_id: message.toolCallId,
            tool_calls: Array.isArray(message.metadata?.toolCalls)
              ? message.metadata.toolCalls
              : undefined,
            raw_parts: Array.isArray(message.metadata?.rawParts)
              ? message.metadata.rawParts
              : undefined
          }
        ];
      }
    }

    if (message.role === 'assistant') {
      return rehydratePersistedAgentMessage(message).messages;
    }

    return rehydratePersistedAgentMessage(message).messages;
  }

  private toRuntimeMessages(messages: AgentMessage[]): AIMessage[] {
    return rehydratePersistedMessages(
      messages.filter(
        (message) =>
          message.role === 'system' ||
          message.role === 'user' ||
          message.role === 'assistant' ||
          message.role === 'tool'
      )
    ).messages;
  }
}

function isRecoverableQueueSessionStatus(status: AgentSession['status']): boolean {
  return status === 'queued' || status === 'running';
}

function disabledResponseCacheRequest(
  contract: PromptCacheContract,
  reason: string
): ResponseCacheRequest {
  return {
    enableStore: false,
    cacheKey: undefined,
    cacheEligibility: false,
    cacheNamespace: contract.cacheNamespace,
    cacheContractVersion: contract.contractVersion,
    cacheDisableReason: reason,
    providerId: contract.providerId,
    model: contract.model,
    endpoint: contract.endpoint,
    reasoningMode: contract.reasoningMode,
    cachePolicy: contract.cachePolicy,
    cacheMode: contract.cacheMode
  };
}

function hasLegacyToolHistory(sessions: AgentSession[]): boolean {
  for (const session of sessions) {
    for (const event of session.events) {
      if (event.type !== 'tool_finished') continue;
      const payload = event.payload as Record<string, unknown>;
      if (
        typeof payload.content === 'string' &&
        typeof payload.canonicalMessageContent !== 'string'
      ) {
        return true;
      }
    }

    for (const message of session.messages) {
      if (message.role !== 'assistant' || !Array.isArray(message.metadata?.toolCalls)) {
        continue;
      }
      if (
        message.metadata.toolCalls.some(
          (toolCall) =>
            !toolCall ||
            typeof toolCall !== 'object' ||
            typeof (toolCall as Record<string, unknown>).canonicalMessageContent !== 'string'
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function isPermissionEffect(value: unknown): value is PermissionEffect {
  return value === 'allow' || value === 'ask' || value === 'deny';
}

function readPermissionPolicyRules(value: unknown): PermissionPolicy['rules'] {
  if (!Array.isArray(value)) return undefined;
  const rules = value.filter(isPermissionPolicyRule);
  return rules.length === value.length ? rules : undefined;
}

function isPermissionPolicyRule(
  value: unknown
): value is NonNullable<PermissionPolicy['rules']>[number] {
  if (!value || typeof value !== 'object') return false;
  const rule = value as Record<string, unknown>;
  return typeof rule.id === 'string' && isPermissionEffect(rule.effect);
}

function isWorkspaceMode(value: unknown): value is WorkspacePolicy['mode'] {
  return value === 'none' || value === 'local' || value === 'docker' || value === 'remote';
}

function isWorkspaceNetworkPolicy(
  value: unknown
): value is NonNullable<WorkspacePolicy['network']> {
  return value === 'disabled' || value === 'limited' || value === 'enabled';
}

function isWorkspaceWritePolicy(value: unknown): value is NonNullable<WorkspacePolicy['writes']> {
  return value === 'read-only' || value === 'workspace-only' || value === 'allow-listed';
}

function isWorkspaceCleanupPolicy(
  value: unknown
): value is NonNullable<WorkspacePolicy['cleanup']> {
  return value === 'always' || value === 'on-success' || value === 'manual';
}

function readStringArrayPolicy(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
    ? [...value]
    : undefined;
}

function readToolCapabilityArrayPolicy(value: unknown): ToolExecutionCapability[] | undefined {
  return Array.isArray(value) && value.every(isToolExecutionCapability) ? [...value] : undefined;
}

function isToolExecutionCapability(value: unknown): value is ToolExecutionCapability {
  return (
    value === 'filesystem.read' ||
    value === 'filesystem.write' ||
    value === 'process.exec' ||
    value === 'network' ||
    value === 'secrets'
  );
}

function isActiveHitlRunStatus(status: AgentSession['status']): boolean {
  return status === 'queued' || status === 'running' || status === 'paused';
}

type HitlResolutionInput = {
  requestId: string;
  action: AgentHitlAction;
  kind?: AgentHitlKind;
  editedArguments?: unknown;
  input?: unknown;
  externalResult?: unknown;
};

function validateHitlResolutionInput(
  pendingHitl: AgentHitlRequest,
  input: HitlResolutionInput
): void {
  const expectedKind = pendingHitl.kind;
  if (input.kind && input.kind !== expectedKind) {
    throw new Error(`HITL kind does not match pending request: ${input.kind}`);
  }

  const allowed = new Set(
    pendingHitl.allowedActions ?? defaultHitlActionsForKind(expectedKind, pendingHitl)
  );
  if (!allowed.has(input.action)) {
    throw new Error(`HITL action is not allowed for pending request: ${input.action}`);
  }

  if (!defaultHitlActionsForKind(expectedKind, pendingHitl).includes(input.action)) {
    throw new Error(`HITL action does not match request kind: ${expectedKind}/${input.action}`);
  }

  if (input.action === 'edit_arguments' && input.editedArguments === undefined) {
    throw new Error('editedArguments is required for HITL edit_arguments');
  }
  if (input.action !== 'edit_arguments' && input.editedArguments !== undefined) {
    throw new Error('editedArguments is only allowed for HITL edit_arguments');
  }
  if (input.action === 'provide_input' && input.input === undefined) {
    throw new Error('input is required for HITL provide_input');
  }
  if (input.action !== 'provide_input' && input.input !== undefined) {
    throw new Error('input is only allowed for HITL provide_input');
  }
  if (input.action === 'external_result' && input.externalResult === undefined) {
    throw new Error('externalResult is required for HITL external_result');
  }
  if (input.action !== 'external_result' && input.externalResult !== undefined) {
    throw new Error('externalResult is only allowed for HITL external_result');
  }
}

function defaultHitlActionsForKind(
  kind: AgentHitlKind,
  request?: AgentHitlRequest
): AgentHitlAction[] {
  switch (kind) {
    case 'permission':
    case 'argument_edit':
      return ['allow', 'deny', 'edit_arguments', 'cancel'];
    case 'confirmation':
      return request?.permissionId
        ? ['allow', 'deny', 'edit_arguments', 'cancel']
        : ['allow', 'deny', 'cancel'];
    case 'needs_input':
      return ['provide_input', 'cancel'];
    case 'external_execution':
      return ['external_result', 'cancel'];
  }
}

function normalizeRuntimeId(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function dedupeAdjacentRuntimeMessages(messages: AIMessage[]): AIMessage[] {
  const deduped: AIMessage[] = [];
  for (const message of messages) {
    const previous = deduped.at(-1);
    if (
      previous &&
      previous.role === message.role &&
      previous.content === message.content &&
      previous.name === message.name &&
      previous.tool_call_id === message.tool_call_id
    ) {
      continue;
    }
    deduped.push(message);
  }
  return deduped;
}

/** 把记忆检索结果(原始片段)格式化为带标号的上下文字符串。 */
function formatMemoryContext(results: Array<{ content?: string; text?: string }>): string {
  const blocks: string[] = [];
  results.forEach((item, index) => {
    const text = (item.content || item.text || '').trim();
    if (!text) return;
    blocks.push(`[记忆 ${index + 1}]\n${text}`);
  });
  return blocks.join('\n\n---\n\n');
}

function formatWorkspaceState(state?: AgentWorkspaceState): string | undefined {
  const todos = state?.todos;
  if (!todos || todos.length === 0) return undefined;
  return [
    '当前任务进度:',
    ...todos.map((todo) => `- ${todo.completed ? '[x]' : '[ ]'} ${todo.content}`)
  ].join('\n');
}

/** 读取 chatConfig.memory.enabled(默认 true);优先 options.metadata 覆盖,其次 agentDef.metadata.agentConsole。 */
function readAgentChatConfigMemoryEnabled(
  agentDef: AgentDefinition,
  metadata?: Record<string, unknown>
): boolean {
  const sources = [metadata?.agentConsole, agentDef.metadata?.agentConsole];
  for (const agentConsole of sources) {
    if (!agentConsole || typeof agentConsole !== 'object') continue;
    const chatConfig = (agentConsole as Record<string, unknown>).chatConfig;
    if (!chatConfig || typeof chatConfig !== 'object') continue;
    const memory = (chatConfig as Record<string, unknown>).memory;
    if (!memory || typeof memory !== 'object') continue;
    const enabled = (memory as Record<string, unknown>).enabled;
    if (typeof enabled === 'boolean') return enabled;
  }
  return true;
}

/** 读取 chatConfig.inputTemplate,用 variables 替换后作为 user message 的 dynamicSuffix。 */
function resolveInputTemplateSuffix(
  agentDef: AgentDefinition,
  metadata?: Record<string, unknown>,
  variables?: Record<string, string>
): string {
  const sources = [metadata?.agentConsole, agentDef.metadata?.agentConsole];
  let template: string | undefined;
  for (const agentConsole of sources) {
    if (!agentConsole || typeof agentConsole !== 'object') continue;
    const chatConfig = (agentConsole as Record<string, unknown>).chatConfig;
    if (!chatConfig || typeof chatConfig !== 'object') continue;
    const tpl = (chatConfig as Record<string, unknown>).inputTemplate;
    if (typeof tpl === 'string' && tpl.trim()) {
      template = tpl;
      break;
    }
  }
  if (!template) return '';
  return replaceMessageVariables(template, variables ?? {}).trim();
}
