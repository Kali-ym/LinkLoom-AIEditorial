import React from 'react';

type GenerationPageShellProps = {
  date: string;
  generating: boolean;
  isWorkflowRunning: boolean;
  canCancelGeneration: boolean;
  hasSelectedIds: boolean;
  onDateChange: (date: string) => void;
  onOpenAiPicker: () => void;
  onCancelGeneration: () => void;
  children: React.ReactNode;
};

const GenerationPageShell: React.FC<GenerationPageShellProps> = ({
  date,
  generating,
  isWorkflowRunning,
  canCancelGeneration,
  hasSelectedIds,
  onDateChange,
  onOpenAiPicker,
  onCancelGeneration,
  children
}) => (
  <div className="flex min-h-0 flex-col md:min-h-[480px] md:h-[calc(100vh-120px)]">
    <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-3 md:gap-4 mb-4 md:mb-8 shrink-0">
      <div className="min-w-0">
        <h1 className="text-text-ink dark:text-white text-[26px] sm:text-[32px] md:text-[40px] leading-[1.1] font-medium tracking-tight">
          生成与预览
        </h1>
        <p className="text-text-slate dark:text-text-secondary text-[14px] sm:text-[15px] mt-1 sm:mt-2">
          管理每日趋势聚合与内容生成。
        </p>
      </div>
      <div className="flex w-full flex-col gap-2 md:flex-row md:flex-wrap md:items-end md:gap-3 md:p-2.5 md:rounded-full md:border md:border-hairline md:dark:border-white/10 md:w-auto md:bg-canvas md:dark:bg-surface-dark">
        <div className="flex flex-col gap-2 min-[420px]:flex-row min-[420px]:items-end md:contents">
          <div className="relative group w-full min-[420px]:min-w-0 min-[420px]:flex-1 md:w-auto md:shrink-0 md:px-1">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-text-stone">
              <span className="material-symbols-outlined text-[18px]">calendar_today</span>
            </div>
            <input
              className="bg-surface-soft dark:bg-surface-darker text-text-ink dark:text-white text-[13px] rounded-full border border-hairline dark:border-white/10 focus:outline-none focus:border-ink dark:focus:border-white pl-10 pr-4 py-2 w-full md:min-w-[160px] cursor-pointer"
              type="date"
              value={date}
              onChange={(e) => onDateChange(e.target.value)}
              onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
            />
          </div>
          <div className="hidden md:block h-7 w-px bg-hairline dark:bg-white/10 self-center shrink-0" />
          <button
            onClick={canCancelGeneration ? onCancelGeneration : onOpenAiPicker}
            disabled={!canCancelGeneration && (generating || isWorkflowRunning || !hasSelectedIds)}
            className={`w-full min-[420px]:w-auto md:flex-none gap-2 px-5 py-2.5 ${
              canCancelGeneration
                ? 'inline-flex items-center justify-center rounded-full border border-coral-dark/30 bg-rose-light text-coral-dark hover:bg-rose-light/80 dark:bg-rose-light/10 dark:text-coral-light dark:hover:bg-rose-light/20 text-[13px] font-medium transition-colors'
                : 'btn-pill-cta'
            }`}
          >
            {canCancelGeneration ? (
              <span className="material-symbols-outlined text-[18px]">stop_circle</span>
            ) : generating || isWorkflowRunning ? (
              <div className="w-4 h-4 border-2 border-white/20 border-t-white dark:border-ink/20 dark:border-t-ink rounded-full animate-spin" />
            ) : (
              <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
            )}
            <span>
              {canCancelGeneration
                ? '中断生成'
                : generating || isWorkflowRunning
                  ? '正在生成...'
                  : '生成 AI 内容'}
            </span>
          </button>
        </div>
      </div>
    </div>

    <div className="flex min-h-0 flex-1 flex-col max-md:gap-3">{children}</div>
  </div>
);

export default GenerationPageShell;
