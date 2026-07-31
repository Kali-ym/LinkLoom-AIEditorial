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
  cacheScope: PromptCacheScope;
  cachePolicy: PromptCachePolicy;
  cacheMode: PromptCacheRuntimeMode;
  cacheEligibility: boolean;
  cacheDisableReason?: string;
  capability: PromptCacheCapability;
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
  sensitiveStablePrefix?: boolean;
  unsafeReasons?: string[];
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
  const sessionId = input.sessionId?.trim();
  const cacheScope: PromptCacheScope = input.sensitiveStablePrefix ? 'session' : 'global';

  if (input.cacheRequested === false) unsafeReasons.push('cache_disabled');
  if (!input.capability.supportsPromptCache) {
    unsafeReasons.push(input.capability.reason ?? 'provider_prompt_cache_unsupported');
  }
  if (cacheScope === 'session' && !sessionId) {
    unsafeReasons.push('session_id_required_for_sensitive_prefix');
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
    cacheNamespace: namespaceParts.join(':'),
    cacheScope,
    cachePolicy: input.cachePolicy ?? 'isolated',
    cacheMode: input.cacheMode ?? 'enforced',
    cacheEligibility: unsafeReasons.length === 0,
    cacheDisableReason: unsafeReasons.length > 0 ? unsafeReasons.join(';') : undefined,
    capability: input.capability
  };
}

function normalizePart(value: string | undefined, fallback: string): string {
  const normalized = value?.trim();
  if (!normalized) return fallback;
  return normalized.replace(/[^a-zA-Z0-9._-]/g, '_');
}
