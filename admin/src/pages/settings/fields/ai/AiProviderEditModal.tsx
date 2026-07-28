import React from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { getApiKeyInputValue, SAVED_API_KEY_DISPLAY } from '../../../../utils/secretField';
import { DialogFooter } from '../../../../components/UI/DialogFooter';
import { ComboField } from './ComboField';
import {
  AI_PROVIDER_TYPE_META,
  API_ENDPOINT_OPTIONS,
  getEndpointPath,
  isProviderMultimodalEnabled,
  normalizeApiEndpoint,
  REASONING_EFFORT_OPTIONS,
  type AIProviderType,
  type ProviderTestResult
} from './aiProviderUtils';
import { getTestStatusLabel, getTestStatusStyles } from './testStatusStyles';

export interface AiProviderEditModalProps {
  open: boolean;
  provider: any | null;
  isDraft?: boolean;
  showApiKey: boolean;
  syncedModels: string[];
  isFetchingModels: boolean;
  isTesting: boolean;
  testResult?: ProviderTestResult;
  onClose: () => void;
  onSave: () => void;
  onChange: (field: string, value: any) => void;
  onToggleApiKey: () => void;
  onFetchModels: () => void;
  onTest: () => void;
}

const FieldShell: React.FC<{
  label: string;
  icon: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}> = ({ label, icon, hint, action, children }) => (
  <div className="space-y-1.5">
    <div className="ml-0.5 flex items-center justify-between gap-2">
      <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-text-steel">
        <span className="material-symbols-outlined text-[13px]">{icon}</span>
        {label}
      </label>
      {action}
    </div>
    {children}
    {hint ? <p className="ml-0.5 text-[10px] text-text-stone">{hint}</p> : null}
  </div>
);

const inputClass =
  'w-full px-4 py-2.5 bg-surface-soft dark:bg-white/[0.03] border border-hairline-strong dark:border-white/10 rounded-xl text-xs text-text-charcoal dark:text-white focus:border-ink dark:focus:border-white outline-none transition-all font-mono';

export const AiProviderEditModal: React.FC<AiProviderEditModalProps> = ({
  open,
  provider,
  isDraft = false,
  showApiKey,
  syncedModels,
  isFetchingModels,
  isTesting,
  testResult,
  onClose,
  onSave,
  onChange,
  onToggleApiKey,
  onFetchModels,
  onTest
}) => {
  if (!open || !provider) return null;

  const typeMeta = AI_PROVIDER_TYPE_META[provider.type as AIProviderType];
  const isOpenAICompatible =
    provider.type === 'OPENAI' || provider.type === 'GLM' || provider.type === 'SMALL';
  const isEndpointConfigurable = isOpenAICompatible || provider.type === 'CLAUDE';
  const modelId = provider.models?.[0] || '';
  const normalizedEndpoint = normalizeApiEndpoint(provider.apiEndpoint, provider.type);
  const endpointPath = getEndpointPath(normalizedEndpoint);
  const endpointOptions = API_ENDPOINT_OPTIONS.map((o) => o.label);
  const testStyles = getTestStatusStyles(isTesting, testResult);
  const testLabel = getTestStatusLabel(isTesting, testResult);

  const setModelId = (val: string) => {
    onChange('models', val ? [val] : []);
  };

  const multimodalEnabled = isProviderMultimodalEnabled(provider);

  const setEndpointByPath = (path: string) => {
    const opt = API_ENDPOINT_OPTIONS.find((o) => o.label === path);
    onChange('apiEndpoint', opt?.value || 'chat_completions');
  };

  const modal = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-ink/60 p-2 backdrop-blur-sm sm:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="my-auto flex max-h-[min(92vh,calc(100dvh-2rem))] w-full max-w-3xl min-h-0 flex-col overflow-hidden rounded-2xl bg-canvas shadow-modal dark:bg-surface-dark"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-hairline-soft p-5 dark:border-white/5">
          <div>
            <h3 className="text-lg font-semibold text-text-ink dark:text-white">模型编辑</h3>
            <p className="mt-0.5 text-xs text-text-slate">
              {isDraft ? '新建模型配置' : '编辑模型配置'} · {typeMeta?.label}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-text-stone transition-colors hover:text-text-charcoal dark:hover:text-white"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-5">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(AI_PROVIDER_TYPE_META) as AIProviderType[])
              .filter((type) => type !== 'SMALL')
              .map((type) => {
              const meta = AI_PROVIDER_TYPE_META[type];
              const active = provider.type === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => onChange('type', type)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                    active
                      ? 'border-ink/30 bg-surface-lavender text-ink-deep dark:border-white/20 dark:bg-white/10 dark:text-white'
                      : 'border-hairline-soft bg-surface-soft text-text-slate hover:border-hairline-strong dark:border-white/10 dark:hover:border-white/20'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">{meta.icon}</span>
                  {meta.shortLabel}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FieldShell
              label="外显名称"
              icon="badge"
              hint="用于智能体等场景展示，不影响 API 调用"
            >
              <input
                type="text"
                value={provider.name || ''}
                placeholder="例如 GPT 5.5"
                onChange={(e) => onChange('name', e.target.value)}
                className={inputClass.replace('font-mono', '')}
              />
            </FieldShell>

            <FieldShell
              label="模型标识"
              icon="tag"
              hint={
                syncedModels.length > 0
                  ? `已同步 ${syncedModels.length} 个模型：可手动输入任意模型 ID，或点右侧箭头从列表选择`
                  : '可手动输入模型 ID；点「同步模型」后也可从下拉列表选择'
              }
              action={
                <button
                  type="button"
                  onClick={onFetchModels}
                  disabled={isFetchingModels}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-ink transition-all hover:bg-surface disabled:opacity-50 dark:text-white"
                >
                  <span
                    className={`material-symbols-outlined text-sm ${isFetchingModels ? 'animate-spin' : ''}`}
                  >
                    sync
                  </span>
                  同步模型
                </button>
              }
            >
              <ComboField
                value={modelId}
                onChange={setModelId}
                options={syncedModels}
                placeholder="例如 gpt-5.5"
                mono
                autoOpenWhenOptionsIncrease
              />
            </FieldShell>

            <FieldShell label="访问密钥" icon="key">
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={getApiKeyInputValue(provider)}
                  placeholder={provider.apiKeyConfigured ? undefined : '请输入 API 密钥'}
                  onFocus={(e) => {
                    if (
                      provider.apiKeyConfigured &&
                      !provider.apiKey &&
                      getApiKeyInputValue(provider) === SAVED_API_KEY_DISPLAY
                    ) {
                      e.target.select();
                    }
                  }}
                  onChange={(e) => {
                    let next = e.target.value;
                    if (
                      provider.apiKeyConfigured &&
                      !provider.apiKey &&
                      next !== SAVED_API_KEY_DISPLAY
                    ) {
                      if (next.startsWith(SAVED_API_KEY_DISPLAY)) {
                        next = next.slice(SAVED_API_KEY_DISPLAY.length);
                      }
                      onChange('apiKeyConfigured', false);
                    }
                    onChange('apiKey', next);
                  }}
                  className={`${inputClass} pr-12`}
                />
                <button
                  type="button"
                  onClick={onToggleApiKey}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-stone hover:text-ink"
                >
                  <span className="material-symbols-outlined text-lg">
                    {showApiKey ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </FieldShell>

            <FieldShell label="接口地址" icon="link">
              <input
                type="text"
                value={provider.apiUrl || ''}
                placeholder={
                  provider.type === 'GLM'
                    ? 'https://open.bigmodel.cn/api/paas/v4'
                    : provider.type === 'OPENAI'
                      ? 'https://api.openai.com'
                      : undefined
                }
                onChange={(e) => onChange('apiUrl', e.target.value)}
                className={inputClass}
              />
            </FieldShell>

            <FieldShell
              label="多模态"
              icon="image"
              hint="开启后 Agent Console 发送图片将走 Vision；需模型本身支持识图"
            >
              <label className="flex h-[42px] cursor-pointer items-center gap-2 rounded-xl border border-hairline-strong bg-surface-soft px-4 dark:border-white/10 dark:bg-white/[0.03]">
                <input
                  type="checkbox"
                  checked={multimodalEnabled}
                  disabled={!modelId}
                  onChange={(e) => onChange('multimodalEnabled', e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-hairline-strong text-ink focus:ring-ink/20 disabled:opacity-50"
                />
                <span className="text-xs text-text-charcoal dark:text-white">启用多模态（Vision）</span>
              </label>
            </FieldShell>

            {isOpenAICompatible ? (
              <FieldShell label="网络" icon="public">
                <label className="flex h-[42px] cursor-pointer items-center gap-2 rounded-xl border border-hairline-strong bg-surface-soft px-4 dark:border-white/10 dark:bg-white/[0.03]">
                  <input
                    type="checkbox"
                    checked={provider.useProxy ?? false}
                    onChange={(e) => onChange('useProxy', e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-hairline-strong text-ink focus:ring-ink/20"
                  />
                  <span className="text-xs text-text-charcoal dark:text-white">使用全局代理</span>
                </label>
              </FieldShell>
            ) : (
              <div />
            )}

            <FieldShell label="推理强度" icon="psychology">
              <div className="relative">
                <select
                  value={provider.reasoningEffort || 'none'}
                  onChange={(e) => onChange('reasoningEffort', e.target.value)}
                  className={`${inputClass} cursor-pointer appearance-none pr-10`}
                >
                  {REASONING_EFFORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-lg text-text-stone">
                  expand_more
                </span>
              </div>
            </FieldShell>

            {isEndpointConfigurable ? (
              <FieldShell label="接口端点" icon="route">
                <ComboField
                  value={endpointPath}
                  onChange={setEndpointByPath}
                  options={endpointOptions}
                  readOnly
                  mono
                />
              </FieldShell>
            ) : (
              <div />
            )}
          </div>

          <div className={`rounded-2xl border px-4 py-3 ${testStyles.box}`}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-stone">
              模型测试
            </p>
            <p className={`mt-1 text-sm font-medium ${testStyles.text}`}>{testLabel}</p>
            {isEndpointConfigurable ? (
              <p className="mt-1 font-mono text-[11px] text-text-stone">
                {normalizedEndpoint === 'passthrough'
                  ? provider.apiUrl || '（未填写接口地址）'
                  : getEndpointPath(normalizedEndpoint)}
              </p>
            ) : null}
          </div>
        </div>

        <DialogFooter className="shrink-0">
          <div className="flex w-full flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-full border border-hairline-strong px-4 py-2.5 text-[13px] font-medium text-text-charcoal transition-colors hover:border-ink hover:text-ink dark:border-white/10 dark:text-text-secondary dark:hover:border-white dark:hover:text-white"
            >
              取消
            </button>
            <button
              type="button"
              onClick={onTest}
              disabled={isTesting}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-full border border-hairline-strong bg-surface-soft px-4 py-2.5 text-[13px] font-medium text-text-charcoal transition-colors hover:border-ink hover:text-ink disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white"
            >
              {isTesting ? '测试中...' : '测试'}
            </button>
            <button
              type="button"
              onClick={onSave}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-full bg-ink px-5 py-2.5 text-[13px] font-semibold text-white shadow shadow-primary/20 transition-all hover:bg-charcoal dark:bg-white dark:text-ink dark:hover:bg-slate-100"
            >
              保存
            </button>
          </div>
        </DialogFooter>
      </motion.div>
    </div>
  );

  return createPortal(modal, document.body);
};
