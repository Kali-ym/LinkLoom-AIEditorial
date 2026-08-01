import type { AgentSession } from './AgentSession.js';
import type { AIMessage } from '../../../types/index.js';
import { runtimeMessagePlainText } from '../userTurnRuntime.js';
import { derivePromptCacheKey, type PromptCacheContract } from './promptCacheContract.js';
import { CANONICAL_MESSAGE_SERIALIZATION_VERSION } from './canonicalMessageSerializer.js';

export type ProviderContextCacheEntry = {
  cacheKey?: string;
  cacheNamespace?: string;
  sessionId?: string;
  completionId?: string;
  messageId?: string;
  model: string;
  providerId: string;
  endpoint?: string;
  reasoningMode?: string;
  responseId?: string;
  responseInputFingerprint?: string;
};

/** Provider context cache hints passed into AIProvider for all endpoint modes. */
export type ResponseCacheRequest = {
  cacheKey?: string;
  enableStore: boolean;
  cacheContractVersion?: string;
  cacheEligibility?: boolean;
  cacheNamespace?: string;
  cacheDisableReason?: string;
  providerId?: string;
  model?: string;
  /** Stable session identity used by endpoint adapters for sticky routing. */
  sessionId?: string;
  endpoint?: string;
  reasoningMode?: string;
  cachePolicy?: PromptCacheContract['cachePolicy'];
  cacheMode?: PromptCacheContract['cacheMode'];
  stablePrefixHash?: string;
  incrementalInput?: Array<Record<string, unknown>>;
  incrementalMessages?: AIMessage[];
  /** Any provider context id for within-run chaining (round 2+, Responses API only). */
  previousContextId?: string;
  previousCompletionId?: string;
  previousMessageId?: string;
  previousResponseId?: string;
  responseInputFingerprint?: string;
  /** Persisted session fingerprint used for fallback/recovery mismatch checks. */
  persistedResponseInputFingerprint?: string;
  /** Number of ephemeral context messages included in the current turn. */
  ephemeralMessageCount?: number;
  sourceErrors?: Array<{ source: string; code: string }>;
  conversionDiagnostics?: string[];
  /**
   * When true, history assistant messages keep their reasoning/thinking blocks
   * when serialized back to the API. Defaults to false (omitted) so that the
   * per-turn reasoning text — which varies on every call — does not break the
   * byte-stable prefix required by prompt caching across providers
   * (OpenAI Responses, Chat Completions, Anthropic Messages, DeepSeek, …).
   * Set to true only when a provider needs prior reasoning to continue a
   * multi-turn tool chain (e.g. Anthropic extended thinking).
   */
  keepHistoryReasoning?: boolean;
};

const PROMPT_CACHE_REPLAY_HISTORY_VERSION = 1 as const;
const PROMPT_CACHE_REPLAY_HISTORY_MAX_MESSAGES = 192;
const PROMPT_CACHE_REPLAY_HISTORY_MAX_CHARS = 96_000;
const PROMPT_CACHE_REPLAY_CONTEXT_VERSION = 1 as const;
const PROMPT_CACHE_REPLAY_CONTEXT_MAX_MESSAGES = 32;
const PROMPT_CACHE_REPLAY_CONTEXT_MAX_CHARS = 48_000;
const EPHEMERAL_CONTEXT_MARKERS = ['<linkloom_context', '<retrieved_knowledge>'] as const;

export function buildPromptCacheReplayHistoryMetadata(
  requestMessages: AIMessage[],
  persistentMessages: AIMessage[]
): Record<string, unknown> | undefined {
  const requestWithoutEphemeral = requestMessages.filter(
    (message) => !isPromptCacheReplayContextMessage(message)
  );
  let requestIndex = 0;
  let tailStart = persistentMessages.length;

  for (let index = 0; index < persistentMessages.length; index += 1) {
    const message = persistentMessages[index];
    if (isPromptCacheReplayContextMessage(message)) continue;
    if (requestIndex >= requestWithoutEphemeral.length) {
      tailStart = index;
      break;
    }
    if (replayMessageKey(message) !== replayMessageKey(requestWithoutEphemeral[requestIndex])) {
      return undefined;
    }
    requestIndex += 1;
  }

  if (requestIndex !== requestWithoutEphemeral.length) return undefined;
  const tailMessages = persistentMessages.slice(tailStart);
  const totalMessages = requestMessages.length + tailMessages.length;
  const totalChars = JSON.stringify([...requestMessages, ...tailMessages]).length;
  if (
    totalMessages > PROMPT_CACHE_REPLAY_HISTORY_MAX_MESSAGES ||
    totalChars > PROMPT_CACHE_REPLAY_HISTORY_MAX_CHARS
  ) {
    return undefined;
  }

  return {
    version: PROMPT_CACHE_REPLAY_HISTORY_VERSION,
    messages: structuredClone(requestMessages),
    tailMessages: structuredClone(tailMessages)
  };
}

export function readPromptCacheReplayHistory(
  metadata?: Record<string, unknown>
): { messages: AIMessage[]; tailMessages: AIMessage[] } | undefined {
  const raw = metadata?.promptCacheReplayHistory;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const record = raw as Record<string, unknown>;
  if (record.version !== PROMPT_CACHE_REPLAY_HISTORY_VERSION) return undefined;
  if (!Array.isArray(record.messages) || !Array.isArray(record.tailMessages)) return undefined;
  if (
    !record.messages.every(isReplayHistoryMessage) ||
    !record.tailMessages.every(isReplayHistoryMessage)
  ) {
    return undefined;
  }
  const messages = structuredClone(record.messages).map(canonicalizeReplayHistoryMessage);
  const tailMessages = structuredClone(record.tailMessages).map(canonicalizeReplayHistoryMessage);
  if (messages.length + tailMessages.length > PROMPT_CACHE_REPLAY_HISTORY_MAX_MESSAGES) {
    return undefined;
  }
  if (
    JSON.stringify([...messages, ...tailMessages]).length > PROMPT_CACHE_REPLAY_HISTORY_MAX_CHARS
  ) {
    return undefined;
  }
  return { messages, tailMessages };
}

export function isPromptCacheReplayContextMessage(message: AIMessage): boolean {
  if (message.role !== 'user') return false;
  const serialized =
    typeof message.content === 'string' ? message.content : JSON.stringify(message.content ?? '');
  return EPHEMERAL_CONTEXT_MARKERS.some((marker) => serialized.includes(marker));
}

/**
 * Extract only the current turn's request-only context for the next run's
 * cache prefix replay. The surrounding canonical trajectory remains in the
 * normal session history; keeping this small avoids duplicating tool history
 * in metadata.
 */
export function extractPromptCacheReplayContext(
  requestMessages: AIMessage[],
  persistentMessages: AIMessage[]
): AIMessage[] {
  const persistentMarkerCounts = new Map<string, number>();
  for (const message of persistentMessages) {
    if (!isPromptCacheReplayContextMessage(message)) continue;
    const key = JSON.stringify(message);
    persistentMarkerCounts.set(key, (persistentMarkerCounts.get(key) ?? 0) + 1);
  }

  const currentContext: AIMessage[] = [];
  for (const message of requestMessages) {
    if (!isPromptCacheReplayContextMessage(message)) continue;
    const key = JSON.stringify(message);
    const remaining = persistentMarkerCounts.get(key) ?? 0;
    if (remaining > 0) {
      persistentMarkerCounts.set(key, remaining - 1);
      continue;
    }
    currentContext.push(structuredClone(message));
  }

  if (currentContext.length > PROMPT_CACHE_REPLAY_CONTEXT_MAX_MESSAGES) return [];
  if (JSON.stringify(currentContext).length > PROMPT_CACHE_REPLAY_CONTEXT_MAX_CHARS) return [];
  return currentContext;
}

export function buildPromptCacheReplayContextMetadata(
  messages: AIMessage[]
): Record<string, unknown> | undefined {
  if (messages.length === 0) return undefined;
  if (messages.length > PROMPT_CACHE_REPLAY_CONTEXT_MAX_MESSAGES) return undefined;
  if (JSON.stringify(messages).length > PROMPT_CACHE_REPLAY_CONTEXT_MAX_CHARS) return undefined;
  return {
    version: PROMPT_CACHE_REPLAY_CONTEXT_VERSION,
    messages: structuredClone(messages)
  };
}

export function readPromptCacheReplayContext(metadata?: Record<string, unknown>): AIMessage[] {
  const raw = metadata?.promptCacheReplayContext;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  const record = raw as Record<string, unknown>;
  if (record.version !== PROMPT_CACHE_REPLAY_CONTEXT_VERSION) return [];
  if (!Array.isArray(record.messages)) return [];
  const messages = record.messages.filter((message): message is AIMessage =>
    Boolean(
      message &&
      typeof message === 'object' &&
      (message as Record<string, unknown>).role === 'user' &&
      isPromptCacheReplayContextMessage(message as AIMessage)
    )
  );
  if (messages.length > PROMPT_CACHE_REPLAY_CONTEXT_MAX_MESSAGES) return [];
  if (JSON.stringify(messages).length > PROMPT_CACHE_REPLAY_CONTEXT_MAX_CHARS) return [];
  return structuredClone(messages);
}

/** Insert hidden replay context after a run's final user message. */
export function insertPromptCacheReplayContext(
  messages: AIMessage[],
  replayContext: AIMessage[]
): AIMessage[] {
  if (replayContext.length === 0) return messages;
  if (messages.some(isPromptCacheReplayContextMessage)) return messages;
  const lastUserIndex = messages.findLastIndex((message) => message.role === 'user');
  if (lastUserIndex < 0) return messages;
  return [
    ...messages.slice(0, lastUserIndex + 1),
    ...structuredClone(replayContext),
    ...messages.slice(lastUserIndex + 1)
  ];
}

/**
 * Reattach hidden replay messages when a caller supplies a richer canonical
 * client history. The client history intentionally does not contain hidden
 * context, so match each replay group to its preceding user turn.
 */
export function mergePromptCacheReplayContextHistory(
  sourceHistory: AIMessage[],
  targetHistory: AIMessage[]
): AIMessage[] {
  if (targetHistory.some(isPromptCacheReplayContextMessage)) return targetHistory;

  const groups: Array<{ anchor: string; userOrdinal: number; messages: AIMessage[] }> = [];
  let lastUser: AIMessage | undefined;
  let userOrdinal = -1;
  let currentGroup: { anchor: string; userOrdinal: number; messages: AIMessage[] } | undefined;
  for (const message of sourceHistory) {
    if (isPromptCacheReplayContextMessage(message)) {
      if (!lastUser) continue;
      if (!currentGroup || currentGroup.anchor !== replayAnchorKey(lastUser)) {
        currentGroup = {
          anchor: replayAnchorKey(lastUser),
          userOrdinal,
          messages: []
        };
        groups.push(currentGroup);
      }
      currentGroup.messages.push(structuredClone(message));
      continue;
    }
    if (message.role === 'user') {
      lastUser = message;
      userOrdinal += 1;
    }
    currentGroup = undefined;
  }
  if (groups.length === 0) return targetHistory;

  const targetUserIndexes = targetHistory.flatMap((message, index) =>
    message.role === 'user' ? [index] : []
  );
  const inserts = new Map<number, AIMessage[]>();
  let searchFrom = 0;
  for (const group of groups) {
    const exactTargetIndex = targetHistory.findIndex(
      (message, index) =>
        index >= searchFrom && message.role === 'user' && replayAnchorKey(message) === group.anchor
    );
    const targetIndex =
      exactTargetIndex >= 0 ? exactTargetIndex : (targetUserIndexes[group.userOrdinal] ?? -1);
    if (targetIndex < 0) continue;
    inserts.set(targetIndex, [
      ...(inserts.get(targetIndex) ?? []),
      ...structuredClone(group.messages)
    ]);
    searchFrom = targetIndex + 1;
  }

  if (inserts.size === 0) return targetHistory;
  return targetHistory.flatMap((message, index) => [message, ...(inserts.get(index) ?? [])]);
}

function replayAnchorKey(message: AIMessage): string {
  return `${message.role}:${runtimeMessagePlainText(message.content)}`;
}

function replayMessageKey(message: AIMessage | undefined): string {
  return JSON.stringify(message);
}

function isReplayHistoryMessage(value: unknown): value is AIMessage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const role = (value as Record<string, unknown>).role;
  return role === 'system' || role === 'user' || role === 'assistant' || role === 'tool';
}

function canonicalizeReplayHistoryMessage(message: AIMessage): AIMessage {
  if (
    (message.role === 'tool' || (message.tool_calls?.length ?? 0) > 0) &&
    message.canonical_message_version !== CANONICAL_MESSAGE_SERIALIZATION_VERSION
  ) {
    return {
      ...message,
      canonical_message_version: CANONICAL_MESSAGE_SERIALIZATION_VERSION
    };
  }
  return message;
}

const RESPONSE_ID_PREFIX = 'resp_';
const COMPLETION_ID_PREFIX = 'chatcmpl-';
const MESSAGE_ID_PREFIX = 'msg_';

export function extractProviderResponseId(payload: Record<string, unknown>): string | undefined {
  return extractProviderContextIds(payload).responseId;
}

export function extractProviderContextIds(payload: Record<string, unknown>): {
  completionId?: string;
  messageId?: string;
  responseId?: string;
} {
  const direct = payload.id ?? payload.response_id;
  if (typeof direct === 'string') {
    if (direct.startsWith(RESPONSE_ID_PREFIX)) return { responseId: direct };
    if (direct.startsWith(COMPLETION_ID_PREFIX)) return { completionId: direct };
    if (direct.startsWith(MESSAGE_ID_PREFIX)) return { messageId: direct };
  }

  const response = payload.response;
  if (response && typeof response === 'object') {
    const nested = (response as Record<string, unknown>).id;
    if (typeof nested === 'string') {
      if (nested.startsWith(RESPONSE_ID_PREFIX)) return { responseId: nested };
      if (nested.startsWith(COMPLETION_ID_PREFIX)) return { completionId: nested };
      if (nested.startsWith(MESSAGE_ID_PREFIX)) return { messageId: nested };
    }
  }

  const message = payload.message;
  if (message && typeof message === 'object') {
    const nested = (message as Record<string, unknown>).id;
    if (typeof nested === 'string' && nested.startsWith(MESSAGE_ID_PREFIX)) {
      return { messageId: nested };
    }
  }

  return {};
}

export function resolveResponseCacheFromSessions(
  sessions: AgentSession[],
  model: string,
  providerId: string,
  cacheKey?: string,
  responseInputFingerprint?: string
): ProviderContextCacheEntry | undefined {
  const sorted = [...sessions].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const session of [...sorted].reverse()) {
    if (session.status !== 'succeeded' && session.status !== 'archived') continue;

    const metadata = session.metadata ?? {};
    const responseId = readMetadataString(metadata.providerResponseId);
    const completionId = readMetadataString(metadata.providerCompletionId);
    const messageId = readMetadataString(metadata.providerMessageId);
    const sessionModel = readMetadataString(metadata.model);
    const sessionProvider = readMetadataString(metadata.providerId);
    const cacheNamespace = readMetadataString(metadata.providerCacheNamespace);
    const persistedFingerprint =
      readMetadataString(metadata.responseInputFingerprint) ??
      readMetadataString(metadata.turnContextFingerprint);
    // Prefer the canonical namespace-derived key. Fall back to legacy
    // `sessionId:model:providerId` metadata for older sessions only.
    const sessionCacheKey =
      readMetadataString(metadata.providerCacheKey) ??
      (cacheNamespace ? derivePromptCacheKey(cacheNamespace) : undefined) ??
      cacheKey;
    if (!sessionModel || !sessionProvider) continue;
    if (!responseId && !completionId && !messageId) continue;

    if (sessionModel === model && sessionProvider === providerId) {
      const canReuseProviderContextIds =
        Boolean(responseInputFingerprint) &&
        Boolean(persistedFingerprint) &&
        persistedFingerprint === responseInputFingerprint;
      return {
        responseId: canReuseProviderContextIds ? responseId : undefined,
        completionId: canReuseProviderContextIds ? completionId : undefined,
        messageId: canReuseProviderContextIds ? messageId : undefined,
        model: sessionModel,
        providerId: sessionProvider,
        sessionId: session.sessionId,
        endpoint: readMetadataString(metadata.providerEndpoint),
        reasoningMode: readMetadataString(metadata.providerReasoningMode),
        cacheNamespace,
        cacheKey: sessionCacheKey,
        responseInputFingerprint: persistedFingerprint
      };
    }

    return undefined;
  }
  return undefined;
}

/**
 * @deprecated Prefer `derivePromptCacheKey(contract.cacheNamespace)`.
 * Legacy helper kept for test compatibility and old metadata reads.
 */
export function buildPromptCacheKey(
  sessionId: string,
  model?: string,
  providerId?: string
): string {
  const parts = [sessionId.trim()];
  if (model?.trim()) parts.push(model.trim());
  if (providerId?.trim()) parts.push(providerId.trim());
  return parts.join(':');
}

/** Build durable metadata patch for a successful provider response. */
export function buildProviderCacheMetadataPatch(input: {
  responseId: string;
  contract?: PromptCacheContract;
  agentModel?: string;
  agentProviderId?: string;
  responseInputFingerprint?: string;
}): Record<string, unknown> {
  const kind = classifyProviderContextId(input.responseId);
  const idPatch =
    kind === 'completion'
      ? { providerCompletionId: input.responseId }
      : kind === 'message'
        ? { providerMessageId: input.responseId }
        : { providerResponseId: input.responseId };

  const model = input.contract?.model ?? input.agentModel;
  const providerId = input.contract?.providerId ?? input.agentProviderId;
  const cacheNamespace = input.contract?.cacheNamespace;
  const cacheKey =
    input.contract?.cacheKey ?? (cacheNamespace ? derivePromptCacheKey(cacheNamespace) : undefined);

  return {
    ...idPatch,
    ...(model ? { model } : {}),
    ...(providerId ? { providerId } : {}),
    ...(cacheNamespace ? { providerCacheNamespace: cacheNamespace } : {}),
    ...(cacheKey ? { providerCacheKey: cacheKey } : {}),
    ...(input.contract?.endpoint ? { providerEndpoint: input.contract.endpoint } : {}),
    ...(input.contract?.reasoningMode
      ? { providerReasoningMode: input.contract.reasoningMode }
      : {}),
    ...(input.responseInputFingerprint
      ? {
          responseInputFingerprint: input.responseInputFingerprint,
          turnContextFingerprint: input.responseInputFingerprint
        }
      : {})
  };
}

/** Read a previously pinned endpoint for the same session affinity. */
export function resolvePinnedSessionEndpoint(
  sessions: AgentSession[],
  model: string,
  providerId: string
): string | undefined {
  const sorted = [...sessions].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const session of [...sorted].reverse()) {
    const metadata = session.metadata ?? {};
    const sessionModel = readMetadataString(metadata.model);
    const sessionProvider = readMetadataString(metadata.providerId);
    if (sessionModel !== model || sessionProvider !== providerId) continue;
    const endpoint = readMetadataString(metadata.providerEndpoint);
    if (endpoint && endpoint !== 'auto' && endpoint !== 'default') return endpoint;
  }
  return undefined;
}

export function buildResponseCacheRequest(
  messages: AIMessage[],
  cacheEntry: ProviderContextCacheEntry | undefined,
  options?: {
    cacheKey?: string;
    enableStore?: boolean;
    roundIndex?: number;
    contract?: PromptCacheContract;
  }
): ResponseCacheRequest | undefined {
  const enableStore = options?.enableStore !== false;
  if (!enableStore) return undefined;

  const cacheNamespace = options?.contract?.cacheNamespace ?? cacheEntry?.cacheNamespace;
  const cacheKey =
    options?.cacheKey ??
    options?.contract?.cacheKey ??
    (cacheNamespace ? derivePromptCacheKey(cacheNamespace) : undefined) ??
    cacheEntry?.cacheKey;
  // HTTP SSE cannot use previous_response_id on many gateways (WebSocket v2 only).
  // Context continuity relies on full merged messages + prompt_cache_key.
  void messages;
  return {
    enableStore: true,
    cacheKey,
    sessionId: options?.contract?.sessionId ?? cacheEntry?.sessionId,
    ...(options?.contract
      ? {
          cacheContractVersion: options.contract.contractVersion,
          cacheEligibility: options.contract.cacheEligibility,
          cacheNamespace: options.contract.cacheNamespace,
          cacheDisableReason: options.contract.cacheDisableReason,
          stablePrefixHash: options.contract.stablePrefixHash,
          providerId: options.contract.providerId,
          model: options.contract.model,
          endpoint: options.contract.endpoint,
          reasoningMode: options.contract.reasoningMode,
          cachePolicy: options.contract.cachePolicy,
          cacheMode: options.contract.cacheMode
        }
      : {})
  };
}

/** Strip reasoning parts so API history matches plain assistant text (stable cache prefix). */
export function normalizeRuntimeMessageContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) {
    if (content == null) return '';
    try {
      return JSON.stringify(content);
    } catch {
      return String(content);
    }
  }

  const textParts = content
    .map((part) => {
      if (!part || typeof part !== 'object') return '';
      const record = part as Record<string, unknown>;
      const kind = record.kind ?? record.type;
      if (kind === 'text' && typeof record.text === 'string') return record.text;
      return '';
    })
    .filter((text) => text.length > 0);

  if (textParts.length > 0) return textParts.join('\n\n');
  return '';
}

export function extractChainedResponsesInput(
  messages: AIMessage[]
): Array<Record<string, unknown>> {
  const lastUser = messages.filter((message) => message.role === 'user').at(-1);
  const content = runtimeMessagePlainText(lastUser?.content ?? '').trim();
  if (!content) return [];
  return [{ role: 'user', content }];
}

export function resolveResponsesChainId(cache?: ResponseCacheRequest): string | undefined {
  const chainId = resolveProviderChainId(cache);
  if (!chainId?.startsWith(RESPONSE_ID_PREFIX)) return undefined;
  return chainId;
}

export function resolveProviderChainId(cache?: ResponseCacheRequest): string | undefined {
  if (!cache) return undefined;
  return (
    cache.previousContextId ??
    cache.previousResponseId ??
    cache.previousCompletionId ??
    cache.previousMessageId
  );
}

function isCanonicalRuntimeHistory(messages: AIMessage[]): boolean {
  return messages.every((message) => {
    if (message.role === 'user') return true;
    return message.canonical_message_version === CANONICAL_MESSAGE_SERIALIZATION_VERSION;
  });
}

export function pickRicherRuntimeHistory(
  sessionHistory: AIMessage[],
  clientHistory: AIMessage[]
): AIMessage[] {
  if (clientHistory.length === 0) return sessionHistory;
  if (sessionHistory.length === 0) return clientHistory;
  const clientIsCanonical = isCanonicalRuntimeHistory(clientHistory);
  if (clientHistory.length >= sessionHistory.length && clientIsCanonical) {
    return clientHistory;
  }
  return sessionHistory;
}

export function classifyProviderContextId(
  id: string
): 'completion' | 'message' | 'response' | undefined {
  if (id.startsWith(RESPONSE_ID_PREFIX)) return 'response';
  if (id.startsWith(COMPLETION_ID_PREFIX)) return 'completion';
  if (id.startsWith(MESSAGE_ID_PREFIX)) return 'message';
  return undefined;
}

function readMetadataString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}
