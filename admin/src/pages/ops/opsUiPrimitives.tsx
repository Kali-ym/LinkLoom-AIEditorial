import React, { useCallback } from 'react';

export function getOpsErrorMessage(err: unknown, fallback = '加载失败，请稍后重试'): string {
  if (err instanceof Error && err.message.trim()) return err.message;
  if (typeof err === 'string' && err.trim()) return err;
  return fallback;
}

type OpsErrorBannerProps = {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
};

export function OpsErrorBanner({ message, onRetry, retryLabel = '重试', className = '' }: OpsErrorBannerProps) {
  return (
    <div
      role="alert"
      className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-light bg-rose-light px-4 py-3 dark:border-red-500/20 dark:bg-red-500/10 ${className}`.trim()}
    >
      <div className="flex min-w-0 items-start gap-2">
        <span className="material-symbols-outlined text-[18px] text-coral-dark dark:text-red-400">error</span>
        <p className="text-[13px] font-medium text-coral-dark dark:text-red-400">{message}</p>
      </div>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-pill-secondary !text-xs !py-1.5 !px-3 shrink-0">
          {retryLabel}
        </button>
      )}
    </div>
  );
}

type OpsRefreshButtonProps = {
  onClick: () => void;
  label?: string;
  disabled?: boolean;
};

export function OpsRefreshButton({ onClick, label = '刷新', disabled }: OpsRefreshButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="btn-pill-secondary !text-xs !py-1.5 !px-3 disabled:opacity-50"
    >
      {label}
    </button>
  );
}

type OpsTextActionProps = {
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
};

export function OpsTextAction({ onClick, children, className = '', disabled }: OpsTextActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`btn-pill-ghost !text-xs !py-1 !px-2 text-primary hover:text-primary-deep dark:text-primary disabled:opacity-50 disabled:cursor-not-allowed ${className}`.trim()}
    >
      {children}
    </button>
  );
}

type OpsEmptyStateProps = {
  icon: string;
  title: string;
  description?: string;
  iconClassName?: string;
};

export function OpsEmptyState({ icon, title, description, iconClassName = 'text-primary' }: OpsEmptyStateProps) {
  return (
    <div className="rounded-2xl border border-hairline-soft bg-canvas px-6 py-14 text-center dark:border-white/5 dark:bg-surface-dark">
      <span className={`material-symbols-outlined text-4xl ${iconClassName}`}>{icon}</span>
      <p className="mt-3 text-sm font-medium text-text-ink dark:text-white">{title}</p>
      {description && (
        <p className="mt-1 text-[13px] text-text-charcoal dark:text-text-secondary">{description}</p>
      )}
    </div>
  );
}

export function OpsTableHead({
  children,
  className = ''
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-4 py-3 text-[12px] font-medium text-text-charcoal dark:text-text-secondary ${className}`.trim()}
    >
      {children}
    </th>
  );
}

export const opsInputClass =
  'rounded-2xl border border-hairline-strong bg-canvas px-3 py-2 text-sm text-text-ink outline-none focus:border-ink focus:ring-2 focus:ring-ink/10 dark:border-white/10 dark:bg-surface-dark dark:text-white dark:focus:border-white dark:focus:ring-white/10';

export const opsSelectClass =
  'rounded-2xl border border-hairline-strong bg-canvas px-3 py-2 text-sm text-text-ink outline-none focus:border-ink focus:ring-2 focus:ring-ink/10 dark:border-white/10 dark:bg-surface-dark dark:text-white dark:focus:border-white dark:focus:ring-white/10';

export const opsHintClass = 'text-[12px] leading-relaxed text-text-charcoal dark:text-text-secondary';

type OpsLabelWithHintProps = {
  label: string;
  hint: string;
  className?: string;
};

/** 带虚线下划线的标签，hover 显示释义 */
export function OpsLabelWithHint({ label, hint, className = '' }: OpsLabelWithHintProps) {
  return (
    <span
      title={hint}
      className={`cursor-help border-b border-dotted border-text-stone/40 ${className}`.trim()}
    >
      {label}
    </span>
  );
}

export type OpsSubNavItem<T extends string> = { id: T; label: string };

type OpsSubNavProps<T extends string> = {
  items: OpsSubNavItem<T>[];
  active: T;
  onChange: (id: T) => void;
  'aria-label'?: string;
  className?: string;
};

/** 次级分段导航：浅色底 + 白卡片选中态，与一级 ink pill 区分层级 */
export function OpsSubNav<T extends string>({
  items,
  active,
  onChange,
  'aria-label': ariaLabel,
  className = ''
}: OpsSubNavProps<T>) {
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const currentIndex = items.findIndex((item) => item.id === active);
      if (currentIndex < 0) return;

      let nextIndex: number | null = null;
      if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % items.length;
      else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + items.length) % items.length;
      else if (event.key === 'Home') nextIndex = 0;
      else if (event.key === 'End') nextIndex = items.length - 1;

      if (nextIndex == null) return;
      event.preventDefault();
      onChange(items[nextIndex].id);
    },
    [active, items, onChange]
  );

  return (
    <div
      className={`flex flex-wrap gap-1 rounded-xl border border-hairline-soft bg-surface-soft/60 p-1 dark:border-white/5 dark:bg-white/[0.03] ${className}`.trim()}
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
    >
      {items.map((item) => {
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(item.id)}
            className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20 dark:focus-visible:ring-white/20 ${
              isActive
                ? 'bg-canvas text-text-ink shadow-sm ring-1 ring-hairline-soft dark:bg-surface-dark dark:text-white dark:ring-white/10'
                : 'text-text-charcoal hover:bg-canvas/50 hover:text-text-ink dark:text-text-secondary dark:hover:bg-white/[0.04] dark:hover:text-white'
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export type OpsConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
};
