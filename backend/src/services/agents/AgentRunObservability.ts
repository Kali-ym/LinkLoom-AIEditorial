import type { AgentEvent } from './engine/AgentEvent.js';
import type { AgentRun } from './engine/AgentRun.js';
import type { AgentSession } from './engine/AgentSession.js';

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
    totalTokens: number;
    promptTokens: number;
    completionTokens: number;
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
  let modelCallCount = 0;

  for (const session of sessions) {
    for (const event of session.events) {
      if (event.type === 'permission_required') permissionRequiredCount++;
      if (event.type === 'tool_call_requested') toolCallCount++;
      if (event.type === 'model_finished') {
        modelCallCount++;
        const usage = extractTokenUsage(event.payload.usage);
        totalTokens += usage.totalTokens;
        promptTokens += usage.promptTokens;
        completionTokens += usage.completionTokens;
      }
      if (event.type === 'tool_finished') {
        const toolName = event.payload.toolName || 'unknown';
        const current = toolStats.get(toolName) ?? { failures: 0, total: 0 };
        current.total++;
        if (!event.payload.success) current.failures++;
        toolStats.set(toolName, current);
      }
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
} {
  if (!usage || typeof usage !== 'object') {
    return { totalTokens: 0, promptTokens: 0, completionTokens: 0 };
  }
  const record = usage as Record<string, unknown>;
  const prompt = Number(record.prompt_tokens ?? record.promptTokens ?? record.input_tokens ?? 0) || 0;
  const completion =
    Number(record.completion_tokens ?? record.completionTokens ?? record.output_tokens ?? 0) || 0;
  const total = Number(record.total_tokens ?? record.totalTokens ?? prompt + completion) || 0;
  return { totalTokens: total, promptTokens: prompt, completionTokens: completion };
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
