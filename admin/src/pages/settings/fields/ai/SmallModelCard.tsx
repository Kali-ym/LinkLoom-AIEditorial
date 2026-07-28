import React from 'react';
import { extractHost } from './aiProviderUtils';
import {
  SMALL_MODEL_ROLE_META,
  getSmallModelDisplayName,
  maskSmallModelApiKey,
  type SmallModelService,
  type SmallModelTestResult
} from './smallModelUtils';
import { getTestStatusLabel, getTestStatusStyles } from './testStatusStyles';

export interface SmallModelCardProps {
  service: SmallModelService;
  isActive?: boolean;
  showActiveSelection?: boolean;
  testResult?: SmallModelTestResult;
  isTesting: boolean;
  onTest: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onSetActive?: () => void;
}

export const SmallModelCard: React.FC<SmallModelCardProps> = ({
  service,
  isActive = false,
  showActiveSelection = false,
  testResult,
  isTesting,
  onTest,
  onEdit,
  onDuplicate,
  onDelete,
  onSetActive
}) => {
  const roleMeta = SMALL_MODEL_ROLE_META[service.role];
  const testStyles = getTestStatusStyles(isTesting, testResult);
  const testLabel = getTestStatusLabel(isTesting, testResult);
  const displayName = getSmallModelDisplayName(service);
  const modelId = service.model || '未指定模型';

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
          <p className="mt-1 font-mono text-[11px] text-text-stone dark:text-text-secondary">
            {service.backend}
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-hairline-soft bg-surface-soft px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-slate dark:border-white/10 dark:bg-white/5 dark:text-text-secondary">
          <span className="material-symbols-outlined text-[14px]">{roleMeta.icon}</span>
          {roleMeta.shortLabel}
        </span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-hairline-soft bg-surface-soft/70 px-3 py-2.5 dark:border-white/5 dark:bg-white/[0.03]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-stone">Host</p>
          <p className="mt-1 truncate font-mono text-xs text-text-charcoal dark:text-white">
            {extractHost(service.apiUrl)}
          </p>
        </div>
        <div className="rounded-xl border border-hairline-soft bg-surface-soft/70 px-3 py-2.5 dark:border-white/5 dark:bg-white/[0.03]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-stone">API Key</p>
          <p className="mt-1 truncate font-mono text-xs text-text-charcoal dark:text-white">
            {maskSmallModelApiKey(service)}
          </p>
        </div>
      </div>

      <div className={`mb-4 rounded-xl border px-3 py-2.5 ${testStyles.box}`}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-stone">模型测试</p>
          {showActiveSelection &&
            (isActive ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-teal-light/80 px-2 py-0.5 text-[10px] font-semibold text-moss-dark dark:bg-emerald-500/15 dark:text-emerald-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-teal" />
                生效中
              </span>
            ) : (
              <button
                type="button"
                onClick={onSetActive}
                className="text-[10px] font-semibold text-text-stone transition-colors hover:text-ink dark:hover:text-white"
              >
                设为生效
              </button>
            ))}
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
