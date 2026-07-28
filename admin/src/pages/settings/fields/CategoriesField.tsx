import React from 'react';
import type { SettingsFieldContext } from '../settingsFieldTypes';

type Props = Pick<
  SettingsFieldContext,
  | 'settings'
  | 'handleCategoryChange'
  | 'handleMoveCategory'
  | 'handleAddCategory'
  | 'handleDeleteCategory'
  | 'onOpenIconPicker'
>;

export const CategoriesField: React.FC<Props> = ({
  settings,
  handleCategoryChange,
  handleMoveCategory,
  handleAddCategory,
  handleDeleteCategory,
  onOpenIconPicker
}) => {
  const categories = settings.CATEGORIES || [];

  return (
    <div className="col-span-full space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {categories.map((cat: any, index: number) => (
          <div
            key={cat._tempId || index}
            className="flex items-center gap-4 p-4 bg-canvas dark:bg-white/[0.02] rounded-3xl border border-hairline-soft dark:border-white/5 card-interactive-subtle"
          >
            <div className="flex flex-col gap-1">
              <button
                onClick={() => handleMoveCategory(cat.id, 'up')}
                disabled={index === 0}
                title="上移"
                className="w-6 h-6 flex items-center justify-center text-text-stone hover:text-ink transition-all disabled:opacity-40 disabled:text-text-stone disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-base">expand_less</span>
              </button>
              <button
                onClick={() => handleMoveCategory(cat.id, 'down')}
                disabled={index === categories.length - 1}
                title="下移"
                className="w-6 h-6 flex items-center justify-center text-text-stone hover:text-ink transition-all disabled:opacity-40 disabled:text-text-stone disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-base">expand_more</span>
              </button>
            </div>
            <div className="flex-1 space-y-4">
              <div className="flex gap-2">
                <div className="flex-1 space-y-1">
                  <label className="text-[10px] font-semibold text-text-steel uppercase tracking-widest ml-1">
                    分类名称
                  </label>
                  <input
                    type="text"
                    value={cat.label}
                    onChange={(e) => handleCategoryChange(cat.id, 'label', e.target.value)}
                    className="w-full px-3 py-1.5 bg-canvas dark:bg-surface-dark border border-hairline-strong dark:border-white/10 rounded-full text-xs text-text-ink dark:text-white focus:border-ink dark:focus:border-white outline-none transition-all"
                  />
                </div>
                <div className="w-24 space-y-1">
                  <label className="text-[10px] font-semibold text-text-steel uppercase tracking-widest ml-1">
                    ID (英文)
                  </label>
                  <input
                    type="text"
                    value={cat.id}
                    onChange={(e) => handleCategoryChange(cat.id, 'id', e.target.value)}
                    className="w-full px-3 py-1.5 bg-canvas dark:bg-surface-dark border border-hairline-strong dark:border-white/10 rounded-full text-xs text-text-slate font-mono focus:border-ink dark:focus:border-white outline-none transition-all"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-text-steel uppercase tracking-widest ml-1">
                  图标名称
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onOpenIconPicker(cat.id, cat.icon || 'label')}
                    className="flex items-center justify-center w-10 h-10 rounded-full bg-brand-yellow text-ink border border-brand-yellow hover:bg-brand-yellow-deep transition-all active:scale-95"
                    title="点击选择图标"
                  >
                    <span className="material-symbols-outlined text-xl">{cat.icon || 'label'}</span>
                  </button>
                  <input
                    type="text"
                    value={cat.icon || ''}
                    placeholder="article, trending_up, etc."
                    onChange={(e) => handleCategoryChange(cat.id, 'icon', e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-canvas dark:bg-surface-dark border border-hairline-strong dark:border-white/10 rounded-full text-xs text-text-charcoal dark:text-white focus:border-ink dark:focus:border-white outline-none transition-all"
                  />
                </div>
              </div>
            </div>
            <button
              onClick={() => handleDeleteCategory(cat.id)}
              className="w-9 h-9 inline-flex items-center justify-center text-text-stone hover:text-coral-dark hover:bg-coral-light dark:hover:bg-red-500/10 rounded-full transition-all"
            >
              <span className="material-symbols-outlined">delete</span>
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={handleAddCategory}
        className="w-full py-4 border-2 border-dashed border-hairline dark:border-white/5 rounded-3xl text-text-stone hover:text-ink hover:border-ink/40 hover:bg-surface-soft transition-all text-sm font-medium flex items-center justify-center gap-2"
      >
        <span className="material-symbols-outlined">add_circle</span>
        添加新分类标签
      </button>
    </div>
  );
};
