import type { AgentEvent } from './engine/AgentEvent.js';
import type { AgentRun } from './engine/AgentRun.js';
import type { AgentSession } from './engine/AgentSession.js';
import {
  scanPromptCacheSessionDiagnostics,
  type PromptCacheDiagnosticCall,
} from './engine/promptCacheDiagnostics.js';

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
    /**
     * Cross-run/session sums of per-call usage. Not a live prefix-hit depth.
     * Per-run cumulative cache counters live on providerGovernance ledger;
     * per-call values live on each model_finished usage.prompt_cache.
     */
    totalTokens: number;
    promptTokens: number;
    completionTokens: number;
    cachedInputTokens: number;
    cacheWriteInputTokens: number;
    uncachedInputTokens: number;
    cacheHits: number;
    cacheWrites: number;
    cacheMisses: number;
    cacheUnsupported: number;
    cacheDisabled: number;
    cacheUnsafe: number;
    cacheHitRate: number;
    cacheDisableReasons: Record<string, number>;
    perCallCacheObservations: Array<{
      turnContextFingerprint?: string;
      stablePrefixHash?: string;
      cachedInputTokens: number;
      cacheKeyPresent?: boolean;
      cacheEligibility?: boolean;
      cacheDisableReason?: string;
      providerId?: string;
      model?: string;
      endpoint?: string;
      ephemeralMessageCount?: number;
      sourceErrors?: Array<{ source: string; code: string }>;
      conversionDiagnostics?: string[];
    }>;
    sourceFailureCount: number;
    converterDropCount: number;
    sessionMissReasons: Record<string, number>;
    estimatedCacheSavingsUsd: number;
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

const STUCK_RUN_MS = 30 * 60 * 1000;
const CONSECUTIVE_FAILURE_THRESHOLD = 3;
const PENDING_PERMISSION_THRESHOLD = 3;

export function computeAgentRunMetrics(runs: AgentRun[], sessions: AgentSession[]): AgentRunMetrics {
  // Aggregation note:
  // - Each model_finished event carries *per-call* prompt_cache usage.
  // - The totals below are *cross-run / session* sums of those per-call values.
  // - Do NOT treat summed cachedInputTokens as the current prefix hit depth;
  //   use per-call observations (see promptCacheDiagnostics) for that.
  const sessionByRunId = new Map(sessions.map((session) => [session.runId, session]));
  const effectiveRuns = runs.map((run) => ({ ...run, status: effectiveStatus(run) }));
  const terminalRuns = effectiveRuns.filter((run) => ['succeeded', 'failed', 'cancelled'].includes(run.status));
  const succeeded = effectiveRuns.filter((run) => run.status === 'succeeded').length;
  const failed = effectiveRuns.filter((run) => run.status === 'failed').length;
  const cancelled = effectiveRuns.filter((run) => run.status === 'cancelled').length;
  const paused = effectiveRuns.filter((run) => run.status === 'paused').length;
  const running = effectiveRuns.filter((run) => run.status === 'running' || run.status === 'cancelling').length;
  const queued = effectiveRuns.filter((run) => run.status === 'queued').length;
  const activeRuns = running + queued + paused;
  const pendingPermissions = runs.filter((run) => Boolean(run.pendingPermission)).length;

  const durations = terminalRuns
    .map((run) => run.durationMs ?? deriveDurationFromSession(sessionByRunId.get(run.runId)))
    .filter((value): value is number => value != null && value >= 0)
    .sort((a, b) => a - b);

  const toolStats = new Map<string, { failures: number; total: number }>();
  let permissionRequiredCount = 0;
  let toolCallCount = 0;
  let totalTokens = 0;
  let promptTokens = 0;
  let completionTokens = 0;
  let cachedInputTokens = 0;
  let cacheWriteInputTokens = 0;
  let uncachedInputTokens = 0;
  let cacheHits = 0;
  let cacheWrites = 0;
  let cacheMisses = 0;
  let cacheUnsupported = 0;
  let cacheDisabled = 0;
  let cacheUnsafe = 0;
  const cacheDisableReasons = new Map<string, number>();
  const perCallCacheObservations: AgentRunMetrics['tokenUsage']['perCallCacheObservations'] = [];
  const sessionMissReasons = new Map<string, number>();
  let sourceFailureCount = 0;
  let converterDropCount = 0;
  let estimatedCacheSavingsUsd = 0;
  let modelCallCount = 0;

  for (const session of sessions) {
    const diagnosticCalls: PromptCacheDiagnosticCall[] = [];
    for (const event of session.events) {
      if (event.type === 'permission_required') permissionRequiredCount++;
      if (event.type === 'tool_call_requested') toolCallCount++;
      if (event.type === 'model_finished') {
        modelCallCount++;
        const usage = extractTokenUsage(event.payload.usage);
        totalTokens += usage.totalTokens;
        promptTokens += usage.promptTokens;
        completionTokens += usage.completionTokens;
        cachedInputTokens += usage.cachedInputTokens;
        cacheWriteInputTokens += usage.cacheWriteInputTokens;
        uncachedInputTokens += usage.uncachedInputTokens;
        cacheHits += usage.cacheStatus === 'hit' ? 1 : 0;
        cacheWrites += usage.cacheStatus === 'write' ? 1 : 0;
        cacheMisses += usage.cacheStatus === 'miss' ? 1 : 0;
        cacheUnsupported += usage.cacheStatus === 'unsupported' ? 1 : 0;
        cacheDisabled += usage.cacheStatus === 'disabled' ? 1 : 0;
        cacheUnsafe += usage.cacheStatus === 'unsafe' ? 1 : 0;
        if (usage.cacheDisableReason) {
          cacheDisableReasons.set(
            usage.cacheDisableReason,
            (cacheDisableReasons.get(usage.cacheDisableReason) ?? 0) + 1,
          );
        }
        estimatedCacheSavingsUsd += usage.estimatedCacheSavingsUsd;
        perCallCacheObservations.push({
          turnContextFingerprint: usage.turnContextFingerprint,
          stablePrefixHash: usage.stablePrefixHash,
          cachedInputTokens: usage.cachedInputTokens,
          cacheKeyPresent: usage.cacheKeyPresent,
          cacheEligibility: usage.cacheEligibility,
          cacheDisableReason: usage.cacheDisableReason,
          providerId: usage.providerId,
          model: usage.model,
          endpoint: usage.endpoint,
          ephemeralMessageCount: usage.ephemeralMessageCount,
          sourceErrors: usage.sourceErrors,
          conversionDiagnostics: usage.conversionDiagnostics,
        });
        sourceFailureCount += usage.sourceErrors?.length ?? 0;
        if (usage.conversionDiagnostics?.includes('context_conversion_unsupported')) {
          converterDropCount += 1;
        }
        diagnosticCalls.push({
          promptTokens: usage.promptTokens,
          cachedInputTokens: usage.cachedInputTokens,
          cacheWriteInputTokens: usage.cacheWriteInputTokens,
          providerId: usage.providerId,
          model: usage.model,
          endpoint: usage.endpoint,
          stablePrefixHash: usage.stablePrefixHash,
          cacheKeyPresent: usage.cacheKeyPresent,
          cacheEligibility: usage.cacheEligibility,
          cacheDisableReason: usage.cacheDisableReason,
          ephemeralMessageCount: usage.ephemeralMessageCount,
          turnContextFingerprint: usage.turnContextFingerprint,
          sourceErrors: usage.sourceErrors,
          conversionDiagnostics: usage.conversionDiagnostics,
        });
      }
      if (event.type === 'tool_finished') {
        const toolName = event.payload.toolName || 'unknown';
        const current = toolStats.get(toolName) ?? { failures: 0, total: 0 };
        current.total++;
        if (!event.payload.success) current.failures++;
        toolStats.set(toolName, current);
      }
    }
    const sessionDiagnostics = scanPromptCacheSessionDiagnostics(diagnosticCalls);
    for (const reason of sessionDiagnostics.sessionMissReasons) {
      sessionMissReasons.set(reason, (sessionMissReasons.get(reason) ?? 0) + 1);
    }
  }

  const terminalCount = terminalRuns.length;
  const permissionDenominator = Math.max(toolCallCount, runs.length, 1);

  return {
    totalRuns: runs.length,
    terminalRuns: terminalCount,
    activeRuns,
    succeeded,
    failed,
    cancelled,
    paused,
    running,
    queued,
    successRate: terminalCount > 0 ? roundRatio(succeeded / terminalCount) : 0,
    failureRate: terminalCount > 0 ? roundRatio(failed / terminalCount) : 0,
    pauseRate: runs.length > 0 ? roundRatio(paused / runs.length) : 0,
    permissionInterceptRate: roundRatio(permissionRequiredCount / permissionDenominator),
    pendingPermissions,
    averageDurationMs: average(durations),
    p50DurationMs: percentile(durations, 0.5),
    p90DurationMs: percentile(durations, 0.9),
    durationBuckets: buildDurationBuckets(durations),
    toolFailures: [...toolStats.entries()]
      .map(([toolName, stats]) => ({ toolName, failures: stats.failures, total: stats.total }))
      .filter((item) => item.failures > 0)
      .sort((a, b) => b.failures - a.failures)
      .slice(0, 10),
    tokenUsage: {
      totalTokens,
      promptTokens,
      completionTokens,
      cachedInputTokens,
      cacheWriteInputTokens,
      uncachedInputTokens,
      cacheHits,
      cacheWrites,
      cacheMisses,
      cacheUnsupported,
      cacheDisabled,
      cacheUnsafe,
      cacheHitRate:
        cacheHits + cacheWrites + cacheMisses > 0
          ? roundRatio(cacheHits / (cacheHits + cacheWrites + cacheMisses))
          : 0,
      cacheDisableReasons: Object.fromEntries(
        [...cacheDisableReasons.entries()].sort((left, right) => right[1] - left[1]),
      ),
      perCallCacheObservations,
      sourceFailureCount,
      converterDropCount,
      sessionMissReasons: Object.fromEntries(
        [...sessionMissReasons.entries()].sort((left, right) => right[1] - left[1]),
      ),
      estimatedCacheSavingsUsd: roundCost(estimatedCacheSavingsUsd),
      modelCallCount
    },
    generatedAt: new Date().toISOString()
  };
}

function effectiveStatus(run: AgentRun): AgentRun['status'] {
  if (run.status !== 'archived') return run.status;
  const previousStatus = run.metadata?.archivedPreviousStatus;
  return typeof previousStatus === 'string' && previousStatus !== 'archived'
    ? (previousStatus as AgentRun['status'])
    : run.status;
}

function extractTokenUsage(usage: unknown): {
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  cachedInputTokens: number;
  cacheWriteInputTokens: number;
  uncachedInputTokens: number;
  cacheStatus?: 'hit' | 'write' | 'miss' | 'unsupported' | 'disabled' | 'unsafe';
  cacheDisableReason?: string;
  turnContextFingerprint?: string;
  stablePrefixHash?: string;
  cacheKeyPresent?: boolean;
  cacheEligibility?: boolean;
  providerId?: string;
  model?: string;
  endpoint?: string;
  ephemeralMessageCount?: number;
  sourceErrors?: Array<{ source: string; code: string }>;
  conversionDiagnostics?: string[];
  estimatedCacheSavingsUsd: number;
} {
  if (!usage || typeof usage !== 'object') {
    return {
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      cachedInputTokens: 0,
      cacheWriteInputTokens: 0,
      uncachedInputTokens: 0,
      estimatedCacheSavingsUsd: 0
    };
  }
  const record = usage as Record<string, unknown>;
  const prompt = Number(record.prompt_tokens ?? record.promptTokens ?? record.input_tokens ?? 0) || 0;
  const completion =
    Number(record.completion_tokens ?? record.completionTokens ?? record.output_tokens ?? 0) || 0;
  const total = Number(record.total_tokens ?? record.totalTokens ?? prompt + completion) || 0;
  const promptCache =
    record.prompt_cache && typeof record.prompt_cache === 'object'
      ? (record.prompt_cache as Record<string, unknown>)
      : undefined;
  const cachedInputTokens =
    Number(promptCache?.cachedInputTokens ?? promptCache?.read_tokens ?? 0) || 0;
  const cacheWriteInputTokens =
    Number(promptCache?.cacheWriteInputTokens ?? promptCache?.write_tokens ?? 0) || 0;
  const uncachedInputTokens =
    Number(
      promptCache?.uncachedInputTokens ??
        Math.max(0, prompt - cachedInputTokens - cacheWriteInputTokens),
    ) || 0;
  const cacheStatus =
    promptCache?.cacheStatus === 'hit' ||
    promptCache?.cacheStatus === 'write' ||
    promptCache?.cacheStatus === 'miss' ||
    promptCache?.cacheStatus === 'unsupported' ||
    promptCache?.cacheStatus === 'disabled' ||
    promptCache?.cacheStatus === 'unsafe'
      ? promptCache.cacheStatus
      : undefined;
  const cacheDisableReason =
    typeof promptCache?.cacheDisableReason === 'string'
      ? promptCache.cacheDisableReason
      : undefined;
  const turnContextFingerprint =
    typeof promptCache?.turnContextFingerprint === 'string'
      ? promptCache.turnContextFingerprint
      : undefined;
  const stablePrefixHash =
    typeof promptCache?.stablePrefixHash === 'string'
      ? promptCache.stablePrefixHash
      : undefined;
  const cacheKeyPresent =
    typeof promptCache?.cacheKeyPresent === 'boolean'
      ? promptCache.cacheKeyPresent
      : typeof promptCache?.cache_key === 'string' && promptCache.cache_key.trim().length > 0;
  const cacheEligibility =
    typeof promptCache?.eligible === 'boolean' ? promptCache.eligible : undefined;
  const providerId = typeof promptCache?.provider === 'string' ? promptCache.provider : undefined;
  const model = typeof promptCache?.model === 'string' ? promptCache.model : undefined;
  const endpoint = typeof promptCache?.endpoint === 'string' ? promptCache.endpoint : undefined;
  const ephemeralMessageCount =
    typeof promptCache?.ephemeralMessageCount === 'number'
      ? promptCache.ephemeralMessageCount
      : undefined;
  const sourceErrors = Array.isArray(promptCache?.sourceErrors)
    ? promptCache.sourceErrors.filter(
        (entry): entry is { source: string; code: string } =>
          Boolean(
            entry &&
              typeof entry === 'object' &&
              typeof (entry as Record<string, unknown>).source === 'string' &&
              typeof (entry as Record<string, unknown>).code === 'string',
          ),
      )
    : undefined;
  const conversionDiagnostics = Array.isArray(promptCache?.conversionDiagnostics)
    ? promptCache.conversionDiagnostics.filter(
        (entry): entry is string => typeof entry === 'string' && entry.length > 0,
      )
    : undefined;
  const savings = Number(promptCache?.estimatedCacheSavingsUsd ?? 0) || 0;
  return {
    totalTokens: total,
    promptTokens: prompt,
    completionTokens: completion,
    cachedInputTokens,
    cacheWriteInputTokens,
    uncachedInputTokens,
    cacheStatus,
    cacheDisableReason,
    turnContextFingerprint,
    stablePrefixHash,
    cacheKeyPresent,
    cacheEligibility,
    providerId,
    model,
    endpoint,
    ephemeralMessageCount,
    sourceErrors,
    conversionDiagnostics,
    estimatedCacheSavingsUsd: savings
  };
}

function roundCost(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function computeAgentRunAlerts(runs: AgentRun[], sessions: AgentSession[]): AgentRunAlert[] {
  const alerts: AgentRunAlert[] = [];
  const now = Date.now();
  const sessionByRunId = new Map(sessions.map((session) => [session.runId, session]));

  const pendingCount = runs.filter((run) => Boolean(run.pendingPermission)).length;
  if (pendingCount >= PENDING_PERMISSION_THRESHOLD) {
    alerts.push({
      id: `pending_permissions_${pendingCount}`,
      type: 'pending_permission_pileup',
      severity: pendingCount >= 5 ? 'critical' : 'warning',
      message: `待审批任务堆积：当前 ${pendingCount} 个 run 等待权限处理`,
      createdAt: new Date().toISOString(),
      metadata: { pendingCount }
    });
  }

  for (const run of runs) {
    const status = effectiveStatus(run);
    if (!['running', 'queued', 'cancelling'].includes(status)) continue;
    const updatedAt = new Date(run.updatedAt).getTime();
    if (!Number.isFinite(updatedAt) || now - updatedAt < STUCK_RUN_MS) continue;
    alerts.push({
      id: `stuck_${run.runId}`,
      type: 'stuck_run',
      severity: 'warning',
      message: `Run 可能卡死：${status} 状态超过 30 分钟无更新`,
      runId: run.runId,
      agentId: run.agentId,
      createdAt: new Date().toISOString(),
      metadata: {
        status,
        updatedAt: run.updatedAt,
        staleMinutes: Math.round((now - updatedAt) / 60000)
      }
    });
  }

  const recentTerminal = [...runs]
    .filter((run) => ['succeeded', 'failed', 'cancelled'].includes(effectiveStatus(run)))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 12);

  let consecutiveFailures = 0;
  for (const run of recentTerminal) {
    if (effectiveStatus(run) !== 'failed') break;
    consecutiveFailures++;
  }

  if (consecutiveFailures >= CONSECUTIVE_FAILURE_THRESHOLD) {
    alerts.push({
      id: `consecutive_failures_${consecutiveFailures}`,
      type: 'consecutive_failures',
      severity: consecutiveFailures >= 5 ? 'critical' : 'warning',
      message: `连续失败告警：最近 ${consecutiveFailures} 次 run 均失败`,
      createdAt: new Date().toISOString(),
      metadata: { consecutiveFailures }
    });
  }

  for (const [agentId, agentRuns] of groupRunsByAgent(runs)) {
    const recent = agentRuns
      .filter((run) => ['succeeded', 'failed', 'cancelled'].includes(effectiveStatus(run)))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, CONSECUTIVE_FAILURE_THRESHOLD);

    if (recent.length < CONSECUTIVE_FAILURE_THRESHOLD) continue;
    if (!recent.every((run) => effectiveStatus(run) === 'failed')) continue;

    alerts.push({
      id: `agent_failures_${agentId}`,
      type: 'consecutive_failures',
      severity: 'warning',
      message: `智能体 ${agentId} 连续 ${CONSECUTIVE_FAILURE_THRESHOLD} 次失败`,
      agentId,
      createdAt: new Date().toISOString(),
      metadata: {
        consecutiveFailures: CONSECUTIVE_FAILURE_THRESHOLD,
        recentRunIds: recent.map((run) => run.runId)
      }
    });
  }

  for (const session of sessions) {
    if (!session.pendingPermission) continue;
    const run = runs.find((item) => item.runId === session.runId);
    const requestedAt = new Date(session.pendingPermission.requestedAt).getTime();
    if (!Number.isFinite(requestedAt) || now - requestedAt < STUCK_RUN_MS) continue;
    alerts.push({
      id: `stale_permission_${session.runId}`,
      type: 'pending_permission_pileup',
      severity: 'warning',
      message: `审批等待过久：${session.pendingPermission.subject.toolName} 已等待超过 30 分钟`,
      runId: session.runId,
      agentId: run?.agentId ?? (session.metadata?.agentId as string | undefined),
      createdAt: new Date().toISOString(),
      metadata: {
        permissionId: session.pendingPermission.permissionId,
        toolName: session.pendingPermission.subject.toolName,
        requestedAt: session.pendingPermission.requestedAt
      }
    });
  }

  return alerts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function groupRunsByAgent(runs: AgentRun[]): Map<string, AgentRun[]> {
  const groups = new Map<string, AgentRun[]>();
  for (const run of runs) {
    if (!run.agentId) continue;
    const items = groups.get(run.agentId) ?? [];
    items.push(run);
    groups.set(run.agentId, items);
  }
  return groups;
}

function deriveDurationFromSession(session?: AgentSession): number | undefined {
  if (!session) return undefined;
  const finished = [...session.events]
    .reverse()
    .find((event: AgentEvent) => event.type === 'run_finished' || event.type === 'run_failed');
  if (!finished) return undefined;
  const start = new Date(session.createdAt).getTime();
  const end = new Date(finished.timestamp).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return undefined;
  return end - start;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function percentile(values: number[], ratio: number): number {
  if (values.length === 0) return 0;
  const index = Math.min(values.length - 1, Math.floor(values.length * ratio));
  return values[index] ?? 0;
}

function roundRatio(value: number): number {
  return Math.round(value * 1000) / 10;
}

function buildDurationBuckets(durations: number[]): Array<{ label: string; count: number }> {
  const buckets = [
    { label: '<1s', min: 0, max: 1000 },
    { label: '1-10s', min: 1000, max: 10000 },
    { label: '10-60s', min: 10000, max: 60000 },
    { label: '1-5m', min: 60000, max: 300000 },
    { label: '>5m', min: 300000, max: Number.POSITIVE_INFINITY }
  ];

  return buckets.map((bucket) => ({
    label: bucket.label,
    count: durations.filter((value) => value >= bucket.min && value < bucket.max).length
  }));
}
