import React from 'react';

export const EFFECT_STYLES: Record<string, string> = {
  allow: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  ask: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  deny: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
};

export const EFFECT_LABELS: Record<string, string> = {
  allow: '允许',
  ask: '需审批',
  deny: '拒绝'
};

export function StatCard({ label, value, accent, onClick }: {
  label: string;
  value: number | string;
  accent?: string;
  onClick?: () => void;
}): React.JSX.Element {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`rounded-lg border border-hairline bg-white px-4 py-3 text-left dark:border-border-dark dark:bg-surface-dark ${onClick ? 'hover:border-primary/30' : ''}`}
    >
      <p className="text-xs text-text-slate dark:text-text-secondary">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${accent ?? 'text-text-ink dark:text-white'}`}>{value}</p>
    </Wrapper>
  );
}

export function FeatureCard({ title, enabled, description }: {
  title: string;
  enabled: boolean;
  description: string;
}): React.JSX.Element {
  return (
    <div className="rounded-xl border border-hairline bg-white p-4 dark:border-border-dark dark:bg-surface-dark">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-text-ink dark:text-white">{title}</h4>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
          enabled
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
            : 'bg-gray-100 text-gray-600'
        }`}>
          {enabled ? '已启用' : '未启用'}
        </span>
      </div>
      <p className="mt-2 text-xs text-text-slate dark:text-text-secondary">{description}</p>
    </div>
  );
}
