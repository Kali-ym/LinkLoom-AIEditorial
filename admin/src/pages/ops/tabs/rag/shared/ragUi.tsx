import React from 'react';
import { opsHintClass, opsInputClass, opsSelectClass } from '../../../opsUiPrimitives';

export type ChipTone = 'green' | 'amber' | 'slate' | 'red' | 'blue';

export function chipClass(tone: ChipTone) {
  const map = {
    green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200',
    amber: 'bg-amber-50 text-amber-800 dark:bg-amber-400/10 dark:text-amber-100',
    slate: 'bg-surface-soft text-text-slate dark:bg-white/5 dark:text-text-secondary',
    red: 'bg-red-50 text-red-700 dark:bg-red-400/10 dark:text-red-100',
    blue: 'bg-blue-50 text-blue-700 dark:bg-blue-400/10 dark:text-blue-100'
  };
  return map[tone];
}

export function StatusChip({ label, tone = 'slate' }: { label: string; tone?: ChipTone }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${chipClass(tone)}`}
    >
      {label}
    </span>
  );
}

export function SectionCard({
  id,
  title,
  subtitle,
  children,
  className = ''
}: {
  id?: string;
  title?: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={`min-w-0 overflow-hidden rounded-2xl border border-hairline-soft bg-canvas p-4 dark:border-white/10 dark:bg-surface-dark ${className}`}
    >
      {(title || subtitle) && (
        <div className="mb-4 flex flex-col gap-1">
          {title && <h4 className="text-base font-semibold text-text-ink dark:text-white">{title}</h4>}
          {subtitle && (
            <p className="text-[13px] text-text-charcoal dark:text-text-secondary">{subtitle}</p>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

export function NumberField({
  meta,
  value,
  onChange
}: {
  meta: import('./ragFieldMeta.js').FieldMeta;
  value: number | string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="space-y-1 text-sm text-text-slate dark:text-text-secondary">
      <span className="flex items-center justify-between gap-2">
        <span>{meta.label}</span>
        {meta.suffix && <span className="text-[12px] text-text-stone">{meta.suffix}</span>}
      </span>
      <input
        type="number"
        min={meta.min}
        max={meta.max}
        className={`w-full ${opsInputClass}`}
        value={value}
        placeholder={meta.placeholder}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <p className={opsHintClass}>{meta.hint}</p>
    </label>
  );
}

export function ToggleCard({
  checked,
  label,
  hint,
  disabled,
  onChange
}: {
  checked: boolean;
  label: string;
  hint: string;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`rounded-2xl border p-3 text-left transition-all ${
        checked
          ? 'border-ink/30 bg-ink/[0.04] dark:border-white/30 dark:bg-white/10'
          : 'border-hairline-soft bg-surface-soft/60 hover:border-ink/20 dark:border-white/10 dark:bg-white/[0.03]'
      } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text-ink dark:text-white">{label}</p>
          <p className={`mt-1 ${opsHintClass}`}>{hint}</p>
        </div>
        <span
          className={`mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${
            checked ? 'bg-ink dark:bg-white' : 'bg-hairline dark:bg-white/20'
          }`}
        >
          <span
            className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform dark:bg-ink ${checked ? 'translate-x-5' : ''}`}
          />
        </span>
      </div>
    </button>
  );
}

export const ragTextareaClass = `${opsInputClass} resize-y`;
export { opsInputClass, opsSelectClass, opsHintClass };
