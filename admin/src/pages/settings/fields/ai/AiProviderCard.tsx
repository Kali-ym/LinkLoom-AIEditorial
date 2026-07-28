import React from 'react';
import {
  AI_PROVIDER_TYPE_META,
  extractHost,
  getEndpointPath,
  getPrimaryModel,
  isProviderMultimodalEnabled,
  maskApiKeyDisplay,
  normalizeApiEndpoint,
  type ProviderTestResult
} from './aiProviderUtils';
import { getTestStatusLabel, getTestStatusStyles } from './testStatusStyles';

export interface AiProviderCardProps {
  provider: any;
  isActive: boolean;
  testResult?: ProviderTestResult;
  isTesting: boolean;
  onTest: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onSetActive: () => void;
}

export const AiProviderCard: React.FC<AiProviderCardProps> = ({
  provider,
  isActive,
  testResult,
  isTesting,
  onTest,
  onEdit,
  onDuplicate,
  onDelete,
  onSetActive
}) => {
  const typeMeta = AI_PROVIDER_TYPE_META[provider.type as keyof typeof AI_PROVIDER_TYPE_META] || {
    label: provider.type,
    shortLabel: provider.type,
    icon: 'psychology'
  };
  const endpoint =
    provider.type === 'OPENAI' || provider.type === 'GLM' || provider.type === 'CLAUDE'
      ? normalizeApiEndpoint(provider.apiEndpoint, provider.type) === 'passthrough'
        ? provider.apiUrl || '透传（使用接口地址）'
        : getEndpointPath(normalizeApiEndpoint(provider.apiEndpoint, provider.type))
      : null;
  const testStyles = getTestStatusStyles(isTesting, testResult);
  const testLabel = getTestStatusLabel(isTesting, testResult);
  const modelId = getPrimaryModel(provider);
  const displayName = provider.name?.trim() || modelId;
  const multimodalEnabled = isProviderMultimodalEnabled(provider);

  return (
    <div
      className={`group relative flex flex-col rounded-2xl border bg-canvas dark:bg-surface-dark p-5 transition-all duration-200 card-interactive-subtle ${
        isActive
          ? 'border-ink/25 dark:border-white/20 ring-1 ring-ink/10 dark:ring-white/10 shadow-subtle'
          : 'border-hairline-soft dark:border-white/5 hover:border-hairline-strong dark:hover:border-white/10'
      }`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-text-ink dark:text-white">
            {displayName}
          </h3>
          <p className="mt-0.5 truncate font-mono text-xs text-text-slate dark:text-text-secondary">
            {modelId}
          </p>
          {endpoint ? (
            <p className="mt-1 font-mono text-[11px] text-text-stone dark:text-text-secondary">
              {endpoint}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {multimodalEnabled ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
              <span className="material-symbols-outlined text-[12px]">image</span>
              多模态
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1 rounded-full border border-hairline-soft bg-surface-soft px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-slate dark:border-white/10 dark:bg-white/5 dark:text-text-secondary">
            <span className="material-symbols-outlined text-[14px]">{typeMeta.icon}</span>
            {typeMeta.shortLabel}
          </span>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-hairline-soft bg-surface-soft/70 px-3 py-2.5 dark:border-white/5 dark:bg-white/[0.03]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-stone">
            Host
          </p>
          <p className="mt-1 truncate font-mono text-xs text-text-charcoal dark:text-white">
            {extractHost(provider.apiUrl)}
          </p>
        </div>
        <div className="rounded-xl border border-hairline-soft bg-surface-soft/70 px-3 py-2.5 dark:border-white/5 dark:bg-white/[0.03]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-stone">
            API Key
          </p>
          <p className="mt-1 truncate font-mono text-xs text-text-charcoal dark:text-white">
            {maskApiKeyDisplay(provider)}
          </p>
        </div>
      </div>

      <div className={`mb-4 rounded-xl border px-3 py-2.5 ${testStyles.box}`}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-stone">
            模型测试
          </p>
          {isActive ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-teal-light/80 px-2 py-0.5 text-[10px] font-semibold text-moss-dark dark:bg-emerald-500/15 dark:text-emerald-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-teal" />
              默认
            </span>
          ) : (
            <button
              type="button"
              onClick={onSetActive}
              className="text-[10px] font-semibold text-text-stone transition-colors hover:text-ink dark:hover:text-white"
            >
              设为默认
            </button>
          )}
        </div>
        <p className={`mt-1 text-xs leading-relaxed ${testStyles.text}`}>{testLabel}</p>
      </div>

      <div className="mt-auto flex items-center justify-end gap-1 border-t border-hairline-soft pt-3 dark:border-white/5">
        <button
          type="button"
          onClick={onTest}
          disabled={isTesting}
          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-text-slate transition-colors hover:bg-surface-soft hover:text-ink disabled:opacity-50 dark:hover:bg-white/5 dark:hover:text-white"
        >
          {isTesting ? '测试中...' : '测试'}
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-text-slate transition-colors hover:bg-surface-soft hover:text-ink dark:hover:bg-white/5 dark:hover:text-white"
        >
          编辑
        </button>
        <button
          type="button"
          onClick={onDuplicate}
          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-text-slate transition-colors hover:bg-surface-soft hover:text-ink dark:hover:bg-white/5 dark:hover:text-white"
        >
          复制
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-coral-dark transition-colors hover:bg-coral-light/50 dark:text-red-300 dark:hover:bg-red-500/10"
        >
          删除
        </button>
      </div>
    </div>
  );
};
