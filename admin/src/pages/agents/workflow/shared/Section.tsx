import React from 'react';

interface SectionProps {
  title: string;
  description?: string;
  icon?: string;
  /** material-symbols icon 颜色色域。 */
  tone?: 'slate' | 'emerald' | 'sky' | 'amber' | 'violet' | 'rose';
  actions?: React.ReactNode;
  children: React.ReactNode;
  /** 紧凑模式去掉外层卡片 padding（用于嵌套）。 */
  compact?: boolean;
  defaultCollapsed?: boolean;
  collapsible?: boolean;
}

const TONE_CLASSES: Record<NonNullable<SectionProps['tone']>, { iconBg: string; iconText: string }> = {
  slate: { iconBg: 'bg-surface dark:bg-canvas/5', iconText: 'text-text-slate dark:text-text-stone' },
  emerald: { iconBg: 'bg-teal-light dark:bg-brand-teal/15', iconText: 'text-moss-dark dark:text-emerald-300' },
  sky: { iconBg: 'bg-sky-100 dark:bg-sky-500/15', iconText: 'text-sky-600 dark:text-sky-300' },
  amber: { iconBg: 'bg-amber-100 dark:bg-amber-500/15', iconText: 'text-amber-600 dark:text-amber-300' },
  violet: { iconBg: 'bg-surface-lavender dark:bg-purple-500/15', iconText: 'text-ink-deep dark:text-violet-300' },
  rose: { iconBg: 'bg-rose-100 dark:bg-rose-500/15', iconText: 'text-rose-600 dark:text-rose-300' }
};

/**
 * 通用配置 Section 卡片，所有工作流/调度编辑器共用同一风格。
 * - 头部：icon + title + description + actions
 * - 主体：children
 * - 可折叠
 */
export const Section: React.FC<SectionProps> = ({
  title,
  description,
  icon,
  tone = 'slate',
  actions,
  children,
  compact,
  defaultCollapsed,
  collapsible
}) => {
  const [collapsed, setCollapsed] = React.useState(!!defaultCollapsed);
  const toneCls = TONE_CLASSES[tone];

  return (
    <section
      className={`rounded-2xl border border-hairline-soft dark:border-white/5 bg-canvas dark:bg-canvas/[0.02] ${compact ? 'p-3' : 'p-4'}`}
    >
      <header className="flex items-start justify-between gap-3">
        <button
          type="button"
          disabled={!collapsible}
          onClick={() => collapsible && setCollapsed((v) => !v)}
          className={`flex items-start gap-3 text-left flex-1 ${collapsible ? 'cursor-pointer' : 'cursor-default'}`}
        >
          {icon && (
            <span
              className={`w-8 h-8 rounded-2xl flex items-center justify-center ${toneCls.iconBg} ${toneCls.iconText} shrink-0`}
            >
              <span className="material-symbols-outlined text-[18px]">{icon}</span>
            </span>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-text-ink dark:text-white leading-tight">{title}</h3>
            {description && (
              <p className="text-[11px] text-text-slate dark:text-text-stone mt-0.5 leading-relaxed">{description}</p>
            )}
          </div>
          {collapsible && (
            <span className="material-symbols-outlined text-text-stone text-base shrink-0 mt-1">
              {collapsed ? 'expand_more' : 'expand_less'}
            </span>
          )}
        </button>
        {actions && <div className="flex items-center gap-1.5 shrink-0">{actions}</div>}
      </header>
      {!collapsed && <div className={compact ? 'mt-2' : 'mt-3'}>{children}</div>}
    </section>
  );
};

interface ChipProps {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  title?: string;
}

/** 通用 chip 按钮（用于 multiselect / toggle / 表达式预设等）。 */
export const Chip: React.FC<ChipProps> = ({ active, onClick, children, title }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={`px-2 py-0.5 text-[11px] rounded-full border transition-colors ${
      active
        ? 'bg-ink text-white border-ink'
        : 'border-hairline-soft dark:border-white/10 text-text-slate hover:text-ink-deep'
    }`}
  >
    {children}
  </button>
);

/** 输入控件通用样式（统一字号/圆角/聚焦环）。 */
export const SHARED_INPUT_CLASS =
  'w-full px-3 py-2 bg-surface-soft dark:bg-surface-darker border border-hairline-soft dark:border-white/10 rounded-lg text-xs outline-none focus:ring-2 focus:ring-ink/30 dark:text-white';

export const SHARED_LABEL_CLASS =
  'text-[10px] font-semibold text-text-slate dark:text-text-stone uppercase tracking-wider';
