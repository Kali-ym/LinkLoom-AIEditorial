import React from 'react';
import type { SettingsFieldContext } from '../settingsFieldTypes';

type Props = Pick<
  SettingsFieldContext,
  'settings' | 'pluginMetadata' | 'isLoading' | 'handleStorageChange' | 'renderDynamicConfigFields'
>;

export const StoragesField: React.FC<Props> = ({
  settings,
  pluginMetadata,
  isLoading,
  handleStorageChange,
  renderDynamicConfigFields
}) => {
  if (pluginMetadata.storages.length === 0) return null;
  const closedPlugins = settings.CLOSED_PLUGINS || [];
  const storages = (settings.STORAGES || []).filter((s: any) => !closedPlugins.includes(s.id));

  if (isLoading && (!pluginMetadata.storages || pluginMetadata.storages.length === 0)) {
    return (
      <div className="col-span-full p-8 text-center bg-surface-soft dark:bg-white/5 rounded-3xl border border-dashed border-hairline dark:border-white/10">
        <p className="text-text-stone text-sm">正在加载存储元数据...</p>
      </div>
    );
  }

  return (
    <div className="col-span-full space-y-6">
      <p className="text-xs font-semibold text-text-steel uppercase tracking-[0.08em] border-t border-hairline-soft dark:border-white/5 pt-6">
        可用存储插件
      </p>
      {pluginMetadata.storages.map((storageMeta: any) => {
        const storageData = storages.find((s: any) => s.id === storageMeta.id) || {
          id: storageMeta.id,
          enabled: false,
          config: {}
        };
        return (
          <div
            key={storageMeta.id}
            className="p-6 bg-canvas dark:bg-white/[0.02] rounded-3xl border border-hairline-soft dark:border-white/5 space-y-4 card-interactive-subtle"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-ink dark:text-white">
                  {storageMeta.icon || 'cloud_upload'}
                </span>
                <span className="font-medium text-text-ink dark:text-white">
                  {storageMeta.name}
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={storageData.enabled}
                  onChange={(e) => handleStorageChange(storageMeta.id, 'enabled', e.target.checked)}
                />
                <div className="w-11 h-6 bg-hairline peer-focus:outline-none rounded-full peer dark:bg-white/10 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-hairline after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-ink dark:peer-checked:bg-white dark:peer-checked:after:bg-ink"></div>
              </label>
            </div>
            {storageData.enabled && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-hairline-soft dark:border-white/5">
                {renderDynamicConfigFields(
                  storageMeta.configFields || [],
                  storageData.config || {},
                  (key, value) => handleStorageChange(storageMeta.id, key, value),
                  undefined,
                  `storage-${storageMeta.id}`
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
