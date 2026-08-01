import type { AgentSession } from './AgentSession.js';
import type { AIMessage } from '../../../types/index.js';
import { runtimeMessagePlainText } from '../userTurnRuntime.js';
import {
  derivePromptCacheKey,
  type PromptCacheContract
} from './promptCacheContract.js';

export type ProviderContextCacheEntry = {
  cacheKey?: string;
  cacheNamespace?: string;
  completionId?: string;
  messageId?: string;
  model: string;
  providerId: string;
  endpoint?: string;
  reasoningMode?: string;
  responseId?: string;
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
  endpoint?: string;
  reasoningMode?: string;
  cachePolicy?: PromptCacheContract['cachePolicy'];
  cacheMode?: PromptCacheContract['cacheMode'];
  incrementalInput?: Array<Record<string, unknown>>;
  incrementalMessages?: AIMessage[];
  /** Any provider context id for within-run chaining (round 2+, Responses API only). */
  previousContextId?: string;
  previousCompletionId?: string;
  previousMessageId?: string;
  previousResponseId?: string;
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
): ProviderContextCacheEntry | undefined {
  const sorted = [...sessions].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const session = sorted[index]!;
    if (session.status !== 'succeeded' && session.status !== 'archived') continue;

    const metadata = session.metadata ?? {};
    const responseId = readMetadataString(metadata.providerResponseId);
    const completionId = readMetadataString(metadata.providerCompletionId);
    const messageId = readMetadataString(metadata.providerMessageId);
    const sessionModel = readMetadataString(metadata.model);
    const sessionProvider = readMetadataString(metadata.providerId);
    const cacheNamespace = readMetadataString(metadata.providerCacheNamespace);
    // Prefer the canonical namespace-derived key. Fall back to legacy
    // `sessionId:model:providerId` metadata for older sessions only.
    const sessionCacheKey =
      readMetadataString(metadata.providerCacheKey) ??
      (cacheNamespace ? derivePromptCacheKey(cacheNamespace) : undefined) ??
      cacheKey;
    if (!sessionModel || !sessionProvider) continue;
    if (!responseId && !completionId && !messageId) continue;

    if (sessionModel === model && sessionProvider === providerId) {
      return {
        responseId,
        completionId,
        messageId,
        model: sessionModel,
        providerId: sessionProvider,
        endpoint: readMetadataString(metadata.providerEndpoint),
        reasoningMode: readMetadataString(metadata.providerReasoningMode),
        cacheNamespace,
        cacheKey: sessionCacheKey,
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
  providerId?: string,
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
    input.contract?.cacheKey ??
    (cacheNamespace ? derivePromptCacheKey(cacheNamespace) : undefined);

  return {
    ...idPatch,
    ...(model ? { model } : {}),
    ...(providerId ? { providerId } : {}),
    ...(cacheNamespace ? { providerCacheNamespace: cacheNamespace } : {}),
    ...(cacheKey ? { providerCacheKey: cacheKey } : {}),
    ...(input.contract?.endpoint ? { providerEndpoint: input.contract.endpoint } : {}),
    ...(input.contract?.reasoningMode
      ? { providerReasoningMode: input.contract.reasoningMode }
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
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const metadata = sorted[index]!.metadata ?? {};
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
  },
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
    ...(options?.contract
      ? {
          cacheContractVersion: options.contract.contractVersion,
          cacheEligibility: options.contract.cacheEligibility,
          cacheNamespace: options.contract.cacheNamespace,
          cacheDisableReason: options.contract.cacheDisableReason,
          providerId: options.contract.providerId,
          model: options.contract.model,
          endpoint: options.contract.endpoint,
          reasoningMode: options.contract.reasoningMode,
          cachePolicy: options.contract.cachePolicy,
          cacheMode: options.contract.cacheMode,
        }
      : {}),
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
  messages: AIMessage[],
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

export function pickRicherRuntimeHistory(
  sessionHistory: AIMessage[],
  clientHistory: AIMessage[],
): AIMessage[] {
  if (clientHistory.length === 0) return sessionHistory;
  if (sessionHistory.length === 0) return clientHistory;
  return clientHistory.length >= sessionHistory.length ? clientHistory : sessionHistory;
}

export function classifyProviderContextId(
  id: string,
): 'completion' | 'message' | 'response' | undefined {
  if (id.startsWith(RESPONSE_ID_PREFIX)) return 'response';
  if (id.startsWith(COMPLETION_ID_PREFIX)) return 'completion';
  if (id.startsWith(MESSAGE_ID_PREFIX)) return 'message';
  return undefined;
}

function readMetadataString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}
