import React, { useState, useEffect, useCallback } from 'react';
import { agentService } from '../../../services/agentService';
import {
  getOpsErrorMessage,
  opsSelectClass,
  OpsErrorBanner,
  OpsRefreshButton
} from '../opsUiPrimitives';
import type {
  Agent,
  Workflow,
  WorkflowRunRecord,
  WorkflowRunStepRecord
} from '../../../services/agentService';

const STATUS_COLORS: Record<string, string> = {
  running: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  paused: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  succeeded: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  timeout: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  cancelled: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  queued: 'bg-slate-200 text-slate-700 dark:bg-slate-600 dark:text-slate-200'
};

const STEP_COLORS: Record<string, string> = {
  pending: 'text-text-slate dark:text-text-secondary',
  running: 'text-blue-600',
  succeeded: 'text-emerald-600',
  failed: 'text-red-600',
  skipped: 'text-amber-600'
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function formatDuration(ms?: number): string {
  if (ms == null) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m${Math.round((ms % 60000) / 1000)}s`;
}

interface WorkflowRunsSectionProps {
  agents: Agent[];
  workflows: Workflow[];
}

export const WorkflowRunsSection: React.FC<WorkflowRunsSectionProps> = ({ agents, workflows }) => {
  const [runs, setRuns] = useState<WorkflowRunRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<WorkflowRunRecord | null>(null);
  const [workflowFilter, setWorkflowFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  const load = useCallback(
    async (options?: { silent?: boolean }) => {
      if (options?.silent) setRefreshing(true);
      else setLoading(true);
      try {
        const page = await agentService.listWorkflowRuns(workflowFilter || undefined, 0, 40);
        setRuns(page.items);
        setTotal(page.total);
        setError(null);
      } catch (err) {
        setError(getOpsErrorMessage(err));
      } finally {
        if (options?.silent) setRefreshing(false);
        else setLoading(false);
      }
    },
    [workflowFilter]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const hasActive = runs.some((run) =>
      ['running', 'paused', 'queued'].includes(run.status)
    );
    const intervalMs = hasActive ? 4000 : 15000;
    const timer = setInterval(() => void load({ silent: true }), intervalMs);
    return () => clearInterval(timer);
  }, [runs, load]);

  const workflowName = (workflowId: string) =>
    workflows.find((workflow) => workflow.id === workflowId)?.name || workflowId;

  const agentName = (agentId?: string) =>
    agents.find((agent) => agent.id === agentId)?.name || agentId || '-';

  const openDetail = async (run: WorkflowRunRecord) => {
    try {
      const detail = await agentService.getWorkflowRun(run.workflowRunId);
      setSelected(detail);
      setError(null);
    } catch (err) {
      setSelected(run);
      setError(getOpsErrorMessage(err, '无法加载工作流运行详情，已显示列表摘要'));
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-text-charcoal dark:text-text-secondary">
        工作流编排级运行记录（含多步骤依赖与调度触发）。进行中的任务固定在顶部，已完成按结束时间倒序。单步智能体执行见「智能体运行」。
        {refreshing && <span className="ml-2 text-text-stone">刷新中…</span>}
      </p>

      {error && <OpsErrorBanner message={error} onRetry={load} />}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-slate dark:text-text-secondary">共 {total} 条</p>
        <div className="flex gap-2">
          <select
            value={workflowFilter}
            onChange={(e) => setWorkflowFilter(e.target.value)}
            className={opsSelectClass}
          >
            <option value="">全部工作流</option>
            {workflows.map((workflow) => (
              <option key={workflow.id} value={workflow.id}>
                {workflow.name}
              </option>
            ))}
          </select>
          <OpsRefreshButton onClick={load} disabled={loading} />
        </div>
      </div>

      {loading && runs.length === 0 && (
        <div className="py-12 text-center text-sm text-text-slate dark:text-text-secondary">加载中...</div>
      )}

      {!loading && runs.length === 0 && (
        <div className="rounded-xl border border-hairline bg-white px-6 py-16 text-center dark:border-border-dark dark:bg-surface-dark">
          <p className="text-sm text-text-slate dark:text-text-secondary">暂无编排运行记录</p>
          <p className="mt-2 text-xs text-text-slate dark:text-text-secondary">
            在生成预览运行日报，或通过调度中心触发后，记录会出现在这里
          </p>
        </div>
      )}

      <div className="space-y-3">
        {runs.map((run) => (
          <button
            key={run.workflowRunId}
            type="button"
            onClick={() => void openDetail(run)}
            className="w-full rounded-xl border border-hairline bg-white p-4 text-left transition-colors hover:bg-surface-soft/40 dark:border-border-dark dark:bg-surface-dark dark:hover:bg-white/[0.03]"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      STATUS_COLORS[run.status] || STATUS_COLORS.queued
                    }`}
                  >
                    {run.status}
                  </span>
                  <span className="text-sm font-medium text-text-ink dark:text-white">
                    {run.workflowName || workflowName(run.workflowId)}
                  </span>
                  <span className="text-xs text-text-slate dark:text-text-secondary">{run.source}</span>
                </div>
                <p className="text-xs text-text-slate dark:text-text-secondary">
                  开始 {formatTime(run.createdAt)}
                  {run.finishedAt ? ` · 结束 ${formatTime(run.finishedAt)}` : ''}
                  {' · '}
                  {['running', 'paused', 'queued'].includes(run.status)
                    ? `已运行 ${formatDuration(now - new Date(run.createdAt).getTime())}`
                    : `耗时 ${formatDuration(run.durationMs)}`}
                  {run.failedStepId && (
                    <span className="ml-2 text-red-600">失败步骤：{run.failedStepId}</span>
                  )}
                </p>
                {run.error && (
                  <p className="truncate text-xs text-red-600 dark:text-red-400">{run.error}</p>
                )}
              </div>
              <span className="font-mono text-xs text-text-slate dark:text-text-secondary">
                {run.workflowRunId.slice(-12)}
              </span>
            </div>
            <StepDependencyGraph steps={run.steps} failedStepId={run.failedStepId} compact />
            {run.status === 'paused' && (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                等待审批 · 请前往「待办」处理发布类步骤
              </p>
            )}
          </button>
        ))}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 dark:bg-black/50"
          onClick={() => setSelected(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl dark:bg-surface-dark"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-text-ink dark:text-white">编排运行详情</h3>
                <p className="mt-1 font-mono text-xs text-text-slate dark:text-text-secondary">
                  {selected.workflowRunId}
                </p>
              </div>
              <button onClick={() => setSelected(null)} className="rounded-lg p-1.5 hover:bg-surface-soft">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <Info label="工作流" value={selected.workflowName || workflowName(selected.workflowId)} />
              <Info label="状态" value={selected.status} />
              <Info label="来源" value={selected.source} />
              <Info label="耗时" value={formatDuration(selected.durationMs)} />
              <Info label="创建" value={formatTime(selected.createdAt)} />
              {selected.date && <Info label="日期" value={selected.date} />}
            </div>

            {selected.error && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300">
                {selected.error}
              </p>
            )}

            <div className="mt-4">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-slate dark:text-text-secondary">
                步骤依赖
              </h4>
              <StepDependencyGraph steps={selected.steps} failedStepId={selected.failedStepId} />
            </div>

            <div className="mt-4">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-slate dark:text-text-secondary">
                步骤执行
              </h4>
              <div className="space-y-2">
                {selected.steps.map((step, index) => (
                  <StepRow
                    key={step.stepId}
                    index={index + 1}
                    step={step}
                    agentName={agentName(step.agentId)}
                    highlighted={step.stepId === selected.failedStepId}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function StepDependencyGraph({
  steps,
  failedStepId,
  compact = false
}: {
  steps: WorkflowRunStepRecord[];
  failedStepId?: string;
  compact?: boolean;
}) {
  if (steps.length === 0) return null;

  return (
    <div className={`mt-3 flex flex-wrap items-center gap-1 ${compact ? 'text-[10px]' : 'text-xs'}`}>
      {steps.map((step, index) => {
        const failed = step.stepId === failedStepId || step.status === 'failed';
        return (
          <React.Fragment key={step.stepId}>
            <StepChip step={step} failed={failed} compact={compact} />
            {index < steps.length - 1 && (
              <span className="text-text-slate dark:text-text-secondary">→</span>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function StepChip({
  step,
  failed,
  compact
}: {
  step: WorkflowRunStepRecord;
  failed: boolean;
  compact: boolean;
}) {
  const statusStyle =
    step.status === 'running'
      ? 'ring-1 ring-blue-300'
      : step.status === 'succeeded'
        ? 'ring-1 ring-emerald-200'
        : step.status === 'pending' && step.error?.includes('审批')
          ? 'ring-1 ring-amber-300'
          : '';
  return (
    <span
      className={`rounded px-1.5 py-0.5 ${statusStyle} ${
        failed
          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
          : 'bg-surface-soft text-text-slate dark:bg-canvas/50 dark:text-text-secondary'
      } ${compact ? '' : 'font-medium'}`}
      title={`${step.stepId} (${step.status})`}
    >
      {step.displayName || step.stepId}
      {step.status !== 'pending' ? ` · ${step.status}` : ''}
    </span>
  );
}

function StepRow({
  index,
  step,
  agentName,
  highlighted
}: {
  index: number;
  step: WorkflowRunStepRecord;
  agentName: string;
  highlighted: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 ${
        highlighted
          ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-900/10'
          : 'border-hairline dark:border-border-dark'
      }`}
    >
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-medium text-text-ink dark:text-white">
          {index}. {step.displayName || step.stepId}
        </span>
        <span className={`text-xs font-medium ${STEP_COLORS[step.status] || ''}`}>{step.status}</span>
      </div>
      <p className="mt-1 text-xs text-text-slate dark:text-text-secondary">智能体：{agentName}</p>
      {step.error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{step.error}</p>}
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <span className="text-text-slate dark:text-text-secondary">{label}：</span>
      <span className="text-text-ink dark:text-white">{value}</span>
    </div>
  );
}
