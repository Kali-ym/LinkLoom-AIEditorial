import React from 'react';
import type { SettingsFieldContext } from '../settingsFieldTypes';

type Props = Pick<
  SettingsFieldContext,
  | 'settings'
  | 'pluginMetadata'
  | 'isImportingOPML'
  | 'handleAdapterChange'
  | 'handleAddItem'
  | 'handleDeleteItem'
  | 'handleAddAdapter'
  | 'handleDeleteAdapter'
  | 'handleMoveAdapter'
  | 'handleMoveAdapterItem'
  | 'handleImportOPML'
  | 'renderDynamicConfigFields'
>;

export const AdaptersField: React.FC<Props> = ({
  settings,
  pluginMetadata,
  isImportingOPML,
  handleAdapterChange,
  handleAddItem,
  handleDeleteItem,
  handleAddAdapter,
  handleDeleteAdapter,
  handleMoveAdapter,
  handleMoveAdapterItem,
  handleImportOPML,
  renderDynamicConfigFields
}) => {
  const closedPlugins = settings.CLOSED_PLUGINS || [];
  const adapters = (settings.ADAPTERS || []).filter(
    (a: any) => !closedPlugins.includes(a.adapterType)
  );

  if (adapters.length === 0 && pluginMetadata.adapters.length === 0) {
    return (
      <div className="col-span-full text-text-stone text-xs italic p-4 bg-surface-soft dark:bg-white/5 rounded-2xl">
        暂无可用适配器（插件已全部禁用）
      </div>
    );
  }

  return (
    <div className="col-span-full space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-text-ink dark:text-white uppercase tracking-wider">
          适配器列表
        </h4>
      </div>
      <div className="grid gap-6">
        {adapters.map((adapter: any, idx: number) => (
          <div
            key={`${adapter.id}-${idx}`}
            className={`
                  rounded-2xl border transition-all duration-300 overflow-hidden
                  ${
                    adapter.enabled
                      ? 'bg-canvas dark:bg-surface-dark border-ink/20 shadow-subtle'
                      : 'bg-surface-soft/50 dark:bg-white/[0.01] border-hairline-soft dark:border-white/5 opacity-80'
                  }
                `}
          >
            <div
              className={`
                  px-6 py-4 border-b flex flex-col gap-4 transition-colors
                  ${
                    adapter.enabled
                      ? 'bg-surface-lavender border-hairline dark:bg-white/[0.04]'
                      : 'bg-surface/50 dark:bg-white/[0.03] border-hairline-soft dark:border-white/5'
                  }
                `}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className={`material-symbols-outlined ${adapter.enabled ? 'text-ink' : 'text-text-stone'}`}
                  >
                    extension
                  </span>
                  <span
                    className={`font-medium ${adapter.enabled ? 'text-text-ink dark:text-white' : 'text-text-slate'}`}
                  >
                    {adapter.name}
                  </span>
                  <span className="chip-neutral font-mono">{adapter.adapterType}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleMoveAdapter(adapter.id, 'up')}
                      disabled={idx === 0}
                      title="上移适配器组"
                      className="w-8 h-8 flex items-center justify-center text-text-stone hover:text-ink hover:bg-surface rounded-full transition-all disabled:opacity-40 disabled:text-text-stone disabled:cursor-not-allowed"
                    >
                      <span className="material-symbols-outlined text-xl">arrow_upward</span>
                    </button>
                    <button
                      onClick={() => handleMoveAdapter(adapter.id, 'down')}
                      disabled={idx === adapters.length - 1}
                      title="下移适配器组"
                      className="w-8 h-8 flex items-center justify-center text-text-stone hover:text-ink hover:bg-surface rounded-full transition-all disabled:opacity-40 disabled:text-text-stone disabled:cursor-not-allowed"
                    >
                      <span className="material-symbols-outlined text-xl">arrow_downward</span>
                    </button>
                  </div>
                  <div className="w-px h-4 bg-hairline dark:bg-white/10 mx-0.5"></div>
                  {adapter.adapterType === 'RSSAdapter' && (
                    <label
                      className={`
                          flex items-center gap-2 px-3 py-1 bg-surface-lavender text-ink-deep hover:bg-ink hover:text-white rounded-full text-[10px] font-semibold uppercase tracking-wider transition-all cursor-pointer
                          ${isImportingOPML ? 'opacity-50 cursor-not-allowed' : ''}
                        `}
                    >
                      <span className="material-symbols-outlined text-sm">
                        {isImportingOPML ? 'hourglass_top' : 'upload_file'}
                      </span>
                      {isImportingOPML ? '正在解析...' : '导入 OPML'}
                      <input
                        type="file"
                        accept=".opml,.xml"
                        className="hidden"
                        onChange={handleImportOPML(adapter.id)}
                        disabled={isImportingOPML}
                      />
                    </label>
                  )}
                  <button
                    onClick={() => handleDeleteAdapter(adapter.id)}
                    className="w-8 h-8 flex items-center justify-center text-text-stone hover:text-coral-dark hover:bg-coral-light dark:hover:bg-red-500/10 rounded-full transition-all"
                    title="删除整个适配器组"
                  >
                    <span className="material-symbols-outlined text-xl">delete</span>
                  </button>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={adapter.enabled}
                      onChange={(e) =>
                        handleAdapterChange(adapter.id, null, 'enabled', e.target.checked)
                      }
                    />
                    <div className="w-11 h-6 bg-hairline peer-focus:outline-none rounded-full peer dark:bg-white/10 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-hairline after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-ink dark:peer-checked:bg-white dark:peer-checked:after:bg-ink"></div>
                  </label>
                </div>
              </div>
              {adapter.enabled && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(() => {
                      const adapterMeta = pluginMetadata.adapters.find(
                        (a) => a.type === adapter.adapterType
                      );
                      return adapterMeta
                        ? renderDynamicConfigFields(
                            adapterMeta.configFields || [],
                            adapter,
                            (key, value) => handleAdapterChange(adapter.id, null, key, value),
                            'adapter',
                            `adapter-${adapter.id}`
                          )
                        : null;
                    })()}
                  </div>
                </div>
              )}
            </div>

            {adapter.enabled && adapter.items && (
              <div className="p-6 space-y-4">
                {adapter.items.map((item: any, itemIdx: number) => (
                  <div
                    key={`${item.id}-${itemIdx}`}
                    className={`
                          group flex flex-col md:flex-row md:items-center gap-4 p-4 rounded-3xl border transition-all duration-200 card-interactive-subtle
                          ${
                            item.enabled
                              ? 'bg-canvas dark:bg-surface-darker border-hairline-soft dark:border-white/10 shadow-subtle'
                              : 'bg-surface-soft/30 dark:bg-black/10 border-hairline-soft dark:border-white/5 opacity-60'
                          }
                        `}
                  >
                    <div className="flex-1 space-y-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) =>
                            handleAdapterChange(adapter.id, item.id, 'name', e.target.value)
                          }
                          placeholder="数据项名称"
                          className={`font-medium bg-transparent border-none p-0 focus:ring-0 min-w-[120px] flex-1 sm:flex-initial ${item.enabled ? 'text-text-ink dark:text-white' : 'text-text-slate'}`}
                        />
                        <div className="flex flex-wrap items-center gap-3">
                          <select
                            value={item.category || ''}
                            onChange={(e) =>
                              handleAdapterChange(adapter.id, item.id, 'category', e.target.value)
                            }
                            className={`text-[10px] px-2 py-1 rounded-full uppercase border-none focus:ring-0 cursor-pointer ${item.enabled ? 'bg-surface-lavender text-ink-deep' : 'bg-surface dark:bg-white/10 text-text-slate'}`}
                          >
                            {(settings.CATEGORIES || []).map((cat: any) => (
                              <option key={cat.id} value={cat.id}>
                                {cat.label}
                              </option>
                            ))}
                          </select>
                          <div className="flex items-center gap-4">
                            <label className="flex items-center gap-1.5 cursor-pointer group">
                              <input
                                type="checkbox"
                                checked={item.useProxy ?? false}
                                onChange={(e) =>
                                  handleAdapterChange(
                                    adapter.id,
                                    item.id,
                                    'useProxy',
                                    e.target.checked
                                  )
                                }
                                className="w-3.5 h-3.5 rounded border-hairline-strong dark:border-white/20 text-ink focus:ring-ink/20 bg-transparent"
                              />
                              <span className="text-[10px] font-semibold text-text-stone group-hover:text-ink transition-colors uppercase tracking-wider">
                                代理
                              </span>
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer group">
                              <input
                                type="checkbox"
                                checked={item.enableTranslation ?? false}
                                onChange={(e) =>
                                  handleAdapterChange(
                                    adapter.id,
                                    item.id,
                                    'enableTranslation',
                                    e.target.checked
                                  )
                                }
                                className="w-3.5 h-3.5 rounded border-hairline-strong dark:border-white/20 text-ink focus:ring-ink/20 bg-transparent"
                              />
                              <span className="text-[10px] font-semibold text-text-stone group-hover:text-ink transition-colors uppercase tracking-wider">
                                翻译
                              </span>
                            </label>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-4 items-end pt-2 border-t border-hairline-soft dark:border-white/5">
                        {(() => {
                          const adapterMeta = pluginMetadata.adapters.find(
                            (a) => a.type === adapter.adapterType
                          );
                          return adapterMeta
                            ? renderDynamicConfigFields(
                                adapterMeta.configFields || [],
                                item,
                                (key, value) =>
                                  handleAdapterChange(adapter.id, item.id, key, value),
                                'item',
                                `item-${item.id}`
                              )
                            : null;
                        })()}
                      </div>
                    </div>
                    <div className="flex items-center justify-between md:justify-end gap-6 pt-4 md:pt-0 border-t md:border-none border-hairline-soft dark:border-white/5">
                      <div className="md:hidden text-[10px] font-semibold text-text-stone uppercase tracking-widest">
                        状态与操作
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col gap-0">
                          <button
                            onClick={() => handleMoveAdapterItem(adapter.id, item.id, 'up')}
                            disabled={itemIdx === 0}
                            title="上移此项"
                            className="w-6 h-4 flex items-center justify-center text-text-stone hover:text-ink transition-all disabled:opacity-40 disabled:text-text-stone disabled:cursor-not-allowed"
                          >
                            <span className="material-symbols-outlined text-base">expand_less</span>
                          </button>
                          <button
                            onClick={() => handleMoveAdapterItem(adapter.id, item.id, 'down')}
                            disabled={itemIdx === adapter.items.length - 1}
                            title="下移此项"
                            className="w-6 h-4 flex items-center justify-center text-text-stone hover:text-ink transition-all disabled:opacity-40 disabled:text-text-stone disabled:cursor-not-allowed"
                          >
                            <span className="material-symbols-outlined text-base">expand_more</span>
                          </button>
                        </div>
                        <div className="w-px h-4 bg-hairline dark:bg-white/10 mx-0.5"></div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={item.enabled}
                            onChange={(e) =>
                              handleAdapterChange(adapter.id, item.id, 'enabled', e.target.checked)
                            }
                          />
                          <div className="w-10 h-6 bg-hairline peer-focus:outline-none rounded-full peer dark:bg-white/10 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-hairline after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-ink dark:peer-checked:bg-white dark:peer-checked:after:bg-ink"></div>
                        </label>
                        <button
                          onClick={() => handleDeleteItem(adapter.id, item.id)}
                          className="w-9 h-9 inline-flex items-center justify-center text-text-stone hover:text-coral-dark hover:bg-coral-light dark:hover:bg-red-500/10 rounded-full transition-all"
                          title="删除此项"
                        >
                          <span className="material-symbols-outlined text-xl">delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => handleAddItem(adapter.id)}
                  className="w-full py-3 border-2 border-dashed border-hairline dark:border-white/5 rounded-3xl text-text-stone hover:text-ink hover:border-ink/40 hover:bg-surface-soft transition-all text-sm font-medium flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-lg">add_circle</span>
                  添加子项数据源
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 p-6 bg-surface-soft/50 dark:bg-white/[0.02] border-2 border-dashed border-hairline dark:border-white/10 rounded-3xl">
        <div className="text-sm font-medium text-text-slate dark:text-text-secondary">
          新增适配器组：
        </div>
        <div className="flex flex-1 gap-2 w-full min-w-0">
          <div className="relative flex-1 min-w-0">
            <select
              id="new-adapter-type"
              className="w-full appearance-none pl-4 pr-10 py-2 bg-canvas dark:bg-surface-dark border border-hairline-strong dark:border-white/10 rounded-full text-sm focus:border-ink dark:focus:border-white outline-none transition-all cursor-pointer dark:text-white"
            >
              {pluginMetadata.adapters.map((meta) => (
                <option key={meta.type} value={meta.type}>
                  {meta.name} ({meta.type})
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[20px] leading-none text-text-stone">
              expand_more
            </span>
          </div>
          <button
            onClick={() => {
              const select = document.getElementById('new-adapter-type') as HTMLSelectElement;
              if (select) handleAddAdapter(select.value);
            }}
            className="px-6 py-2 bg-ink hover:bg-charcoal dark:bg-white dark:text-ink text-white font-medium rounded-full transition-all active:scale-95 flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            添加
          </button>
        </div>
      </div>
    </div>
  );
};
