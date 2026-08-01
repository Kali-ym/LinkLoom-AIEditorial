/**
 * Pi-style prompt-cache miss diagnostics.
 *
 * Scope boundaries (do not conflate):
 * - per-call: a single model response's `usage.prompt_cache` fields
 * - per-run: providerGovernance ledger accumulation within one agent run
 * - per-session: scan of successive model calls across runs in a session
 *
 * Cached token counts are NOT required to be monotonically increasing. Provider
 * TTL/LRU jitter is treated as noise unless a previous call already reported
 * cache activity and the current call re-bills a meaningful prefix.
 */

/** Idle gaps longer than this are worth mentioning (Anthropic default TTL). */
export const PROMPT_CACHE_TTL_MS = 5 * 60 * 1000;

/** Misses at or below this are cache-breakpoint granularity noise. */
export const PROMPT_CACHE_MISS_NOISE_FLOOR_TOKENS = 1024;

export type PromptCacheDiagnosticCall = {
  promptTokens: number;
  cachedInputTokens: number;
  cacheWriteInputTokens: number;
  model?: string;
  providerId?: string;
  endpoint?: string;
  timestampMs?: number;
  turnContextFingerprint?: string;
  sourceErrors?: Array<{ source: string; code: string }>;
  conversionDiagnostics?: string[];
  /** True when this call followed a context compaction / summary rewrite. */
  afterCompaction?: boolean;
};

export interface PromptCacheObservation {
  turnContextFingerprint?: string;
  sourceErrors?: Array<{ source: string; code: string }>;
  conversionDiagnostics?: string[];
  ephemeralMessageCount?: number;
}

export type PromptCacheSessionMissReason =
  | 'turn_context_changed'
  | 'turn_context_source_failed'
  | 'context_conversion_unsupported';

export type PromptCacheMissDiagnosis = {
  missedTokens: number;
  idleMs: number;
  modelChanged: boolean;
  endpointChanged: boolean;
  reason: 'significant_miss' | 'model_changed' | 'endpoint_changed' | 'idle_ttl_exceeded';
};

export type PromptCacheObservationBaseline = {
  promptTokens: number;
  modelKey: string;
  endpointKey: string;
  timestampMs: number;
  /** Sticky: some earlier call in this segment reported cache activity. */
  reportedCache: boolean;
};

function modelKey(call: PromptCacheDiagnosticCall): string {
  return `${call.providerId ?? 'unknown'}/${call.model ?? 'unknown'}`;
}

function endpointKey(call: PromptCacheDiagnosticCall): string {
  return call.endpoint?.trim() || 'default';
}

/**
 * Compare one call against the previous baseline. Returns undefined when the
 * observation is not actionable (first call, reset, unsupported provider, noise).
 */
export function diagnosePromptCacheMiss(
  previous: PromptCacheObservationBaseline | undefined,
  call: PromptCacheDiagnosticCall
): PromptCacheMissDiagnosis | undefined {
  if (call.afterCompaction) return undefined;
  const promptTokens = Math.max(0, call.promptTokens);
  const cacheRead = Math.max(0, call.cachedInputTokens);
  const cacheWrite = Math.max(0, call.cacheWriteInputTokens);
  if (
    !previous ||
    promptTokens <= 0 ||
    (cacheRead + cacheWrite === 0 && !previous.reportedCache)
  ) {
    return undefined;
  }

  const missedTokens = Math.min(previous.promptTokens, promptTokens) - cacheRead;
  if (missedTokens <= PROMPT_CACHE_MISS_NOISE_FLOOR_TOKENS) return undefined;

  const idleMs = Math.max(0, (call.timestampMs ?? 0) - previous.timestampMs);
  const modelChanged = modelKey(call) !== previous.modelKey;
  const endpointChanged = endpointKey(call) !== previous.endpointKey;

  let reason: PromptCacheMissDiagnosis['reason'] = 'significant_miss';
  if (modelChanged) reason = 'model_changed';
  else if (endpointChanged) reason = 'endpoint_changed';
  else if (idleMs >= PROMPT_CACHE_TTL_MS) reason = 'idle_ttl_exceeded';

  return {
    missedTokens,
    idleMs,
    modelChanged,
    endpointChanged,
    reason
  };
}

/** Advance the comparison baseline; resets after compaction or route changes. */
export function advancePromptCacheObservationBaseline(
  previous: PromptCacheObservationBaseline | undefined,
  call: PromptCacheDiagnosticCall
): PromptCacheObservationBaseline | undefined {
  if (call.afterCompaction) return undefined;

  const promptTokens = Math.max(0, call.promptTokens);
  if (promptTokens <= 0) return previous;

  const cacheActivity =
    Math.max(0, call.cachedInputTokens) + Math.max(0, call.cacheWriteInputTokens) > 0;

  return {
    promptTokens,
    modelKey: modelKey(call),
    endpointKey: endpointKey(call),
    timestampMs: call.timestampMs ?? previous?.timestampMs ?? 0,
    reportedCache: (previous?.reportedCache ?? false) || cacheActivity
  };
}

export type PromptCacheSessionScanResult = {
  missCount: number;
  missedTokens: number;
  diagnoses: PromptCacheMissDiagnosis[];
  sessionMissReasons: PromptCacheSessionMissReason[];
};

function collectSessionMissReasons(call: PromptCacheDiagnosticCall): PromptCacheSessionMissReason[] {
  const reasons: PromptCacheSessionMissReason[] = [];
  if (call.sourceErrors?.some((error) => error.code === 'unavailable')) {
    reasons.push('turn_context_source_failed');
  }
  if (call.conversionDiagnostics?.includes('context_conversion_unsupported')) {
    reasons.push('context_conversion_unsupported');
  }
  return reasons;
}

/** Scan an ordered list of per-call observations for a session. */
export function scanPromptCacheSessionDiagnostics(
  calls: PromptCacheDiagnosticCall[]
): PromptCacheSessionScanResult {
  let previous: PromptCacheObservationBaseline | undefined;
  let previousFingerprint: string | undefined;
  const diagnoses: PromptCacheMissDiagnosis[] = [];
  const sessionMissReasons: PromptCacheSessionMissReason[] = [];
  let missedTokens = 0;

  for (const call of calls) {
    if (call.afterCompaction) {
      previous = undefined;
      previousFingerprint = undefined;
      continue;
    }
    if (
      previousFingerprint &&
      call.turnContextFingerprint &&
      previousFingerprint !== call.turnContextFingerprint
    ) {
      sessionMissReasons.push('turn_context_changed');
    }
    if (call.turnContextFingerprint) {
      previousFingerprint = call.turnContextFingerprint;
    }
    for (const reason of collectSessionMissReasons(call)) {
      if (!sessionMissReasons.includes(reason)) {
        sessionMissReasons.push(reason);
      }
    }
    const diagnosis = diagnosePromptCacheMiss(previous, call);
    if (diagnosis) {
      diagnoses.push(diagnosis);
      missedTokens += diagnosis.missedTokens;
    }
    previous = advancePromptCacheObservationBaseline(previous, call);
  }

  return {
    missCount: diagnoses.length,
    missedTokens,
    diagnoses,
    sessionMissReasons
  };
}
