import React from 'react';

const btnCancel =
  'inline-flex flex-1 sm:flex-initial items-center justify-center whitespace-nowrap rounded-full border border-hairline-strong px-4 py-2.5 text-[13px] font-medium text-text-charcoal transition-colors hover:border-ink hover:text-ink dark:border-white/10 dark:text-text-secondary dark:hover:border-white dark:hover:text-white';
const btnPrimary =
  'inline-flex flex-1 sm:flex-initial items-center justify-center whitespace-nowrap rounded-full bg-ink px-5 py-2.5 text-[13px] font-semibold text-white shadow shadow-primary/20 transition-all hover:bg-charcoal disabled:opacity-60 dark:bg-white dark:text-ink dark:hover:bg-slate-100';

type DialogFooterProps = {
  hint?: React.ReactNode;
  error?: string | null;
  children: React.ReactNode;
  className?: string;
};

/** 弹窗底栏：移动端按钮整行不换行，提示文案单独一行 */
export const DialogFooter: React.FC<DialogFooterProps> = ({
  hint,
  error,
  children,
  className = ''
}) => (
  <div
    className={`flex shrink-0 flex-col gap-3 border-t border-hairline-soft bg-surface-soft/70 p-4 dark:border-white/5 dark:bg-canvas/5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-5 ${className}`.trim()}
  >
    {(hint || error) && (
      <p
        className={`min-w-0 text-xs leading-relaxed ${error ? 'text-rose-500 dark:text-rose-400' : 'text-text-slate dark:text-text-secondary'}`}
      >
        {error || hint}
      </p>
    )}
    <div className="flex w-full min-w-0 gap-2 sm:w-auto sm:shrink-0">{children}</div>
  </div>
);

type DialogFooterButtonsProps = {
  cancelLabel?: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm?: () => void;
  confirmType?: 'button' | 'submit';
  confirming?: boolean;
  confirmDisabled?: boolean;
};

export const DialogFooterButtons: React.FC<DialogFooterButtonsProps> = ({
  cancelLabel = '取消',
  confirmLabel,
  onCancel,
  onConfirm,
  confirmType = 'button',
  confirming = false,
  confirmDisabled = false
}) => (
  <>
    <button type="button" onClick={onCancel} className={btnCancel}>
      {cancelLabel}
    </button>
    <button
      type={confirmType}
      onClick={confirmType === 'button' ? onConfirm : undefined}
      disabled={confirmDisabled || confirming}
      className={btnPrimary}
    >
      {confirmLabel}
    </button>
  </>
);

export { btnCancel, btnPrimary };
