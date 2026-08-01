import { hashString, stableStringify } from './canonicalMessageSerializer.js';
import type { PromptCacheCapability } from './promptCacheCapabilities.js';

export const PROMPT_CACHE_CONTRACT_VERSION = 'prompt-cache-v1' as const;
export const PROMPT_CACHE_PROMPT_SCHEMA_VERSION = 'prompt-schema-v1' as const;
export const PROMPT_CACHE_HISTORY_SERIALIZATION_VERSION = 'canonical-history-v1' as const;

export type PromptCacheClass = 'stable' | 'variant' | 'dynamic';
export type PromptCacheScope = 'global' | 'session';
export type PromptCachePolicy = 'isolated' | 'derived' | 'inherit';
export type PromptCacheRuntimeMode = 'shadow' | 'enforced' | 'disabled';

export interface PromptCacheContract {
  contractVersion: typeof PROMPT_CACHE_CONTRACT_VERSION;
  promptSchemaVersion: string;
  historySerializationVersion: string;
  providerId: string;
  model: string;
  endpoint: string;
  reasoningMode: string;
  stablePrefixHash: string;
  variantHash: string;
  toolsetHash: string;
  cacheNamespace: string;
  /** Deterministic provider key derived from cacheNamespace (max 64 chars). */
  cacheKey: string;
  cacheScope: PromptCacheScope;
  cachePolicy: PromptCachePolicy;
  cacheMode: PromptCacheRuntimeMode;
  cacheEligibility: boolean;
  cacheDisableReason?: string;
  capability: PromptCacheCapability;
  sessionId?: string;
}

export interface PromptCacheContractInput {
  providerId: string;
  model: string;
  endpoint?: string;
  reasoningMode?: string;
  stablePrefix: string;
  variantParts?: unknown[];
  toolset?: unknown;
  promptSchemaVersion?: string;
  historySerializationVersion?: string;
  capability: PromptCacheCapability;
  cacheRequested?: boolean;
  cachePolicy?: PromptCachePolicy;
  cacheMode?: PromptCacheRuntimeMode;
  sessionId?: string;
  /**
   * Explicit scope override. Default is session isolation when a sessionId is
   * present; callers without a session must opt into `global` (or accept
   * ineligibility via `session_id_required`).
   */
  cacheScope?: PromptCacheScope;
  sensitiveStablePrefix?: boolean;
  unsafeReasons?: string[];
}

/** Derive the bounded provider-facing prompt_cache_key from a namespace. */
export function derivePromptCacheKey(cacheNamespace: string): string {
  return hashString(cacheNamespace, 64);
}

export function buildPromptCacheContract(input: PromptCacheContractInput): PromptCacheContract {
  const providerId = normalizePart(input.providerId, 'unknown');
  const model = normalizePart(input.model, 'default');
  const endpoint = normalizePart(input.endpoint, 'default');
  const reasoningMode = normalizePart(input.reasoningMode, 'none');
  const promptSchemaVersion = input.promptSchemaVersion ?? PROMPT_CACHE_PROMPT_SCHEMA_VERSION;
  const historySerializationVersion =
    input.historySerializationVersion ?? PROMPT_CACHE_HISTORY_SERIALIZATION_VERSION;
  const toolsetHash = hashString(stableStringify(input.toolset ?? { tools: [] }));
  const variantHash = hashString(
    stableStringify({
      contractVersion: PROMPT_CACHE_CONTRACT_VERSION,
      providerId,
      model,
      endpoint,
      reasoningMode,
      promptSchemaVersion,
      variantParts: input.variantParts ?? [],
      toolsetHash
    })
  );
  const stablePrefixHash = hashString(input.stablePrefix);

  const unsafeReasons = [...(input.unsafeReasons ?? [])];
  const sessionId = input.sessionId?.trim() || undefined;
  const cacheScope: PromptCacheScope = resolveCacheScope(input, sessionId);

  if (input.cacheRequested === false) unsafeReasons.push('cache_disabled');
  if (!input.capability.supportsPromptCache) {
    unsafeReasons.push(input.capability.reason ?? 'provider_prompt_cache_unsupported');
  }
  if (cacheScope === 'session' && !sessionId) {
    unsafeReasons.push('session_id_required');
  }

  const namespaceParts = [
    'pc',
    'v1',
    cacheScope === 'session' ? 'session' : 'global',
    ...(cacheScope === 'session' && sessionId ? [sessionId] : []),
    providerId,
    model,
    endpoint,
    reasoningMode,
    promptSchemaVersion,
    stablePrefixHash,
    variantHash
  ].map((part) => normalizePart(part, 'unknown'));

  const cacheNamespace = namespaceParts.join(':');

  return {
    contractVersion: PROMPT_CACHE_CONTRACT_VERSION,
    promptSchemaVersion,
    historySerializationVersion,
    providerId,
    model,
    endpoint,
    reasoningMode,
    stablePrefixHash,
    variantHash,
    toolsetHash,
    cacheNamespace,
    cacheKey: derivePromptCacheKey(cacheNamespace),
    cacheScope,
    cachePolicy: input.cachePolicy ?? 'isolated',
    cacheMode: input.cacheMode ?? 'enforced',
    cacheEligibility: unsafeReasons.length === 0,
    cacheDisableReason: unsafeReasons.length > 0 ? unsafeReasons.join(';') : undefined,
    capability: input.capability,
    sessionId
  };
}

function resolveCacheScope(
  input: PromptCacheContractInput,
  sessionId: string | undefined
): PromptCacheScope {
  if (input.sensitiveStablePrefix) return 'session';
  if (input.cacheScope) return input.cacheScope;
  // Pi-style default: isolate by session whenever a session id is available.
  if (sessionId) return 'session';
  // Temporary / sessionless calls must opt into global explicitly.
  return 'session';
}

function normalizePart(value: string | undefined, fallback: string): string {
  const normalized = value?.trim();
  if (!normalized) return fallback;
  return normalized.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/** Best-effort rehydrate of a persisted prompt cache contract from session metadata. */
export function readPromptCacheContract(value: unknown): PromptCacheContract | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.cacheNamespace !== 'string' || !record.cacheNamespace.trim()) return undefined;
  const cacheNamespace = record.cacheNamespace.trim();
  return {
    contractVersion: PROMPT_CACHE_CONTRACT_VERSION,
    promptSchemaVersion:
      typeof record.promptSchemaVersion === 'string'
        ? record.promptSchemaVersion
        : PROMPT_CACHE_PROMPT_SCHEMA_VERSION,
    historySerializationVersion:
      typeof record.historySerializationVersion === 'string'
        ? record.historySerializationVersion
        : PROMPT_CACHE_HISTORY_SERIALIZATION_VERSION,
    providerId: String(record.providerId ?? 'unknown'),
    model: String(record.model ?? 'default'),
    endpoint: String(record.endpoint ?? 'default'),
    reasoningMode: String(record.reasoningMode ?? 'none'),
    stablePrefixHash: String(record.stablePrefixHash ?? ''),
    variantHash: String(record.variantHash ?? ''),
    toolsetHash: String(record.toolsetHash ?? ''),
    cacheNamespace,
    cacheKey:
      typeof record.cacheKey === 'string' && record.cacheKey.trim()
        ? record.cacheKey.trim()
        : derivePromptCacheKey(cacheNamespace),
    cacheScope: record.cacheScope === 'global' ? 'global' : 'session',
    cachePolicy:
      record.cachePolicy === 'derived' || record.cachePolicy === 'inherit'
        ? record.cachePolicy
        : 'isolated',
    cacheMode:
      record.cacheMode === 'shadow' || record.cacheMode === 'disabled'
        ? record.cacheMode
        : 'enforced',
    cacheEligibility: record.cacheEligibility !== false,
    cacheDisableReason:
      typeof record.cacheDisableReason === 'string' ? record.cacheDisableReason : undefined,
    capability:
      record.capability && typeof record.capability === 'object'
        ? (record.capability as PromptCacheCapability)
        : {
            supportsPromptCache: true,
            supportsExplicitBreakpoint: false,
            supportsCacheNamespace: true,
            reportsCacheRead: true,
            reportsCacheWrite: false,
            family: 'unknown'
          },
    sessionId: typeof record.sessionId === 'string' ? record.sessionId : undefined
  };
}
