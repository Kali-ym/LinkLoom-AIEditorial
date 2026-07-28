import React from 'react';
import { AnimatedPillTabs } from './ScrollablePillNav';

export type FilterSelectOption = { value: string; label: string };

type FilterSelectProps = {
  label: string;
  icon: string;
  value: string;
  onChange: (value: string) => void;
  options: FilterSelectOption[];
  className?: string;
};

export const FilterSelect: React.FC<FilterSelectProps> = ({
  label,
  icon,
  value,
  onChange,
  options,
  className = ''
}) => (
  <div className={`flex flex-col gap-1 min-w-[8.5rem] ${className}`}>
    <span className="text-[10px] font-semibold text-text-steel dark:text-text-secondary uppercase tracking-[0.06em] px-1">
      {label}
    </span>
    <div className="relative">
      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[17px] text-text-stone dark:text-text-secondary pointer-events-none">
        {icon}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none pl-9 pr-8 py-2 text-[12.5px] font-medium text-text-charcoal dark:text-white bg-canvas dark:bg-surface-darker border border-hairline dark:border-white/10 rounded-full outline-none focus:border-ink focus:ring-2 focus:ring-ink/5 dark:focus:border-white dark:focus:ring-white/5 transition-all cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt.value || '__all'} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[16px] text-text-stone pointer-events-none">
        expand_more
      </span>
    </div>
  </div>
);

type ToggleChipProps = {
  active: boolean;
  onClick: () => void;
  icon: string;
  activeIcon?: string;
  label: string;
};

export const ToggleChip: React.FC<ToggleChipProps> = ({
  active,
  onClick,
  icon,
  activeIcon,
  label
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex shrink-0 items-center gap-1.5 px-3.5 py-2 rounded-full text-[12.5px] font-medium border transition-all whitespace-nowrap ${
      active
        ? 'bg-ink text-white border-ink shadow-subtle dark:bg-white dark:text-ink dark:border-white'
        : 'bg-canvas dark:bg-surface-darker border-hairline dark:border-white/10 text-text-charcoal dark:text-text-secondary hover:border-ink hover:text-ink dark:hover:border-white dark:hover:text-white'
    }`}
  >
    <span className={`material-symbols-outlined text-[16px] ${active ? 'fill' : ''}`}>
      {active ? activeIcon || icon : icon}
    </span>
    {label}
  </button>
);

type StatPillProps = {
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
};

export const StatPill: React.FC<StatPillProps> = ({ label, value, highlight }) => (
  <span
    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] ${
      highlight
        ? 'bg-ink text-white dark:bg-white dark:text-ink'
        : 'bg-surface dark:bg-white/5 text-text-charcoal dark:text-text-secondary'
    }`}
  >
    <span
      className={
        highlight
          ? 'text-white/70 dark:text-ink/70 font-medium'
          : 'text-text-steel dark:text-text-secondary font-medium'
      }
    >
      {label}
    </span>
    <span className="font-semibold tabular-nums">{value}</span>
  </span>
);

type ToolbarIconButtonProps = {
  onClick: () => void;
  icon: string;
  label: string;
  tone?: 'default' | 'primary' | 'amber' | 'ink';
  disabled?: boolean;
};

export const ToolbarIconButton: React.FC<ToolbarIconButtonProps> = ({
  onClick,
  icon,
  label,
  tone = 'default',
  disabled
}) => {
  const toneClass =
    tone === 'primary'
      ? 'bg-ink text-white border-ink hover:bg-charcoal dark:bg-white dark:text-ink dark:border-white dark:hover:bg-slate-100'
      : tone === 'amber'
        ? 'bg-brand-yellow text-ink border-brand-yellow hover:bg-brand-yellow-deep'
        : tone === 'ink'
          ? 'bg-ink text-white border-ink hover:bg-charcoal dark:bg-white dark:text-ink dark:border-white dark:hover:bg-slate-100'
          : 'bg-canvas dark:bg-surface-darker text-text-charcoal dark:text-text-secondary border-hairline dark:border-white/10 hover:border-ink hover:text-ink dark:hover:border-white dark:hover:text-white';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex shrink-0 items-center gap-1.5 px-4 py-2 rounded-full text-[12.5px] font-medium border transition-all whitespace-nowrap disabled:opacity-50 ${toneClass}`}
    >
      <span className="material-symbols-outlined text-[16px]">{icon}</span>
      {label}
    </button>
  );
};

type SegmentTab<T extends string> = { id: T; label: string; icon?: string };

type SegmentTabsProps<T extends string> = {
  tabs: SegmentTab<T>[];
  active: T;
  onChange: (id: T) => void;
};

export function SegmentTabs<T extends string>({ tabs, active, onChange }: SegmentTabsProps<T>) {
  return (
    <AnimatedPillTabs
      className="max-w-full"
      aria-label="筛选分类"
      tabs={tabs}
      active={active}
      onChange={onChange}
      layoutId="segment-tabs-selection"
    />
  );
}
