import React from 'react';
import type { SettingsFieldContext } from '../settingsFieldTypes';

type Props = Pick<
  SettingsFieldContext,
  | 'settings'
  | 'pluginMetadata'
  | 'isLoading'
  | 'handlePublisherChange'
  | 'renderDynamicConfigFields'
>;

export const PublishersField: React.FC<Props> = ({
  settings,
  pluginMetadata,
  isLoading,
  handlePublisherChange,
  renderDynamicConfigFields
}) => {
  if (pluginMetadata.publishers.length === 0) return null;
  const closedPlugins = settings.CLOSED_PLUGINS || [];
  const publishers = (settings.PUBLISHERS || []).filter((p: any) => !closedPlugins.includes(p.id));

  if (isLoading && (!pluginMetadata.publishers || pluginMetadata.publishers.length === 0)) {
    return (
      <div className="col-span-full p-8 text-center bg-surface-soft dark:bg-white/5 rounded-3xl border border-dashed border-hairline dark:border-white/10">
        <p className="text-text-stone text-sm">正在加载发布器元数据...</p>
      </div>
    );
  }

  return (
    <div className="col-span-full space-y-6">
      {pluginMetadata.publishers.map((pubMeta: any) => {
        const pubData = publishers.find((p: any) => p.id === pubMeta.id) || {
          id: pubMeta.id,
          enabled: false,
          config: {}
        };
        return (
          <div
            key={pubMeta.id}
            className="p-6 bg-canvas dark:bg-white/[0.02] rounded-3xl border border-hairline-soft dark:border-white/5 space-y-4 card-interactive-subtle"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-ink dark:text-white">
                  {pubMeta.icon || 'send'}
                </span>
                <span className="font-medium text-text-ink dark:text-white">{pubMeta.name}</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={pubData.enabled}
                  onChange={(e) => handlePublisherChange(pubMeta.id, 'enabled', e.target.checked)}
                />
                <div className="w-11 h-6 bg-hairline peer-focus:outline-none rounded-full peer dark:bg-white/10 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-hairline after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-ink dark:peer-checked:bg-white dark:peer-checked:after:bg-ink"></div>
              </label>
            </div>
            {pubData.enabled && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-hairline-soft dark:border-white/5">
                {renderDynamicConfigFields(
                  pubMeta.configFields || [],
                  pubData.config || {},
                  (key, value) => handlePublisherChange(pubMeta.id, key, value),
                  undefined,
                  `publisher-${pubMeta.id}`
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
