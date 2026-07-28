import React from 'react';
import { MODE_OPTIONS } from '../shared/ragFieldMeta.js';
import { StatusChip } from '../shared/ragUi.js';
import { applyModePreset, detectRagMode } from './retrieveModeUtils.js';

type Props = {
  ragConfig: Record<string, unknown>;
  onPatch: (patch: Record<string, unknown>) => void;
};

export const RetrieveModeSelector: React.FC<Props> = ({ ragConfig, onPatch }) => {
  const activeMode = detectRagMode(ragConfig);

  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-text-ink dark:text-white">检索模式</p>
      <div className="flex flex-wrap items-center gap-2">
        {MODE_OPTIONS.map((opt) => {
          const isActive = activeMode === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              title={opt.hint}
              onClick={() => onPatch(applyModePreset(opt.id))}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                isActive
                  ? 'bg-ink text-white dark:bg-white dark:text-ink'
                  : 'bg-surface-soft text-text-slate hover:text-ink dark:bg-white/[0.04] dark:text-text-secondary'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
        {activeMode === 'custom' && (
          <StatusChip label="自定义组合" tone="slate" />
        )}
      </div>
      <p className="mt-2 text-[13px] text-text-charcoal dark:text-text-secondary">
        {activeMode === 'custom'
          ? '当前开关组合与预设不一致；可在下方高级区逐项调整。'
          : '切换模式自动写入关联开关；手动偏离后显示「自定义组合」。'}
      </p>
    </div>
  );
};
