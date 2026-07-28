import React from 'react';
import { agentService } from '../../../services/agentService';
import type {
  Agent,
  AgentRun,
  AgentRunAlert,
  AgentRunMetrics,
  PendingPermissionItem
} from '../../../services/agentService';
import {
  OpsLabelWithHint,
  OpsTextAction
} from '../opsUiPrimitives';
import { OPS_METRIC_HINTS } from '../opsMetricHints';

interface HealthTabProps {
  agents: Agent[];
  metrics: AgentRunMetrics | null;
  alerts: AgentRunAlert[];
  pending: PendingPermissionItem[];
  onSelectRun?: (run: AgentRun) => void;
  onNavigateTab?: (tab: string, options?: { runsQuickFilter?: 'all' | 'active' | 'pendingPermission' | 'failed' | 'paused' }) => void;
  onNavigateAgentConsole?: () => void;
}

const ALERT_LABELS: Record<AgentRunAlert['type'], string> = {
  consecutive_failures: '连续失败',
  pending_permission_pileup: '审批堆积',
  stuck_run: '运行卡住'
};

function formatDuration(ms?: number): string {
  if (ms == null || ms === 0) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m${Math.round((ms % 60000) / 1000)}s`;
}

function formatTokenCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(value);
}

export const HealthTab: React.FC<HealthTabProps> = ({
  agents,
  metrics,
  alerts,
  pending,
  onSelectRun,
  onNavigateTab,
  onNavigateAgentConsole
}) => {
  const agentName = (agentId?: string) =>
    agents.find((agent) => agent.id === agentId)?.name || agentId || '-';

  const openRun = async (runId?: string) => {
    if (!runId || !onSelectRun) return;
    try {
      const run = await agentService.getAgentRun(runId);
      onSelectRun(run);
    } catch {
      // silently fail — parent handles error
    }
  };

  const needsAttention = pending.length > 0 || alerts.length > 0;

  return (
    <div className="space-y-4">
      {needsAttention && (
        <section className="rounded-2xl border border-amber-200/80 bg-surface-yellow/60 p-4 dark:border-amber-400/25 dark:bg-amber-400/10">
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-[18px] text-amber-700 dark:text-amber-300">warning</span>
            <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-100">需要你处理</h3>
          </div>
          <ul className="space-y-2 text-[13px] text-amber-800 dark:text-amber-200">
            {pending.length > 0 && (
              <li className="flex flex-wrap items-center justify-between gap-2">
                <span><strong>{pending.length}</strong> 条权限待审批</span>
                <OpsTextAction onClick={() => onNavigateTab?.('inbox')}>去审批</OpsTextAction>
              </li>
            )}
            {alerts.length > 0 && (
              <li className="flex flex-wrap items-center justify-between gap-2">
                <span><strong>{alerts.length}</strong> 条运行告警</span>
                <OpsTextAction onClick={() => onNavigateTab?.('runs', { runsQuickFilter: 'failed' })}>
                  查看失败运行
                </OpsTextAction>
              </li>
            )}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border border-hairline-soft bg-canvas dark:border-white/5 dark:bg-surface-dark">
        <div className="px-4 py-3 border-b border-hairline-soft dark:border-white/5">
          <h3 className="text-sm font-semibold text-text-ink dark:text-white">快捷操作</h3>
        </div>
        <div className="grid gap-3 p-4 md:grid-cols-3">
          <QuickActionCard
            icon="forum"
            title="Agent 控制台"
            description="预置 AI 应用：选题 Copilot、超级管理员等"
            status="进入控制台"
            statusTone="blue"
            onAction={() => onNavigateAgentConsole?.()}
            actionLabel="打开控制台"
          />
          <QuickActionCard
            icon="verified_user"
            title="审批待办"
            description="权限请求与人工确认"
            status={pending.length > 0 ? `待处理 (${pending.length})` : '无待办'}
            statusTone={pending.length > 0 ? 'yellow' : 'green'}
            onAction={() => onNavigateTab?.('inbox')}
            actionLabel="去审批"
          />
          <QuickActionCard
            icon="memory"
            title="RAG 检索"
            description="配置索引、检索模式与评测"
            status="查看配置"
            statusTone="blue"
            onAction={() => onNavigateTab?.('rag')}
            actionLabel="进入配置"
          />
        </div>
      </section>

      {metrics && (
        <details className="group rounded-2xl border border-hairline-soft bg-canvas dark:border-white/5 dark:bg-surface-dark" open>
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-text-ink dark:text-white [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-text-slate transition-transform group-open:rotate-90">
                chevron_right
              </span>
              详细指标
            </span>
          </summary>
          <div className="space-y-4 border-t border-hairline-soft px-4 py-4 dark:border-white/5">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
              <MetricCard label="总运行次数" hint={OPS_METRIC_HINTS.totalRuns} value={metrics.totalRuns} />
              <MetricCard label="失败率" hint={OPS_METRIC_HINTS.failureRate} value={`${metrics.failureRate}%`} accent="text-red-600" />
              <MetricCard label="暂停率" hint={OPS_METRIC_HINTS.pauseRate} value={`${metrics.pauseRate}%`} accent="text-amber-600" />
              <MetricCard label="权限拦截率" hint={OPS_METRIC_HINTS.permissionInterceptRate} value={`${metrics.permissionInterceptRate}%`} />
              <MetricCard label="平均耗时" hint={OPS_METRIC_HINTS.averageDurationMs} value={formatDuration(metrics.averageDurationMs)} />
              <MetricCard label="P90 耗时" hint={OPS_METRIC_HINTS.p90DurationMs} value={formatDuration(metrics.p90DurationMs)} />
            </div>

            {metrics.tokenUsage && (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <MetricCard label="模型调用" value={metrics.tokenUsage.modelCallCount} />
                <MetricCard label="总 Token" value={formatTokenCount(metrics.tokenUsage.totalTokens)} accent="text-primary" />
                <MetricCard label="Prompt Token" value={formatTokenCount(metrics.tokenUsage.promptTokens)} />
                <MetricCard label="Completion Token" value={formatTokenCount(metrics.tokenUsage.completionTokens)} />
              </div>
            )}

            {metrics.durationBuckets && metrics.durationBuckets.length > 0 && (
              <section className="rounded-xl border border-hairline-soft p-4 dark:border-white/5">
                <h4 className="mb-3 text-sm font-semibold text-text-ink dark:text-white">运行耗时分布</h4>
                <div className="space-y-2">
                  {metrics.durationBuckets.map((bucket) => {
                    const counts = metrics.durationBuckets!.map((b) => b.count);
                    const maxBucket = counts.length ? Math.max(...counts) : 1;
                    return (
                      <div key={bucket.label} className="flex items-center gap-3 text-xs">
                        <span className="w-12 text-text-charcoal dark:text-text-secondary">{bucket.label}</span>
                        <div className="h-2 flex-1 rounded-full bg-surface-soft dark:bg-canvas/50">
                          <div
                            className="h-2 rounded-full bg-primary/70"
                            style={{ width: `${Math.max(4, (bucket.count / maxBucket) * 100)}%` }}
                          />
                        </div>
                        <span className="w-8 text-right text-text-ink dark:text-white">{bucket.count}</span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        </details>
      )}

      <section className="rounded-2xl border border-hairline-soft bg-canvas dark:border-white/5 dark:bg-surface-dark">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline-soft px-4 py-3 dark:border-white/5">
          <h4 className="text-sm font-semibold text-text-ink dark:text-white">
            运行告警 {alerts.length > 0 && <span className="text-red-600">({alerts.length})</span>}
          </h4>
        </div>
        {alerts.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-text-charcoal dark:text-text-secondary">当前无运行告警</p>
        ) : (
          <div className="divide-y divide-hairline-soft dark:divide-white/5">
            {alerts.map((alert) => (
              <div key={alert.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        alert.severity === 'critical'
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
                      }`}
                    >
                      {alert.severity === 'critical' ? '严重' : '警告'}
                    </span>
                    <span className="text-xs text-text-charcoal dark:text-text-secondary">
                      {ALERT_LABELS[alert.type]}
                    </span>
                  </div>
                  <p className="text-sm text-text-ink dark:text-white">{alert.message}</p>
                  {(alert.agentId || alert.runId) && (
                    <p className="text-xs text-text-charcoal dark:text-text-secondary">
                      {alert.agentId && <>智能体：{agentName(alert.agentId)} · </>}
                      {alert.runId && <>运行 #{alert.runId.slice(-12)}</>}
                    </p>
                  )}
                </div>
                {alert.runId && onSelectRun ? (
                  <OpsTextAction onClick={() => openRun(alert.runId)}>查看运行</OpsTextAction>
                ) : (
                  <OpsTextAction onClick={() => onNavigateTab?.('runs')}>运行列表</OpsTextAction>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

function QuickActionCard({
  icon,
  title,
  description,
  status,
  statusTone,
  onAction,
  actionLabel
}: {
  icon: string;
  title: string;
  description: string;
  status: string;
  statusTone: 'green' | 'yellow' | 'red' | 'blue';
  onAction?: () => void;
  actionLabel: string;
}) {
  const toneClasses = {
    green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    yellow: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
    red: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
  };
  return (
    <div className="rounded-2xl border border-hairline-soft bg-surface-soft/60 p-4 dark:border-white/10 dark:bg-white/[0.03] transition-all hover:shadow-card hover:-translate-y-0.5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <span className="material-symbols-outlined text-[20px]">{icon}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text-ink dark:text-white">{title}</p>
          <p className="truncate text-[12px] text-text-slate dark:text-text-secondary">{description}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${toneClasses[statusTone]}`}>{status}</span>
        {onAction && (
          <button type="button" onClick={onAction} className="text-[12px] font-medium text-primary hover:text-primary-deep">
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  hint,
  value,
  accent
}: {
  label: string;
  hint?: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border border-hairline-soft bg-canvas px-4 py-3 dark:border-white/5 dark:bg-surface-dark">
      <p className="text-xs text-charcoal dark:text-text-secondary">
        {hint ? <OpsLabelWithHint label={label} hint={hint} /> : label}
      </p>
      <p className={`mt-1 text-lg font-semibold ${accent ?? 'text-text-ink dark:text-white'}`}>{value}</p>
    </div>
  );
}
