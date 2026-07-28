import React from 'react';
import type { StepTypeDescriptor } from '../../../../hooks/useStepCatalog';

interface Props {
  stepTypes: StepTypeDescriptor[];
  onPick: (type: string) => void;
  onClose: () => void;
}

const COLOR_MAP: Record<string, { bg: string; border: string; iconBg: string; iconText: string }> = {
  emerald: {
    bg: 'hover:bg-teal-light dark:hover:bg-brand-teal/10',
    border: 'hover:border-emerald-300 dark:hover:border-emerald-500/40',
    iconBg: 'bg-teal-light dark:bg-brand-teal/15',
    iconText: 'text-moss-dark dark:text-emerald-300'
  },
  sky: {
    bg: 'hover:bg-sky-50 dark:hover:bg-sky-500/10',
    border: 'hover:border-sky-300 dark:hover:border-sky-500/40',
    iconBg: 'bg-sky-100 dark:bg-sky-500/15',
    iconText: 'text-sky-600 dark:text-sky-300'
  },
  amber: {
    bg: 'hover:bg-amber-50 dark:hover:bg-amber-500/10',
    border: 'hover:border-amber-300 dark:hover:border-amber-500/40',
    iconBg: 'bg-amber-100 dark:bg-amber-500/15',
    iconText: 'text-amber-600 dark:text-amber-300'
  },
  violet: {
    bg: 'hover:bg-surface-lavender dark:hover:bg-purple-500/10',
    border: 'hover:border-ink/40 dark:hover:border-violet-500/40',
    iconBg: 'bg-surface-lavender dark:bg-purple-500/15',
    iconText: 'text-ink-deep dark:text-violet-300'
  },
  rose: {
    bg: 'hover:bg-rose-50 dark:hover:bg-rose-500/10',
    border: 'hover:border-rose-300 dark:hover:border-rose-500/40',
    iconBg: 'bg-rose-100 dark:bg-rose-500/15',
    iconText: 'text-rose-600 dark:text-rose-300'
  },
  slate: {
    bg: 'hover:bg-surface-soft dark:hover:bg-canvas/5',
    border: 'hover:border-hairline-strong dark:hover:border-white/20',
    iconBg: 'bg-surface dark:bg-canvas/5',
    iconText: 'text-text-slate dark:text-text-stone'
  }
};

/**
 * 图标 + 标签的步骤类型选择器，替代下拉框。
 * 按 category 分组：pipeline（数据管线）/ classic（智能体/子工作流/工具）。
 */
export const StepTypePicker: React.FC<Props> = ({ stepTypes, onPick, onClose }) => {
  const pipeline = stepTypes.filter((s) => s.category === 'pipeline');
  const classic = stepTypes.filter((s) => s.category === 'classic');

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl mx-4 rounded-3xl bg-canvas dark:bg-surface-dark shadow-modal border border-hairline-soft dark:border-white/10 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-6 py-4 border-b border-hairline-soft dark:border-white/5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-text-ink dark:text-white">添加步骤</h2>
            <p className="text-[11px] text-text-slate dark:text-text-stone mt-0.5">
              选择步骤类型，将插入到工作流末尾
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-surface dark:hover:bg-canvas/10 inline-flex items-center justify-center text-text-stone"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </header>

        <div className="px-6 py-5 max-h-[70vh] overflow-y-auto space-y-5">
          {pipeline.length > 0 && (
            <Group title="数据管线" subtitle="不依赖模型，纯数据流转步骤">
              {pipeline.map((s) => (
                <PickerCard key={s.type} step={s} onPick={() => onPick(s.type)} />
              ))}
            </Group>
          )}
          {classic.length > 0 && (
            <Group title="经典步骤" subtitle="调用 Agent / Tool / 子工作流">
              {classic.map((s) => (
                <PickerCard key={s.type} step={s} onPick={() => onPick(s.type)} />
              ))}
            </Group>
          )}
        </div>
      </div>
    </div>
  );
};

const Group: React.FC<{ title: string; subtitle: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
  <div className="space-y-2">
    <div>
      <h3 className="text-xs font-semibold text-text-charcoal dark:text-text-stone">{title}</h3>
      <p className="text-[10px] text-text-stone">{subtitle}</p>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{children}</div>
  </div>
);

const PickerCard: React.FC<{ step: StepTypeDescriptor; onPick: () => void }> = ({ step, onPick }) => {
  const palette = COLOR_MAP[step.color] || COLOR_MAP.slate;
  return (
    <button
      type="button"
      onClick={onPick}
      className={`group flex items-start gap-3 p-3 rounded-2xl border border-hairline-soft dark:border-white/10 text-left transition-all ${palette.bg} ${palette.border}`}
    >
      <span
        className={`w-10 h-10 rounded-2xl flex items-center justify-center ${palette.iconBg} ${palette.iconText} shrink-0`}
      >
        <span className="material-symbols-outlined text-[20px]">{step.icon}</span>
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-semibold text-text-ink dark:text-white">{step.label}</span>
          <span className="text-[9px] text-text-stone font-mono">{step.type}</span>
        </div>
        <p className="text-[11px] text-text-slate dark:text-text-stone mt-0.5 leading-snug">
          {step.description}
        </p>
      </div>
    </button>
  );
};
