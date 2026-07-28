import React from 'react';
import type { WorkflowRunSnapshot } from '../../stores/workflowRunStore';

type WorkflowProgressPanelProps = {
  wfRun: WorkflowRunSnapshot;
  committing: boolean;
  hasResult: boolean;
  displayFooterLine: string;
  statusDotClass: string;
  onClearCache: () => void;
  onOpenCommitPicker: () => void;
};

const WorkflowProgressPanel: React.FC<WorkflowProgressPanelProps> = ({
  wfRun,
  committing,
  hasResult,
  displayFooterLine,
  statusDotClass,
  onClearCache,
  onOpenCommitPicker
}) => (
  <div className="mt-3 md:mt-4 flex shrink-0 flex-col gap-3 md:flex-row md:items-center md:justify-between bg-canvas dark:bg-surface-darker p-3 sm:p-4 rounded-3xl border border-hairline-soft dark:border-white/5 min-w-0 overflow-hidden card-interactive-subtle max-md:sticky max-md:bottom-0 max-md:z-10 max-md:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
    <div className="flex flex-col gap-1.5 min-w-0 flex-1 md:max-w-[min(100%,42rem)] md:order-1">
      <div className="flex items-center gap-2 min-w-0">
        <div
          className={`h-2 w-2 shrink-0 rounded-full ${statusDotClass}`}
          title={displayFooterLine}
        />
        <span className="text-[12px] text-text-charcoal dark:text-text-secondary truncate">
          状态:{' '}
          <span className="font-mono text-text-slate dark:text-text-secondary">
            {displayFooterLine}
          </span>
        </span>
      </div>
      {wfRun.steps.length > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center md:pl-4">
          {wfRun.steps.map((s) => {
            const chip =
              s.status === 'done'
                ? 'bg-teal-light text-moss-dark'
                : s.status === 'running'
                  ? 'bg-surface-yellow text-yellow-dark animate-pulse'
                  : s.status === 'error'
                    ? 'bg-coral-light text-coral-dark'
                    : 'bg-surface text-text-steel dark:bg-surface-dark dark:text-text-secondary';
            return (
              <span
                key={s.stepId}
                title={s.error ? s.error : s.status}
                className={`text-[10px] font-medium px-2.5 py-0.5 rounded-full ${chip} max-w-[10rem] truncate`}
              >
                {s.label}
              </span>
            );
          })}
        </div>
      )}
    </div>

    <div className="grid grid-cols-2 gap-2 w-full min-w-0 md:order-2 md:flex md:w-auto md:items-center md:gap-3">
      <button
        onClick={onClearCache}
        className="min-w-0 px-4 py-2 rounded-full text-[12px] sm:text-[13px] font-medium text-text-slate dark:text-text-secondary hover:text-coral-dark hover:bg-rose-light dark:hover:bg-rose-light/10 transition-colors border border-hairline dark:border-white/10 flex items-center justify-center gap-1.5 md:flex-none"
        title="清除所有缓存数据"
      >
        <span className="material-symbols-outlined text-[16px] shrink-0">delete_sweep</span>
        <span className="truncate">清除缓存</span>
      </button>
      <button
        onClick={onOpenCommitPicker}
        disabled={committing || !hasResult}
        className="btn-pill-cta min-w-0 gap-2 px-4 sm:px-5 py-2 text-sm md:flex-none"
      >
        {committing ? (
          <div className="w-5 h-5 border-2 border-white/20 border-t-white dark:border-ink/20 dark:border-t-ink rounded-full animate-spin shrink-0" />
        ) : (
          <span className="material-symbols-outlined text-[18px] shrink-0">publish</span>
        )}
        <span className="truncate">{committing ? '正在提交...' : '提交'}</span>
      </button>
    </div>
  </div>
);

export default WorkflowProgressPanel;
