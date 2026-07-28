import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface CategoryOption {
  id: string;
  name: string;
  description?: string;
}

export interface CategoryPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  categories: CategoryOption[];
  selectedIds: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  emptyHint?: string;
  onConfirm: (ids: string[]) => void;
}

const CategoryPickerModal: React.FC<CategoryPickerModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  categories,
  selectedIds,
  confirmLabel = '确定',
  cancelLabel = '取消',
  emptyHint = '请至少选择一个分类',
  onConfirm
}) => {
  const [picked, setPicked] = useState<string[]>(selectedIds);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setPicked(selectedIds);
      setError('');
    }
  }, [isOpen, selectedIds]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const toggle = (id: string) => {
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setError('');
  };

  const handleConfirm = () => {
    if (picked.length === 0) {
      setError(emptyHint);
      return;
    }
    onConfirm(picked);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            className="relative w-full max-w-lg bg-canvas dark:bg-surface-dark rounded-3xl shadow-modal border border-hairline-soft dark:border-white/10 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-hairline-soft dark:border-white/5 bg-surface-soft/80 dark:bg-white/[0.02]">
              <h3 className="text-lg font-medium text-text-ink dark:text-white">{title}</h3>
              {description && (
                <p className="mt-1.5 text-sm text-text-slate dark:text-text-secondary">{description}</p>
              )}
            </div>

            <div className="px-6 py-4 max-h-[min(50vh,360px)] overflow-y-auto">
              {categories.length === 0 ? (
                <p className="text-sm text-text-slate dark:text-text-secondary py-6 text-center">
                  暂无分类，请先在「知识与记忆」中创建。
                </p>
              ) : (
                <div className="space-y-2">
                  {categories.map((cat) => {
                    const checked = picked.includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => toggle(cat.id)}
                        className={`w-full text-left px-4 py-3 rounded-2xl border transition-all ${
                          checked
                            ? 'border-ink/20 bg-surface-lavender dark:bg-white/5'
                            : 'border-hairline-soft dark:border-white/10 hover:border-ink/30 hover:bg-surface-soft'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={`material-symbols-outlined text-[20px] mt-0.5 ${
                              checked ? 'text-ink-deep dark:text-white' : 'text-text-stone'
                            }`}
                          >
                            {checked ? 'check_box' : 'check_box_outline_blank'}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-sm text-text-ink dark:text-white">{cat.name}</div>
                            {cat.description && (
                              <div className="text-xs text-text-slate dark:text-text-secondary mt-0.5 line-clamp-2">
                                {cat.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              {error && <p className="mt-3 text-xs font-medium text-coral-dark">{error}</p>}
            </div>

            <div className="px-6 py-4 border-t border-hairline-soft dark:border-white/5 flex justify-end gap-2 bg-surface-soft/70 dark:bg-white/[0.02]">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-full text-sm font-medium text-text-charcoal dark:text-text-secondary hover:bg-surface dark:hover:bg-white/5"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={categories.length === 0}
                className="px-5 py-2 rounded-full text-sm font-medium btn-pill-primary disabled:opacity-100"
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default CategoryPickerModal;
