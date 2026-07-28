import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface FormDialogField {
  id: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  hint?: string;
  required?: boolean;
  multiline?: boolean;
  rows?: number;
}

export interface FormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  icon?: string;
  fields: FormDialogField[];
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: (values: Record<string, string>) => void;
}

const FormDialog: React.FC<FormDialogProps> = ({
  isOpen,
  onClose,
  title,
  description,
  icon = 'edit_square',
  fields,
  confirmLabel = '保存',
  cancelLabel = '取消',
  onConfirm
}) => {
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    const init: Record<string, string> = {};
    for (const f of fields) init[f.id] = f.defaultValue ?? '';
    setValues(init);
    setErrors({});
  }, [isOpen, fields]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const setField = (id: string, value: string) => {
    setValues((prev) => ({ ...prev, [id]: value }));
    setErrors((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleConfirm = () => {
    const nextErrors: Record<string, string> = {};
    for (const f of fields) {
      if (f.required && !values[f.id]?.trim()) {
        nextErrors[f.id] = '请填写此项';
      }
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    const out: Record<string, string> = {};
    for (const f of fields) out[f.id] = values[f.id]?.trim() ?? '';
    onConfirm(out);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6 bg-ink/40 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="form-dialog-title"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 6 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="relative bg-canvas dark:bg-surface-dark w-full max-w-md rounded-3xl shadow-modal border border-hairline-soft dark:border-white/10 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-5 py-4 sm:px-6 border-b border-hairline-soft dark:border-white/5 bg-surface-soft/80 dark:bg-white/[0.03]">
              <div className="w-9 h-9 rounded-full bg-brand-yellow text-ink flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[20px]">{icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3
                  id="form-dialog-title"
                  className="text-[15px] font-medium text-text-ink dark:text-white leading-snug"
                >
                  {title}
                </h3>
                {description && (
                  <p className="text-[12px] text-text-slate dark:text-text-secondary mt-0.5 leading-relaxed">
                    {description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 w-8 h-8 inline-flex items-center justify-center text-text-stone hover:text-text-ink dark:hover:text-white hover:bg-surface dark:hover:bg-white/5 rounded-full transition-colors"
                aria-label="关闭"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="px-5 py-4 sm:px-6 sm:py-5 space-y-4 max-h-[min(60vh,420px)] overflow-y-auto">
              {fields.map((field) => (
                <div key={field.id} className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-text-steel dark:text-text-secondary uppercase tracking-[0.06em]">
                    {field.label}
                    {field.required && <span className="text-brand-red ml-0.5">*</span>}
                  </label>
                  {field.multiline ? (
                    <textarea
                      value={values[field.id] ?? ''}
                      onChange={(e) => setField(field.id, e.target.value)}
                      placeholder={field.placeholder}
                      rows={field.rows ?? 3}
                      className="w-full px-4 py-2.5 bg-surface-soft dark:bg-white/[0.03] border border-hairline-strong dark:border-white/10 rounded-2xl text-[13px] text-text-ink dark:text-slate-100 outline-none focus:border-ink dark:focus:border-white transition-all resize-y min-h-[72px] placeholder:text-text-stone"
                    />
                  ) : (
                    <input
                      type="text"
                      value={values[field.id] ?? ''}
                      onChange={(e) => setField(field.id, e.target.value)}
                      placeholder={field.placeholder}
                      className="w-full px-4 py-2.5 bg-surface-soft dark:bg-white/[0.03] border border-hairline-strong dark:border-white/10 rounded-full text-[13px] text-text-ink dark:text-slate-100 outline-none focus:border-ink dark:focus:border-white transition-all placeholder:text-text-stone"
                      autoFocus={fields[0]?.id === field.id}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !field.multiline) {
                          e.preventDefault();
                          handleConfirm();
                        }
                      }}
                    />
                  )}
                  {field.hint && !errors[field.id] && (
                    <p className="text-[11px] text-text-stone dark:text-text-secondary">
                      {field.hint}
                    </p>
                  )}
                  {errors[field.id] && (
                    <p className="text-xs text-coral-dark dark:text-red-400 font-medium">
                      {errors[field.id]}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="border-t border-hairline-soft bg-surface-soft/70 px-4 py-3.5 dark:border-white/5 dark:bg-white/[0.02] sm:px-6 sm:py-4">
              <div className="flex w-full gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex flex-1 sm:flex-initial items-center justify-center whitespace-nowrap rounded-full px-4 py-2.5 text-[13px] font-medium text-text-charcoal transition-colors hover:bg-surface dark:text-text-secondary dark:hover:bg-white/5"
                >
                  {cancelLabel}
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="inline-flex flex-1 sm:flex-initial items-center justify-center whitespace-nowrap rounded-full bg-ink px-5 py-2.5 text-[13px] font-medium text-white transition-all hover:bg-charcoal active:scale-[0.98] dark:bg-white dark:text-ink dark:hover:bg-slate-100"
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

export default FormDialog;
