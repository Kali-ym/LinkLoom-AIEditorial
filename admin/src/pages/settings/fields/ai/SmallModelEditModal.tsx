import React from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { getApiKeyInputValue, SAVED_API_KEY_DISPLAY } from '../../../../utils/secretField';
import { DialogFooter } from '../../../../components/UI/DialogFooter';
import {
  SMALL_MODEL_BACKENDS,
  SMALL_MODEL_ROLE_META,
  type SmallModelRole,
  type SmallModelService,
  type SmallModelTestResult
} from './smallModelUtils';
import { getTestStatusLabel, getTestStatusStyles } from './testStatusStyles';

export interface SmallModelEditModalProps {
  open: boolean;
  service: SmallModelService | null;
  isDraft?: boolean;
  showApiKey: boolean;
  isTesting: boolean;
  testResult?: SmallModelTestResult;
  onClose: () => void;
  onSave: () => void;
  onChange: (field: string, value: unknown) => void;
  onToggleApiKey: () => void;
  onTest: () => void;
}

const FieldShell: React.FC<{
  label: string;
  icon: string;
  hint?: string;
  children: React.ReactNode;
}> = ({ label, icon, hint, children }) => (
  <div className="space-y-1.5">
    <label className="ml-0.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-text-steel">
      <span className="material-symbols-outlined text-[13px]">{icon}</span>
      {label}
    </label>
    {children}
    {hint ? <p className="ml-0.5 text-[10px] text-text-stone">{hint}</p> : null}
  </div>
);

const inputClass =
  'w-full px-4 py-2.5 bg-surface-soft dark:bg-white/[0.03] border border-hairline-strong dark:border-white/10 rounded-xl text-xs text-text-charcoal dark:text-white focus:border-ink dark:focus:border-white outline-none transition-all font-mono';

export const SmallModelEditModal: React.FC<SmallModelEditModalProps> = ({
  open,
  service,
  isDraft = false,
  showApiKey,
  isTesting,
  testResult,
  onClose,
  onSave,
  onChange,
  onToggleApiKey,
  onTest
}) => {
  if (!open || !service) return null;

  const roleMeta = SMALL_MODEL_ROLE_META[service.role];
  const testStyles = getTestStatusStyles(isTesting, testResult);
  const testLabel = getTestStatusLabel(isTesting, testResult);

  const setRole = (role: SmallModelRole) => {
    onChange('role', role);
    if (role === 'EMBEDDING' && !service.dimensions) {
      onChange('dimensions', 1024);
    }
    if (role === 'RERANK') {
      onChange('dimensions', undefined);
    }
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
              {isDraft ? '新建小模型服务' : '编辑小模型服务'} · {roleMeta.label}
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
            {(Object.keys(SMALL_MODEL_ROLE_META) as SmallModelRole[]).map((role) => {
              const meta = SMALL_MODEL_ROLE_META[role];
              const active = service.role === role;
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => setRole(role)}
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

          <p className="text-xs text-text-stone">{roleMeta.hint}</p>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FieldShell label="外显名称" icon="badge" hint="用于设置页展示，不影响 API 调用">
              <input
                type="text"
                value={service.name || ''}
                placeholder={service.role === 'EMBEDDING' ? '例如 Ollama Embedding (bge-m3)' : '例如 Jina Rerank v2'}
                onChange={(e) => onChange('name', e.target.value)}
                className={inputClass.replace('font-mono', '')}
              />
            </FieldShell>

            <FieldShell label="后端" icon="dns">
              <div className="relative">
                <select
                  value={service.backend}
                  onChange={(e) => onChange('backend', e.target.value)}
                  className={`${inputClass} cursor-pointer appearance-none pr-10`}
                >
                  {SMALL_MODEL_BACKENDS.map((backend) => (
                    <option key={backend} value={backend}>
                      {backend}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-lg text-text-stone">
                  expand_more
                </span>
              </div>
            </FieldShell>

            <FieldShell label="模型标识" icon="tag" hint="Embedding / Rerank 模型 ID">
              <input
                type="text"
                value={service.model || ''}
                placeholder={service.role === 'EMBEDDING' ? '例如 bge-m3' : '例如 jina-reranker-v2-base-multilingual'}
                onChange={(e) => onChange('model', e.target.value)}
                className={inputClass}
              />
            </FieldShell>

            {service.role === 'EMBEDDING' ? (
              <FieldShell label="向量维度" icon="straighten" hint="会传给 Embedding API；变更后需重新索引">
                <input
                  type="number"
                  value={service.dimensions ?? ''}
                  placeholder="1024"
                  onChange={(e) =>
                    onChange('dimensions', e.target.value ? Number(e.target.value) : undefined)
                  }
                  className={inputClass}
                />
              </FieldShell>
            ) : (
              <div />
            )}

            <div className="md:col-span-2">
              <FieldShell label="接口地址" icon="link">
                <input
                  type="text"
                  value={service.apiUrl || ''}
                  placeholder="https://maas-api.cn-huabei-1.xf-yun.com/v2/embeddings"
                  onChange={(e) => onChange('apiUrl', e.target.value)}
                  className={inputClass}
                />
              </FieldShell>
            </div>

            <FieldShell label="访问密钥" icon="key" hint="Ollama 等本地服务可留空">
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={getApiKeyInputValue(service)}
                  placeholder={service.apiKeyConfigured ? undefined : '可留空'}
                  onFocus={(e) => {
                    if (
                      service.apiKeyConfigured &&
                      !service.apiKey &&
                      getApiKeyInputValue(service) === SAVED_API_KEY_DISPLAY
                    ) {
                      e.target.select();
                    }
                  }}
                  onChange={(e) => {
                    let next = e.target.value;
                    if (
                      service.apiKeyConfigured &&
                      !service.apiKey &&
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

            <FieldShell label="网络" icon="public">
              <label className="flex h-[42px] cursor-pointer items-center gap-2 rounded-xl border border-hairline-strong bg-surface-soft px-4 dark:border-white/10 dark:bg-white/[0.03]">
                <input
                  type="checkbox"
                  checked={service.useProxy ?? false}
                  onChange={(e) => onChange('useProxy', e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-hairline-strong text-ink focus:ring-ink/20"
                />
                <span className="text-xs text-text-charcoal dark:text-white">使用全局代理</span>
              </label>
            </FieldShell>

            <FieldShell label="启用" icon="toggle_on">
              <label className="flex h-[42px] cursor-pointer items-center gap-2 rounded-xl border border-hairline-strong bg-surface-soft px-4 dark:border-white/10 dark:bg-white/[0.03]">
                <input
                  type="checkbox"
                  checked={service.enabled}
                  onChange={(e) => onChange('enabled', e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-hairline-strong text-ink focus:ring-ink/20"
                />
                <span className="text-xs text-text-charcoal dark:text-white">启用此服务</span>
              </label>
            </FieldShell>
          </div>

          <div className={`rounded-2xl border px-4 py-3 ${testStyles.box}`}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-stone">连通性测试</p>
            <p className={`mt-1 text-sm font-medium ${testStyles.text}`}>{testLabel}</p>
            <p className="mt-1 font-mono text-[11px] text-text-stone">{service.role} · {service.backend}</p>
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
