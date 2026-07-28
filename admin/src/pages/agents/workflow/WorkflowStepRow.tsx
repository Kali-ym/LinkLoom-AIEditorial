import React from 'react';
import type { WorkflowStep } from '../../../services/agentService';
import type { StepTypeDescriptor } from '../../../hooks/useStepCatalog';
import { getNextStepIds } from '../../../utils/workflowGraph';

interface Props {
  step: WorkflowStep;
  index: number;
  active: boolean;
  isInitial: boolean;
  def?: StepTypeDescriptor;
  onSelect: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

const COLOR_DOT: Record<string, string> = {
  emerald: 'bg-brand-teal',
  sky: 'bg-sky-500',
  amber: 'bg-amber-500',
  violet: 'bg-purple-500',
  rose: 'bg-rose-500',
  slate: 'bg-slate-400'
};

const COLOR_BADGE: Record<string, string> = {
  emerald: 'bg-teal-light text-moss-dark dark:bg-brand-teal/15 dark:text-emerald-300',
  sky: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  violet: 'bg-surface-lavender text-ink-deep dark:bg-purple-500/15 dark:text-violet-300',
  rose: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  slate: 'bg-surface text-text-charcoal dark:bg-canvas/5 dark:text-text-stone'
};

/**
 * 工作流编辑器左侧的步骤列表项。
 * 紧凑显示：序号 + 名称 + 类型 chip + 启用状态。
 */
export const WorkflowStepRow: React.FC<Props> = ({
  step,
  index,
  active,
  isInitial,
  def,
  onSelect,
  onMoveUp,
  onMoveDown
}) => {
  const enabled = step.enabled !== false;
  const nextIds = getNextStepIds(step);
  const isParallel = nextIds.length > 1;
  const color = def?.color || 'slate';
  const badge = COLOR_BADGE[color] || COLOR_BADGE.slate;
  const dot = COLOR_DOT[color] || COLOR_DOT.slate;

  return (
    <div
      onClick={onSelect}
      className={`group relative pl-3 pr-2 py-2.5 rounded-2xl cursor-pointer transition-all border ${
        active
          ? 'bg-surface-lavender border-ink/30 dark:bg-ink/15'
          : 'border-transparent hover:bg-surface-soft dark:hover:bg-canvas/[0.03]'
      } ${!enabled ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start gap-2.5">
        <div className="flex flex-col items-center gap-1 pt-0.5">
          <span className={`w-2 h-2 rounded-full ${dot}`} />
          <span className="text-[10px] font-semibold text-text-stone font-mono">{String(index + 1).padStart(2, '0')}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-text-ink dark:text-white truncate">
              {step.displayName || step.id}
            </span>
            {isInitial && (
              <span className="px-1 py-0.5 text-[8px] font-semibold rounded bg-teal-light text-moss-dark dark:bg-brand-teal/20 dark:text-emerald-300">
                入口
              </span>
            )}
            {isParallel && (
              <span title="并行分叉" className="material-symbols-outlined text-[12px] text-amber-500">
                call_split
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-1.5 min-w-0">
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold whitespace-nowrap shrink-0 ${badge}`}>
              {def?.icon && <span className="material-symbols-outlined text-[10px]">{def.icon}</span>}
              {def?.label || step.type || '未配置'}
            </span>
          </div>
        </div>
        {(onMoveUp || onMoveDown) && (
          <div className="opacity-0 group-hover:opacity-100 flex flex-col gap-0.5 transition-opacity">
            <button
              type="button"
              disabled={!onMoveUp}
              onClick={(e) => {
                e.stopPropagation();
                onMoveUp?.();
              }}
              className="w-5 h-5 rounded hover:bg-hairline dark:hover:bg-canvas/10 text-text-stone disabled:opacity-30"
            >
              <span className="material-symbols-outlined text-[12px] align-middle">expand_less</span>
            </button>
            <button
              type="button"
              disabled={!onMoveDown}
              onClick={(e) => {
                e.stopPropagation();
                onMoveDown?.();
              }}
              className="w-5 h-5 rounded hover:bg-hairline dark:hover:bg-canvas/10 text-text-stone disabled:opacity-30"
            >
              <span className="material-symbols-outlined text-[12px] align-middle">expand_more</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
