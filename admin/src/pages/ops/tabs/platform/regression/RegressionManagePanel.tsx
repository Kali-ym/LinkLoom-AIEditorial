import React from 'react';
import { opsInputClass } from '../../../opsUiPrimitives';
import type { Agent, RegressionRunRecord, RegressionSample } from '../../../../../services/agentService';

type Props = {
  agents: Agent[];
  samples: RegressionSample[];
  runs: RegressionRunRecord[];
  busy: boolean;
  name: string;
  agentId: string;
  prompt: string;
  expected: string;
  editingId: string | null;
  runningSampleIds: Set<string>;
  onNameChange: (value: string) => void;
  onAgentIdChange: (value: string) => void;
  onPromptChange: (value: string) => void;
  onExpectedChange: (value: string) => void;
  onSave: () => void;
  onResetForm: () => void;
  onEdit: (sample: RegressionSample) => void;
  onDelete: (sample: RegressionSample) => void;
  onRunSingle: (sample: RegressionSample) => void;
};

export const RegressionManagePanel: React.FC<Props> = ({
  agents,
  samples,
  runs,
  busy,
  name,
  agentId,
  prompt,
  expected,
  editingId,
  runningSampleIds,
  onNameChange,
  onAgentIdChange,
  onPromptChange,
  onExpectedChange,
  onSave,
  onResetForm,
  onEdit,
  onDelete,
  onRunSingle
}) => {
  return (
    <details className="group rounded-2xl border border-hairline-soft bg-surface-soft/50 dark:border-white/5 dark:bg-white/[0.02]">
      <summary className="cursor-pointer list-none px-4 py-3 text-[13px] font-medium text-text-charcoal dark:text-text-secondary [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px] transition-transform group-open:rotate-90">
            chevron_right
          </span>
          高级：样本管理与运行历史
        </span>
      </summary>

      <div className="space-y-4 border-t border-hairline-soft px-4 py-4 dark:border-white/5">
        <div className="grid gap-2 md:grid-cols-2">
          <input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="样本名称"
            className={opsInputClass}
          />
          <select value={agentId} onChange={(e) => onAgentIdChange(e.target.value)} className={opsInputClass}>
            <option value="">选择智能体</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        </div>
        <textarea
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          placeholder="Prompt"
          rows={2}
          className={`w-full ${opsInputClass}`}
        />
        <textarea
          value={expected}
          onChange={(e) => onExpectedChange(e.target.value)}
          placeholder="期望包含（每行一个关键词，可选）"
          rows={2}
          className={`w-full ${opsInputClass}`}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !name.trim() || !agentId || !prompt.trim()}
            onClick={onSave}
            className="btn-pill-secondary !text-xs"
          >
            {editingId ? '保存修改' : '添加样本'}
          </button>
          {editingId && (
            <button type="button" disabled={busy} onClick={onResetForm} className="btn-pill-ghost !text-xs">
              取消编辑
            </button>
          )}
        </div>

        <div className="space-y-2">
          {samples.length === 0 && (
            <p className="py-6 text-center text-xs text-text-slate dark:text-text-secondary">
              暂无回归样本，添加一个即可开始
            </p>
          )}
          {samples.map((sample) => {
            const isRunning = runningSampleIds.has(sample.id);
            const sampleRuns = runs.filter((r) => r.sampleId === sample.id);
            const lastRun = sampleRuns[0];
            return (
              <div
                key={sample.id}
                className={`rounded-xl border px-4 py-3 transition-all ${
                  editingId === sample.id
                    ? 'border-primary/40 bg-primary/[0.04]'
                    : 'border-hairline bg-surface-soft/60 dark:border-white/10 dark:bg-canvas/40'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-text-ink dark:text-white">{sample.name}</span>
                      <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] text-text-slate dark:bg-white/10 dark:text-text-secondary">
                        {agents.find((a) => a.id === sample.agentId)?.name || sample.agentId}
                      </span>
                      {lastRun && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            lastRun.passed
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                              : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                          }`}
                        >
                          {lastRun.passed ? '通过' : '失败'}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-xs text-text-slate dark:text-text-secondary" title={sample.prompt}>
                      {sample.prompt.slice(0, 80)}
                      {sample.prompt.length > 80 ? '…' : ''}
                    </p>
                    {sampleRuns.length > 0 && (
                      <p className="mt-0.5 text-[10px] text-text-stone">
                        最近：
                        {lastRun.passed
                          ? `通过 · ${lastRun.mismatches.join(', ') || '无'}`
                          : `失败 · ${lastRun.mismatches.join(', ') || '无'}`}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1.5">
                    <button
                      type="button"
                      disabled={busy || isRunning}
                      onClick={() => onRunSingle(sample)}
                      className="btn-pill-accent !py-1 !text-[11px] disabled:opacity-50"
                    >
                      {isRunning ? '运行中…' : '运行'}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onEdit(sample)}
                      className="btn-pill-ghost !py-1 !text-[11px]"
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onDelete(sample)}
                      className="btn-pill-ghost !py-1 !text-[11px] text-coral-dark hover:border-brand-red"
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {runs.length > 0 && (
          <div>
            <h5 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-slate dark:text-text-secondary">
              最近回归运行
            </h5>
            <div className="space-y-1.5">
              {runs.map((run) => (
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
                    </p>
                  </div>
                  <div
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      run.passed
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                    }`}
                  >
                    {run.passed ? '通过' : `失败${run.mismatches?.length ? ` · ${run.mismatches.join(', ')}` : ''}`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </details>
  );
};
