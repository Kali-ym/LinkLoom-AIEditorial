import React from 'react';
import type { Agent, RegressionRunRecord, RegressionSample } from '../../../../../services/agentService';
import { summarizeLatestBatch } from '../shared/platformStatusUtils';

type Props = {
  agents: Agent[];
  samples: RegressionSample[];
  runs: RegressionRunRecord[];
  busy: boolean;
  runningSampleIds: Set<string>;
  onRunAll: () => void;
  onRunSingle: (sample: RegressionSample) => void;
};

export const RegressionSummary: React.FC<Props> = ({
  agents,
  samples,
  runs,
  busy,
  runningSampleIds,
  onRunAll,
  onRunSingle
}) => {
  const batch = summarizeLatestBatch(runs);
  const failedRuns = runs.filter((run) => !run.passed).slice(0, 5);
  const sampleById = new Map(samples.map((sample) => [sample.id, sample]));

  const summaryText = batch
    ? `${samples.length} 个样本 · 最近批次 ${batch.passed}/${batch.total} 通过`
    : `${samples.length} 个样本 · 尚无运行记录`;

  return (
    <section className="rounded-2xl border border-hairline-soft bg-canvas p-4 dark:border-white/5 dark:bg-surface-dark">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-text-ink dark:text-white">回归样本集</h4>
          <p className="mt-1 text-xs text-text-slate dark:text-text-secondary">{summaryText}</p>
        </div>
        <button
          type="button"
          disabled={busy || samples.length === 0}
          onClick={onRunAll}
          className="btn-pill-accent !text-xs disabled:opacity-50"
        >
          运行全部样本
        </button>
      </div>

      {samples.length === 0 && (
        <p className="mt-4 py-4 text-center text-xs text-text-slate dark:text-text-secondary">
          暂无样本，展开下方高级区添加
        </p>
      )}

      {failedRuns.length > 0 && (
        <div className="mt-4">
          <h5 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-slate dark:text-text-secondary">
            最近失败
          </h5>
          <div className="space-y-1.5">
            {failedRuns.map((run) => {
              const sample = sampleById.get(run.sampleId);
              const isRunning = sample ? runningSampleIds.has(sample.id) : false;
              return (
                <div
                  key={`${run.sampleId}_${run.createdAt}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-hairline-soft bg-surface-soft/60 px-3.5 py-2.5 text-xs dark:border-white/10 dark:bg-white/[0.03]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium text-text-ink dark:text-white">{run.sampleName}</span>
                      <span className="rounded-full bg-white/60 px-1.5 py-0.5 text-[10px] text-text-slate dark:bg-white/10 dark:text-text-secondary">
                        {run.agentId ? agents.find((a) => a.id === run.agentId)?.name || run.agentId : '-'}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-text-stone dark:text-text-secondary">
                      {new Date(run.createdAt).toLocaleString('zh-CN', {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                      {run.mismatches?.length ? ` · ${run.mismatches.join(', ')}` : ''}
                    </p>
                  </div>
                  {sample && (
                    <button
                      type="button"
                      disabled={busy || isRunning}
                      onClick={() => onRunSingle(sample)}
                      className="btn-pill-accent shrink-0 !py-1 !text-[11px] disabled:opacity-50"
                    >
                      {isRunning ? '运行中…' : '重跑'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};
