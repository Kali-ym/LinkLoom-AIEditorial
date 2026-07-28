import React from 'react';

interface BuildProgressBarProps {
  step?: number;
  total?: number;
  label?: string;
  className?: string;
  tone?: 'emerald' | 'indigo' | 'blue';
}

export function applyProgressPercent(step?: number, total?: number) {
  if (!total || total <= 0) return null;
  return Math.min(100, Math.round(((step ?? 0) / total) * 100));
}

export function applyProgressDetail(step?: number, total?: number, message?: string) {
  const pct = applyProgressPercent(step, total);
  if (pct == null) return message || '写库中...';
  return `${message || '写库中...'} · ${pct}% (${step ?? 0}/${total})`;
}

export const BuildProgressBar: React.FC<BuildProgressBarProps> = ({
  step,
  total,
  label = '写库进度',
  className = '',
  tone = 'emerald'
}) => {
  const pct = applyProgressPercent(step, total);
  if (pct == null) return null;
  const barClass = tone === 'blue' ? 'bg-ink' : tone === 'indigo' ? 'bg-indigo-500' : 'bg-brand-teal';

  return (
    <div className={className}>
      <div className="mb-1 flex justify-between text-[10px] text-text-slate dark:text-text-stone">
        <span>{label}</span>
        <span>{pct}% · {step ?? 0}/{total}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-hairline dark:bg-canvas/10">
        <div
          className={`h-full rounded-full transition-all duration-300 ease-out ${barClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

interface IndeterminateProgressBarProps {
  label?: string;
  className?: string;
  tone?: 'emerald' | 'indigo' | 'blue';
}

export const IndeterminateProgressBar: React.FC<IndeterminateProgressBarProps> = ({
  label,
  className = '',
  tone = 'indigo'
}) => {
  const barClass = tone === 'emerald'
    ? 'bg-brand-teal'
    : tone === 'blue'
      ? 'bg-ink'
      : 'bg-indigo-500';

  return (
    <div className={className}>
      {label && (
        <p className="mb-1 text-[10px] text-text-slate dark:text-text-stone">{label}</p>
      )}
      <div className="h-1.5 overflow-hidden rounded-full bg-hairline dark:bg-canvas/10">
        <div className={`h-full w-2/5 animate-pulse rounded-full ${barClass}`} />
      </div>
    </div>
  );
};

function splitBuildError(error: string) {
  const lines = error.split('\n').map(line => line.trim()).filter(Boolean);
  return {
    headline: lines[0] || '构建失败',
    details: lines.slice(1)
  };
}

export function BuildErrorPanel({ error, className = '' }: { error: string; className?: string }) {
  const { headline, details } = splitBuildError(error);
  return (
    <div className={`rounded-2xl border border-coral-light bg-coral-light p-3 dark:border-red-500/20 dark:bg-brand-coral/10 ${className}`}>
      <p className="text-xs font-semibold uppercase tracking-widest text-red-700 dark:text-red-200">写库失败</p>
      <p className="mt-2 text-sm font-semibold text-red-900 dark:text-red-100">{headline}</p>
      {details.length > 0 && (
        <ul className="mt-2 space-y-1">
          {details.map((line, index) => (
            <li key={`${line}_${index}`} className="text-xs leading-5 text-red-800 dark:text-red-100">{line}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
