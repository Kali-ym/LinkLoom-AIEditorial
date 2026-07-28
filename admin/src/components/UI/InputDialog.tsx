import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface InputDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  /** 展示在输入框下方的提示（如示例 URL） */
  hint?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  inputType?: 'text' | 'url';
  icon?: string;
  emptyErrorMessage?: string;
  onConfirm: (value: string) => void;
}

const InputDialog: React.FC<InputDialogProps> = ({
  isOpen,
  onClose,
  title,
  description,
  label,
  placeholder,
  defaultValue = '',
  hint,
  confirmLabel = '确定',
  cancelLabel = '取消',
  inputType = 'text',
  icon = 'edit_square',
  emptyErrorMessage = '请填写此项',
  onConfirm
}) => {
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
      setError('');
    }
  }, [isOpen, defaultValue]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const handleConfirm = () => {
    const trimmed = value.trim();
    if (!trimmed) {
      setError(emptyErrorMessage);
      return;
    }
    setError('');
    onConfirm(trimmed);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6 bg-ink/40 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="input-dialog-title"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.2 }}
            className="bg-canvas dark:bg-surface-dark w-full max-w-md rounded-3xl shadow-modal border border-hairline-soft dark:border-white/10 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-hairline-soft dark:border-white/5 flex items-start justify-between gap-4 bg-surface-soft/80 dark:bg-white/[0.02]">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-11 h-11 rounded-full bg-brand-yellow text-ink flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-2xl">{icon}</span>
                </div>
                <div className="min-w-0">
                  <h3
                    id="input-dialog-title"
                    className="text-lg font-medium text-text-ink dark:text-white leading-tight"
                  >
                    {title}
                  </h3>
                  {description && (
                    <p className="text-xs text-text-slate dark:text-text-secondary mt-1.5 leading-relaxed">
                      {description}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 shrink-0 inline-flex items-center justify-center text-text-stone hover:text-text-ink hover:bg-surface dark:hover:bg-white/5 dark:hover:text-white rounded-full transition-all"
                aria-label="关闭"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-semibold text-text-steel dark:text-text-secondary uppercase tracking-[0.08em] ml-0.5">
                  {label}
                </label>
                <input
                  type={inputType}
                  value={value}
                  onChange={(e) => {
                    setValue(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder={placeholder}
                  className="w-full px-4 py-3 bg-surface-soft dark:bg-white/[0.03] border border-hairline-strong dark:border-white/10 rounded-full text-sm text-text-ink dark:text-white outline-none focus:border-ink dark:focus:border-white transition-all font-mono placeholder:text-text-stone"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleConfirm();
                    }
                  }}
                />
                {hint && !error && (
                  <p className="text-[11px] text-text-stone dark:text-text-secondary leading-relaxed pl-0.5">
                    {hint}
                  </p>
                )}
                {error && (
                  <p className="text-xs text-coral-dark dark:text-red-400 font-medium pl-0.5">
                    {error}
                  </p>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex flex-1 items-center justify-center whitespace-nowrap rounded-full border border-hairline-strong py-2.5 text-sm font-medium text-text-charcoal transition-all hover:border-ink hover:text-ink dark:border-white/10 dark:text-text-secondary dark:hover:border-white dark:hover:text-white"
                >
                  {cancelLabel}
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="inline-flex flex-1 items-center justify-center whitespace-nowrap rounded-full bg-ink py-2.5 text-sm font-medium text-white transition-all hover:bg-charcoal active:scale-[0.98] dark:bg-white dark:text-ink dark:hover:bg-slate-100"
                >
                  {confirmLabel}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default InputDialog;
