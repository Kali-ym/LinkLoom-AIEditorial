import type {
  ProviderGovernanceConfig,
  ProviderGovernanceQuotaConfig,
  ProviderGovernanceRetryConfig,
  ProviderModelCostConfig
} from '../../types/config.js';
import type { AIMessage, AIResponse, AIUsage } from '../../types/index.js';
import type { AIProvider, AIProviderCallOptions } from '../AIProvider.js';
import type { AgentBudgetPolicy } from './engine/AgentRunSpec.js';
import type { ResponseCacheRequest } from './engine/responseContextCache.js';

export interface ProviderGovernanceCandidate {
  provider: AIProvider;
  providerId?: string;
  providerName?: string;
  model?: string;
  capabilities?: string[];
  cost?: ProviderModelCostConfig;
}

export interface ProviderGovernanceOptions {
  primary: ProviderGovernanceCandidate;
  fallbacks?: ProviderGovernanceCandidate[];
  policy?: ProviderGovernanceConfig;
  budgetPolicy?: AgentBudgetPolicy;
  runId?: string;
  sessionId?: string;
  enabled?: boolean;
  initialLedger?: Partial<ProviderGovernanceLedger>;
  healthStore?: ProviderGovernanceHealthStore;
}

export interface ProviderGovernanceHealthSnapshot {
  key: string;
  failures: number;
  unhealthyUntil?: string;
  lastError?: string;
  lastFailureAt?: string;
  lastSuccessAt?: string;
}

export interface ProviderGovernanceHealthStore {
  isHealthy(key: string, now?: number): boolean;
  recordSuccess(key: string, now?: number): void;
  recordFailure(key: string, error: unknown, policy?: ProviderGovernanceConfig['health'], now?: number): void;
  snapshot(keys?: string[]): ProviderGovernanceHealthSnapshot[];
}

export interface ProviderGovernanceLedger {
  modelCalls: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachedInputTokens: number;
  cacheWriteInputTokens: number;
  uncachedInputTokens: number;
  estimatedCostUsd: number;
  estimatedCacheSavingsUsd: number;
}

export interface ProviderGovernanceAttemptTrace {
  providerId?: string;
  providerName?: string;
  model?: string;
  attempt: number;
  candidateIndex: number;
  status: 'ok' | 'error' | 'skipped_unhealthy';
  durationMs: number;
  error?: string;
}

export interface ProviderGovernanceResponseMetadata {
  callId: string;
  runId?: string;
  sessionId?: string;
  selectedProviderId?: string;
  selectedProviderName?: string;
  selectedModel?: string;
  fallbackUsed: boolean;
  retryCount: number;
  attempts: ProviderGovernanceAttemptTrace[];
  capabilities?: string[];
  budget: {
    cumulative: ProviderGovernanceLedger;
    limits: ResolvedProviderGovernanceLimits;
    exceeded: ProviderGovernanceBudgetExceededCode[];
  };
  health: ProviderGovernanceHealthSnapshot[];
}

export type ProviderGovernanceBudgetExceededCode =
  | 'max_model_calls'
  | 'max_input_tokens'
  | 'max_output_tokens'
  | 'max_cost_usd'
  | 'timeout';

export type ResolvedProviderGovernanceLimits = Pick<
  AgentBudgetPolicy,
  'maxModelCalls' | 'maxInputTokens' | 'maxOutputTokens' | 'timeoutMs' | 'maxCostUsd'
>;

export class ProviderGovernanceBudgetError extends Error {
  readonly code = 'PROVIDER_GOVERNANCE_BUDGET_EXCEEDED';
  readonly providerGovernance: {
    budgetExceeded: true;
    exceeded: ProviderGovernanceBudgetExceededCode[];
    limits: ResolvedProviderGovernanceLimits;
    cumulative: ProviderGovernanceLedger;
  };

  constructor(
    exceeded: ProviderGovernanceBudgetExceededCode[],
    limits: ResolvedProviderGovernanceLimits,
    cumulative: ProviderGovernanceLedger
  ) {
    super(`Provider governance budget exceeded: ${exceeded.join(', ')}`);
    this.name = 'ProviderGovernanceBudgetError';
    this.providerGovernance = {
      budgetExceeded: true,
      exceeded,
      limits,
      cumulative
    };
  }
}

export function isProviderGovernanceBudgetError(
  error: unknown
): error is ProviderGovernanceBudgetError {
  if (error instanceof ProviderGovernanceBudgetError) return true;
  if (!error || typeof error !== 'object') return false;
  const marker = (error as { providerGovernance?: { budgetExceeded?: unknown } }).providerGovernance;
  return marker?.budgetExceeded === true;
}

export function providerGovernanceBudgetErrorToUsage(
  error: ProviderGovernanceBudgetError
): AIUsage {
  return {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
    estimated_cost_usd: error.providerGovernance.cumulative.estimatedCostUsd,
    governance: {
      budget: {
        cumulative: error.providerGovernance.cumulative,
        limits: error.providerGovernance.limits,
        exceeded: error.providerGovernance.exceeded
      }
    }
  };
}

class InMemoryProviderGovernanceHealthStore implements ProviderGovernanceHealthStore {
  private readonly state = new Map<string, ProviderGovernanceHealthSnapshot>();

  isHealthy(key: string, now = Date.now()): boolean {
    const current = this.state.get(key);
    if (!current?.unhealthyUntil) return true;
    const until = new Date(current.unhealthyUntil).getTime();
    return !Number.isFinite(until) || until <= now;
  }

  recordSuccess(key: string, now = Date.now()): void {
    const current = this.state.get(key) ?? { key, failures: 0 };
    this.state.set(key, {
      ...current,
      failures: 0,
      unhealthyUntil: undefined,
      lastSuccessAt: new Date(now).toISOString()
    });
  }

  recordFailure(
    key: string,
    error: unknown,
    policy?: ProviderGovernanceConfig['health'],
    now = Date.now()
  ): void {
    const current = this.state.get(key) ?? { key, failures: 0 };
    const failures = current.failures + 1;
    const failureThreshold = normalizePositiveInteger(policy?.failureThreshold) ?? 2;
    const cooldownMs = normalizeNonNegativeNumber(policy?.cooldownMs) ?? 30_000;
    this.state.set(key, {
      ...current,
      failures,
      lastError: errorToMessage(error),
      lastFailureAt: new Date(now).toISOString(),
      unhealthyUntil:
        failures >= failureThreshold && cooldownMs > 0
          ? new Date(now + cooldownMs).toISOString()
          : current.unhealthyUntil
    });
  }

  snapshot(keys?: string[]): ProviderGovernanceHealthSnapshot[] {
    const wanted = keys?.length ? new Set(keys) : undefined;
    return [...this.state.values()]
      .filter((item) => !wanted || wanted.has(item.key))
      .map((item) => ({ ...item }));
  }
}

const defaultHealthStore = new InMemoryProviderGovernanceHealthStore();

export function createProviderGovernanceHealthStore(): ProviderGovernanceHealthStore {
  return new InMemoryProviderGovernanceHealthStore();
}

export function createProviderGovernanceProvider(options: ProviderGovernanceOptions): AIProvider {
  const fallbacks = options.fallbacks ?? [];
  const limits = resolveProviderGovernanceLimits(options.budgetPolicy, options.policy?.quotas);
  const active = shouldEnableGovernance(options, limits, fallbacks);
  if (!active) return options.primary.provider;

  const healthStore = options.healthStore ?? defaultHealthStore;
  const ledger: ProviderGovernanceLedger = {
    modelCalls: normalizeNonNegativeInteger(options.initialLedger?.modelCalls) ?? 0,
    promptTokens: normalizeNonNegativeInteger(options.initialLedger?.promptTokens) ?? 0,
    completionTokens: normalizeNonNegativeInteger(options.initialLedger?.completionTokens) ?? 0,
    totalTokens: normalizeNonNegativeInteger(options.initialLedger?.totalTokens) ?? 0,
    cachedInputTokens: normalizeNonNegativeInteger(options.initialLedger?.cachedInputTokens) ?? 0,
    cacheWriteInputTokens:
      normalizeNonNegativeInteger(options.initialLedger?.cacheWriteInputTokens) ?? 0,
    uncachedInputTokens:
      normalizeNonNegativeInteger(options.initialLedger?.uncachedInputTokens) ?? 0,
    estimatedCostUsd: normalizeNonNegativeNumber(options.initialLedger?.estimatedCostUsd) ?? 0,
    estimatedCacheSavingsUsd:
      normalizeNonNegativeNumber(options.initialLedger?.estimatedCacheSavingsUsd) ?? 0
  };

  const candidates = [options.primary, ...fallbacks];
  const name = `${options.primary.provider.name}:governed`;
  const governed: AIProvider = {
    name,
    dispatcher: options.primary.provider.dispatcher,
    promptCacheCapability: options.primary.provider.promptCacheCapability,
    generateContent: (prompt, tools, systemInstruction, callOptions) =>
      generateWithGovernance({
        options,
        candidates,
        healthStore,
        ledger,
        prompt,
        tools,
        systemInstruction,
        callOptions
      }),
    listModels: options.primary.provider.listModels?.bind(options.primary.provider)
  };

  if (options.primary.provider.streamContent) {
    governed.streamContent = (prompt, tools, systemInstruction, callOptions) =>
      streamWithGovernance({
        options,
        candidates,
        healthStore,
        ledger,
        prompt,
        tools,
        systemInstruction,
        callOptions
      });
  }

  return governed;
}

async function generateWithGovernance(input: {
  options: ProviderGovernanceOptions;
  candidates: ProviderGovernanceCandidate[];
  healthStore: ProviderGovernanceHealthStore;
  ledger: ProviderGovernanceLedger;
  prompt: string | AIMessage[];
  tools: any[];
  systemInstruction?: string;
  callOptions?: AIProviderCallOptions;
}): Promise<AIResponse> {
  beginLogicalModelCall(input.ledger, input.options.budgetPolicy, input.options.policy?.quotas);
  const callId = createCallId();
  const attempts: ProviderGovernanceAttemptTrace[] = [];
  let lastError: unknown;

  for (const candidate of orderCandidatesByHealth(input.candidates, input.healthStore)) {
    const candidateKey = providerCandidateKey(candidate);
    if (!input.healthStore.isHealthy(candidateKey)) {
      attempts.push(createSkippedAttempt(candidate, input.candidates.indexOf(candidate)));
      continue;
    }

    let maxAttempts = resolveMaxAttempts(input.options.policy?.retry);
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      throwIfAborted(input.callOptions?.signal);
      const startedAt = Date.now();
      try {
        const response = await candidate.provider.generateContent(
          input.prompt,
          input.tools,
          input.systemInstruction,
          adaptCallOptionsForCandidate(input.callOptions, candidate, input.options.primary)
        );
        attempts.push(createAttempt(candidate, input.candidates.indexOf(candidate), attempt, 'ok', startedAt));
        input.healthStore.recordSuccess(candidateKey);
        return attachGovernanceMetadata(response, {
          callId,
          options: input.options,
          candidate,
          attempts,
          ledger: input.ledger,
          limits: resolveProviderGovernanceLimits(input.options.budgetPolicy, input.options.policy?.quotas),
          healthStore: input.healthStore,
          candidateKeys: input.candidates.map(providerCandidateKey)
        });
      } catch (error) {
        if (isProviderGovernanceBudgetError(error)) throw error;
        if (isAbortError(error) || input.callOptions?.signal?.aborted) throw error;
        lastError = error;
        attempts.push(
          createAttempt(
            candidate,
            input.candidates.indexOf(candidate),
            attempt,
            'error',
            startedAt,
            error
          )
        );
        maxAttempts = await bumpAttemptsForRetry({
          error,
          attempt,
          maxAttempts,
          retry: input.options.policy?.retry,
          signal: input.callOptions?.signal
        });
      }
    }
    input.healthStore.recordFailure(candidateKey, lastError, input.options.policy?.health);
  }

  throw lastError instanceof Error ? lastError : new Error(errorToMessage(lastError));
}

async function* streamWithGovernance(input: {
  options: ProviderGovernanceOptions;
  candidates: ProviderGovernanceCandidate[];
  healthStore: ProviderGovernanceHealthStore;
  ledger: ProviderGovernanceLedger;
  prompt: string | AIMessage[];
  tools?: any[];
  systemInstruction?: string;
  callOptions?: AIProviderCallOptions;
}): AsyncIterable<AIResponse> {
  beginLogicalModelCall(input.ledger, input.options.budgetPolicy, input.options.policy?.quotas);
  const callId = createCallId();
  const attempts: ProviderGovernanceAttemptTrace[] = [];
  let lastError: unknown;

  for (const candidate of orderCandidatesByHealth(input.candidates, input.healthStore)) {
    const candidateKey = providerCandidateKey(candidate);
    if (!input.healthStore.isHealthy(candidateKey)) {
      attempts.push(createSkippedAttempt(candidate, input.candidates.indexOf(candidate)));
      continue;
    }

    if (!candidate.provider.streamContent) {
      lastError = new Error(`Provider ${candidate.provider.name} does not support streaming`);
      attempts.push(createAttempt(candidate, input.candidates.indexOf(candidate), 1, 'error', Date.now(), lastError));
      input.healthStore.recordFailure(candidateKey, lastError, input.options.policy?.health);
      continue;
    }

    let maxAttempts = resolveMaxAttempts(input.options.policy?.retry);
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      throwIfAborted(input.callOptions?.signal);
      const startedAt = Date.now();
      let yielded = false;
      try {
        const stream = candidate.provider.streamContent(
          input.prompt,
          input.tools,
          input.systemInstruction,
          adaptCallOptionsForCandidate(input.callOptions, candidate, input.options.primary)
        );
        for await (const chunk of stream) {
          yielded = true;
          yield attachGovernanceMetadata(chunk, {
            callId,
            options: input.options,
            candidate,
            attempts,
            ledger: input.ledger,
            limits: resolveProviderGovernanceLimits(input.options.budgetPolicy, input.options.policy?.quotas),
            healthStore: input.healthStore,
            candidateKeys: input.candidates.map(providerCandidateKey)
          });
        }
        attempts.push(createAttempt(candidate, input.candidates.indexOf(candidate), attempt, 'ok', startedAt));
        input.healthStore.recordSuccess(candidateKey);
        return;
      } catch (error) {
        if (isProviderGovernanceBudgetError(error)) throw error;
        if (isAbortError(error) || input.callOptions?.signal?.aborted) throw error;
        if (yielded) throw error;
        lastError = error;
        attempts.push(
          createAttempt(
            candidate,
            input.candidates.indexOf(candidate),
            attempt,
            'error',
            startedAt,
            error
          )
        );
        maxAttempts = await bumpAttemptsForRetry({
          error,
          attempt,
          maxAttempts,
          retry: input.options.policy?.retry,
          signal: input.callOptions?.signal
        });
      }
    }
    input.healthStore.recordFailure(candidateKey, lastError, input.options.policy?.health);
  }

  throw lastError instanceof Error ? lastError : new Error(errorToMessage(lastError));
}

function attachGovernanceMetadata(
  response: AIResponse,
  input: {
    callId: string;
    options: ProviderGovernanceOptions;
    candidate: ProviderGovernanceCandidate;
    attempts: ProviderGovernanceAttemptTrace[];
    ledger: ProviderGovernanceLedger;
    limits: ResolvedProviderGovernanceLimits;
    healthStore: ProviderGovernanceHealthStore;
    candidateKeys: string[];
  }
): AIResponse {
  const usage = normalizeUsage(response.usage);
  const cost = resolveCost(usage, input.candidate.cost, response.usage);
  const nextUsage: AIUsage = {
    ...response.usage,
    prompt_tokens: usage.prompt_tokens,
    completion_tokens: usage.completion_tokens,
    total_tokens: usage.total_tokens
  };

  if (cost.total_usd !== undefined) {
    nextUsage.estimated_cost_usd = cost.total_usd;
    nextUsage.cost = {
      input_usd: cost.input_usd,
      output_usd: cost.output_usd,
      total_usd: cost.total_usd
    };
  }
  if (cost.estimated_cache_savings_usd !== undefined && nextUsage.prompt_cache) {
    nextUsage.prompt_cache = {
      ...nextUsage.prompt_cache,
      estimatedCacheSavingsUsd: cost.estimated_cache_savings_usd
    };
  }

  input.ledger.promptTokens += usage.prompt_tokens;
  input.ledger.completionTokens += usage.completion_tokens;
  input.ledger.totalTokens += usage.total_tokens;
  input.ledger.estimatedCostUsd += cost.total_usd ?? 0;
  input.ledger.cachedInputTokens += response.usage?.prompt_cache?.cachedInputTokens ?? 0;
  input.ledger.cacheWriteInputTokens += response.usage?.prompt_cache?.cacheWriteInputTokens ?? 0;
  input.ledger.uncachedInputTokens += response.usage?.prompt_cache?.uncachedInputTokens ?? usage.prompt_tokens;
  input.ledger.estimatedCacheSavingsUsd += cost.estimated_cache_savings_usd ?? 0;

  const exceeded = findBudgetExceeded(input.ledger, input.limits);
  const metadata: ProviderGovernanceResponseMetadata = {
    callId: input.callId,
    runId: input.options.runId,
    sessionId: input.options.sessionId,
    selectedProviderId: input.candidate.providerId,
    selectedProviderName: input.candidate.providerName ?? input.candidate.provider.name,
    selectedModel: input.candidate.model,
    fallbackUsed: input.candidate !== input.options.primary,
    retryCount: input.attempts.filter((attempt) => attempt.status === 'error').length,
    attempts: input.attempts.map((attempt) => ({ ...attempt })),
    capabilities: input.candidate.capabilities,
    budget: {
      cumulative: { ...input.ledger },
      limits: input.limits,
      exceeded
    },
    health: input.healthStore.snapshot(input.candidateKeys)
  };

  nextUsage.provider = {
    providerId: input.candidate.providerId,
    model: input.candidate.model
  };
  nextUsage.governance = metadata;

  return {
    ...response,
    usage: nextUsage
  };
}

function beginLogicalModelCall(
  ledger: ProviderGovernanceLedger,
  budgetPolicy?: AgentBudgetPolicy,
  quotas?: ProviderGovernanceQuotaConfig
): void {
  const limits = resolveProviderGovernanceLimits(budgetPolicy, quotas);
  const nextLedger = {
    ...ledger,
    modelCalls: ledger.modelCalls + 1
  };
  const exceeded = findBudgetExceeded(nextLedger, limits);
  if (exceeded.length > 0) {
    throw new ProviderGovernanceBudgetError(exceeded, limits, { ...ledger });
  }
  ledger.modelCalls = nextLedger.modelCalls;
}

function resolveProviderGovernanceLimits(
  budgetPolicy?: AgentBudgetPolicy,
  quotas?: ProviderGovernanceQuotaConfig
): ResolvedProviderGovernanceLimits {
  return {
    maxModelCalls: minDefined(budgetPolicy?.maxModelCalls, quotas?.maxModelCalls),
    maxInputTokens: minDefined(budgetPolicy?.maxInputTokens, quotas?.maxInputTokens),
    maxOutputTokens: minDefined(budgetPolicy?.maxOutputTokens, quotas?.maxOutputTokens),
    timeoutMs: minDefined(budgetPolicy?.timeoutMs, quotas?.timeoutMs),
    maxCostUsd: minDefined(budgetPolicy?.maxCostUsd, quotas?.maxCostUsd)
  };
}

function findBudgetExceeded(
  ledger: ProviderGovernanceLedger,
  limits: ResolvedProviderGovernanceLimits
): ProviderGovernanceBudgetExceededCode[] {
  const exceeded: ProviderGovernanceBudgetExceededCode[] = [];
  if (limits.maxModelCalls !== undefined && ledger.modelCalls > limits.maxModelCalls) {
    exceeded.push('max_model_calls');
  }
  if (limits.maxInputTokens !== undefined && ledger.promptTokens > limits.maxInputTokens) {
    exceeded.push('max_input_tokens');
  }
  if (limits.maxOutputTokens !== undefined && ledger.completionTokens > limits.maxOutputTokens) {
    exceeded.push('max_output_tokens');
  }
  if (limits.maxCostUsd !== undefined && ledger.estimatedCostUsd > limits.maxCostUsd) {
    exceeded.push('max_cost_usd');
  }
  return exceeded;
}

function shouldEnableGovernance(
  options: ProviderGovernanceOptions,
  limits: ResolvedProviderGovernanceLimits,
  fallbacks: ProviderGovernanceCandidate[]
): boolean {
  if (options.enabled === true) return true;
  if (hasAnyLimit(limits)) return true;
  if (fallbacks.length > 0) return true;
  if ((options.policy?.retry?.maxAttempts ?? 1) > 1) return true;
  if (options.primary.cost) return true;
  if (options.primary.capabilities?.length) return true;
  if (options.policy?.enabled === true) return true;
  return false;
}

function hasAnyLimit(limits: ResolvedProviderGovernanceLimits): boolean {
  return Object.values(limits).some((value) => typeof value === 'number' && Number.isFinite(value));
}

function normalizeUsage(usage?: AIUsage): Required<Pick<AIUsage, 'prompt_tokens' | 'completion_tokens' | 'total_tokens'>> {
  const promptTokens = toNonNegativeNumber(
    usage?.prompt_tokens ?? usage?.promptTokens ?? usage?.input_tokens
  );
  const completionTokens = toNonNegativeNumber(
    usage?.completion_tokens ?? usage?.completionTokens ?? usage?.output_tokens
  );
  const totalTokens = toNonNegativeNumber(usage?.total_tokens ?? usage?.totalTokens) ??
    (promptTokens ?? 0) + (completionTokens ?? 0);
  return {
    prompt_tokens: promptTokens ?? 0,
    completion_tokens: completionTokens ?? 0,
    total_tokens: totalTokens
  };
}

function resolveCost(
  usage: Required<Pick<AIUsage, 'prompt_tokens' | 'completion_tokens' | 'total_tokens'>>,
  cost?: ProviderModelCostConfig,
  originalUsage?: AIUsage
): {
  input_usd?: number;
  output_usd?: number;
  total_usd?: number;
  estimated_cache_savings_usd?: number;
} {
  const originalTotal = toNonNegativeNumber(
    originalUsage?.estimated_cost_usd ?? originalUsage?.cost?.total_usd
  );
  if (originalTotal !== undefined) return { total_usd: originalTotal };
  if (!cost) return {};

  const inputRate = toNonNegativeNumber(cost.inputUsdPer1M) ?? 0;
  const cachedInputRate = toNonNegativeNumber(cost.cachedInputUsdPer1M);
  const outputRate = toNonNegativeNumber(cost.outputUsdPer1M) ?? 0;
  const cachedInputTokens = toNonNegativeNumber(
    originalUsage?.prompt_cache?.cachedInputTokens,
  ) ?? 0;
  const uncachedInputTokens = toNonNegativeNumber(
    originalUsage?.prompt_cache?.uncachedInputTokens,
  ) ?? Math.max(0, usage.prompt_tokens - cachedInputTokens);
  const inputUsd =
    cachedInputRate !== undefined && cachedInputTokens > 0
      ? (uncachedInputTokens / 1_000_000) * inputRate +
        (cachedInputTokens / 1_000_000) * cachedInputRate
      : (usage.prompt_tokens / 1_000_000) * inputRate;
  const outputUsd = (usage.completion_tokens / 1_000_000) * outputRate;
  const result = {
    input_usd: roundCost(inputUsd),
    output_usd: roundCost(outputUsd),
    total_usd: roundCost(inputUsd + outputUsd)
  };
  if (cachedInputRate !== undefined && cachedInputTokens > 0 && inputRate > cachedInputRate) {
    return {
      ...result,
      estimated_cache_savings_usd: roundCost(
        (cachedInputTokens / 1_000_000) * (inputRate - cachedInputRate),
      )
    };
  }
  return result;
}

function orderCandidatesByHealth(
  candidates: ProviderGovernanceCandidate[],
  healthStore: ProviderGovernanceHealthStore
): ProviderGovernanceCandidate[] {
  const healthy = candidates.filter((candidate) => healthStore.isHealthy(providerCandidateKey(candidate)));
  if (healthy.length === 0) return candidates;
  return [
    ...healthy,
    ...candidates.filter((candidate) => !healthStore.isHealthy(providerCandidateKey(candidate)))
  ];
}

function resolveMaxAttempts(retry?: ProviderGovernanceRetryConfig): number {
  return Math.max(1, normalizePositiveInteger(retry?.maxAttempts) ?? 1);
}

const TRANSIENT_PROVIDER_MAX_ATTEMPTS = 3;
const TRANSIENT_PROVIDER_BACKOFF_MS = 2_000;

function isTransientProviderError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /\b(429|502|503|504|524)\b/.test(msg);
}

async function bumpAttemptsForRetry(input: {
  error: unknown;
  attempt: number;
  maxAttempts: number;
  retry?: ProviderGovernanceRetryConfig;
  signal?: AbortSignal;
}): Promise<number> {
  const configured = resolveMaxAttempts(input.retry);
  const nextMax = isTransientProviderError(input.error)
    ? Math.max(input.maxAttempts, configured, TRANSIENT_PROVIDER_MAX_ATTEMPTS)
    : Math.max(input.maxAttempts, configured);
  if (input.attempt < nextMax) {
    await waitForRetry(input.retry, input.signal, {
      transient: isTransientProviderError(input.error)
    });
  }
  return nextMax;
}

async function waitForRetry(
  retry?: ProviderGovernanceRetryConfig,
  signal?: AbortSignal,
  options?: { transient?: boolean }
): Promise<void> {
  const backoffMs =
    normalizeNonNegativeNumber(retry?.backoffMs) ??
    (options?.transient ? TRANSIENT_PROVIDER_BACKOFF_MS : 0);
  if (backoffMs <= 0) return;
  await new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason instanceof Error ? signal.reason : new Error('Provider call aborted'));
      return;
    }
    const timeout = setTimeout(resolve, backoffMs);
    const abort = () => {
      clearTimeout(timeout);
      reject(signal?.reason instanceof Error ? signal.reason : new Error('Provider call aborted'));
    };
    signal?.addEventListener('abort', abort, { once: true });
  });
}

function createAttempt(
  candidate: ProviderGovernanceCandidate,
  candidateIndex: number,
  attempt: number,
  status: 'ok' | 'error',
  startedAt: number,
  error?: unknown
): ProviderGovernanceAttemptTrace {
  return {
    providerId: candidate.providerId,
    providerName: candidate.providerName ?? candidate.provider.name,
    model: candidate.model,
    candidateIndex,
    attempt,
    status,
    durationMs: Math.max(0, Date.now() - startedAt),
    error: error ? errorToMessage(error) : undefined
  };
}

function createSkippedAttempt(
  candidate: ProviderGovernanceCandidate,
  candidateIndex: number
): ProviderGovernanceAttemptTrace {
  return {
    providerId: candidate.providerId,
    providerName: candidate.providerName ?? candidate.provider.name,
    model: candidate.model,
    candidateIndex,
    attempt: 0,
    status: 'skipped_unhealthy',
    durationMs: 0
  };
}

function providerCandidateKey(candidate: ProviderGovernanceCandidate): string {
  return `${candidate.providerId || candidate.provider.name}:${candidate.model || 'default'}`;
}

function createCallId(): string {
  return `model_call_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function minDefined(...values: Array<number | undefined>): number | undefined {
  const normalized = values.filter(
    (value): value is number => typeof value === 'number' && Number.isFinite(value)
  );
  return normalized.length ? Math.min(...normalized) : undefined;
}

function normalizePositiveInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : undefined;
}

function normalizeNonNegativeNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function normalizeNonNegativeInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : undefined;
}

function toNonNegativeNumber(value: unknown): number | undefined {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : undefined;
}

function roundCost(value: number): number {
  return Number(value.toFixed(12));
}

function errorToMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error ?? 'Unknown provider error');
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  throw signal.reason instanceof Error ? signal.reason : new Error('Provider call aborted');
}

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const record = error as { name?: unknown; code?: unknown; message?: unknown };
  return (
    record.name === 'AbortError' ||
    record.code === 'ABORT_ERR' ||
    String(record.message || '').toLowerCase().includes('abort')
  );
}

/**
 * Fallback candidates must not reuse the primary prompt-cache key when the
 * provider/model (or implied endpoint identity) diverges from the cache contract.
 */
export function adaptCallOptionsForCandidate(
  callOptions: AIProviderCallOptions | undefined,
  candidate: ProviderGovernanceCandidate,
  primary: ProviderGovernanceCandidate
): AIProviderCallOptions | undefined {
  if (!callOptions?.responseCache || candidate === primary) return callOptions;

  const cache = callOptions.responseCache;
  const reasons = collectFallbackCacheMismatchReasons(cache, candidate);
  if (reasons.length === 0) return callOptions;

  return {
    ...callOptions,
    responseCache: {
      ...cache,
      cacheKey: undefined,
      enableStore: false,
      cacheEligibility: false,
      cacheDisableReason: reasons.join(';')
    }
  };
}

export function collectFallbackCacheMismatchReasons(
  cache: Pick<ResponseCacheRequest, 'providerId' | 'model' | 'endpoint'>,
  candidate: ProviderGovernanceCandidate
): string[] {
  const reasons: string[] = [];
  // Require an explicit provider/model match against the cache contract. Missing
  // identity on either side is treated as unsafe for key reuse.
  if (!cache.providerId || !candidate.providerId || cache.providerId !== candidate.providerId) {
    reasons.push('fallback_provider_mismatch');
  }
  if (!cache.model || !candidate.model || cache.model !== candidate.model) {
    reasons.push('fallback_model_mismatch');
  }
  return reasons;
}