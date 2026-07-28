import React from 'react';
import { motion } from 'framer-motion';
import { useToast } from '../../../context/ToastContext.js';
import { adminBrand } from '../../../config/adminBrand';
import { getAdminUiLang } from '../../../utils/adminUiLocale';
import type { SettingsFieldContext } from '../settingsFieldTypes';

type Props = Pick<
  SettingsFieldContext,
  | 'apiKeys'
  | 'setApiKeys'
  | 'newlyCreatedKey'
  | 'setNewlyCreatedKey'
  | 'handleCreateApiKey'
  | 'handleDeleteApiKey'
  | 'handleUpdateApiKey'
>;

export const InteropKeysField: React.FC<Props> = ({
  apiKeys,
  setApiKeys,
  newlyCreatedKey,
  setNewlyCreatedKey,
  handleCreateApiKey,
  handleDeleteApiKey,
  handleUpdateApiKey
}) => {
  const { success: toastSuccess } = useToast();
  const adminBrandCopy = adminBrand(getAdminUiLang());

  return (
    <div className="col-span-full space-y-6">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-text-steel dark:text-text-secondary uppercase tracking-[0.08em]">
          已授权的 API Key
        </h4>
        <button
          onClick={handleCreateApiKey}
          className="flex items-center gap-2 px-5 py-2 bg-ink text-white dark:bg-white dark:text-ink rounded-full hover:bg-charcoal dark:hover:bg-slate-100 transition-all text-xs font-medium"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          手动新增 Key
        </button>
      </div>

      {newlyCreatedKey && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-6 bg-amber-50 dark:bg-amber-500/10 border-2 border-dashed border-amber-200 dark:border-amber-500/30 rounded-3xl space-y-4"
        >
          <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
            <span className="material-symbols-outlined font-bold">warning</span>
            <h5 className="font-bold">请立即保存您的 API Key</h5>
          </div>
          <p className="text-xs text-amber-600/80 dark:text-amber-400/80">
            出于安全考虑，该 Key 仅显示一次。如果您丢失了它，将无法找回，只能重新生成。
          </p>
          <div className="flex items-center gap-3 bg-canvas dark:bg-black/20 p-4 rounded-2xl border border-brand-yellow/60 dark:border-amber-500/20">
            <code className="flex-1 font-mono text-sm break-all select-all">
              {newlyCreatedKey.key}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(newlyCreatedKey.key);
                toastSuccess('已复制到剪贴板');
              }}
              className="p-2 hover:bg-surface dark:hover:bg-white/10 rounded-full transition-colors text-ink"
              title="复制到剪贴板"
            >
              <span className="material-symbols-outlined text-xl">content_copy</span>
            </button>
          </div>
          <button
            onClick={() => setNewlyCreatedKey(null)}
            className="w-full py-2 bg-brand-yellow text-ink rounded-full text-xs font-medium hover:bg-brand-yellow-deep transition-colors"
          >
            我已保存，关闭提示
          </button>
        </motion.div>
      )}

      {apiKeys.length === 0 ? (
        <div className="text-center py-12 bg-surface-soft dark:bg-white/[0.02] rounded-3xl border-2 border-dashed border-hairline dark:border-white/10">
          <span className="material-symbols-outlined text-4xl text-text-stone mb-2">key_off</span>
          <p className="text-text-stone text-sm">暂无已授权的互联 API Key</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {apiKeys.map((keyRecord: any) => (
            <div
              key={keyRecord.id}
              className={`p-5 bg-canvas dark:bg-surface-dark border rounded-3xl card-interactive-subtle flex items-center justify-between gap-4 transition-all ${keyRecord.status === 'active' ? 'border-hairline-soft dark:border-white/5' : 'border-hairline-soft dark:border-white/5 opacity-60 grayscale-[0.5]'}`}
            >
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${keyRecord.status === 'active' ? 'bg-teal-light text-moss-dark' : 'bg-surface text-text-slate'}`}
                >
                  <span className="material-symbols-outlined">
                    {keyRecord.status === 'active' ? 'vpn_key' : 'key_off'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      type="text"
                      value={keyRecord.name}
                      onChange={(e) => {
                        const newName = e.target.value;
                        setApiKeys((prev) =>
                          prev.map((k) => (k.id === keyRecord.id ? { ...k, name: newName } : k))
                        );
                      }}
                      onBlur={(e) => handleUpdateApiKey(keyRecord.id, { name: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleUpdateApiKey(keyRecord.id, {
                            name: (e.target as HTMLInputElement).value
                          });
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      className="font-medium text-text-ink dark:text-white bg-transparent border-none p-0 focus:ring-0 text-sm truncate w-full max-w-[240px] hover:bg-surface dark:hover:bg-white/5 rounded px-1 -ml-1 transition-colors cursor-text"
                      title="点击重命名"
                    />
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="text-[10px] text-text-slate dark:text-text-secondary font-mono">
                      Prefix:{' '}
                      <span className="bg-surface dark:bg-white/5 px-1.5 py-0.5 rounded text-text-charcoal dark:text-text-secondary">
                        {keyRecord.prefix}
                      </span>
                    </p>
                    <div className="flex items-center gap-1.5">
                      {keyRecord.status === 'active' ? (
                        <span className="px-1.5 py-0.5 bg-green-500/10 text-green-500 text-[9px] font-bold rounded uppercase">
                          已启用
                        </span>
                      ) : keyRecord.status === 'pending' ? (
                        <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-500 text-[9px] font-bold rounded uppercase">
                          待验证
                        </span>
                      ) : (
                        <span className="chip-neutral text-[9px] py-0.5 uppercase">已禁用</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="hidden sm:block text-right mr-2">
                  <div className="text-[9px] text-text-stone uppercase font-semibold tracking-wider">
                    最后使用
                  </div>
                  <div className="text-[10px] text-text-charcoal dark:text-text-secondary">
                    {keyRecord.lastUsedAt
                      ? new Date(keyRecord.lastUsedAt).toLocaleString('zh-CN', {
                          timeZone: 'Asia/Shanghai'
                        })
                      : '从未使用'}
                  </div>
                </div>
                <button
                  onClick={() =>
                    handleUpdateApiKey(keyRecord.id, {
                      status: keyRecord.status === 'active' ? 'disabled' : 'active'
                    })
                  }
                  className={`w-9 h-9 flex items-center justify-center rounded-full transition-all ${keyRecord.status === 'active' ? 'text-text-stone hover:text-yellow-dark hover:bg-surface-yellow dark:hover:bg-amber-500/10' : 'text-ink hover:bg-surface'}`}
                  title={keyRecord.status === 'active' ? '禁用此 Key' : '启用/激活此 Key'}
                >
                  <span className="material-symbols-outlined">
                    {keyRecord.status === 'active' ? 'pause_circle' : 'play_circle'}
                  </span>
                </button>
                <button
                  onClick={() => handleDeleteApiKey(keyRecord.id)}
                  className="w-9 h-9 flex items-center justify-center text-text-stone hover:text-coral-dark hover:bg-coral-light dark:hover:bg-red-500/10 rounded-full transition-all"
                  title="撤销此 Key (永久删除)"
                >
                  <span className="material-symbols-outlined">delete_forever</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="p-4 bg-surface-lavender rounded-2xl border border-hairline">
        <div className="flex gap-3">
          <span className="material-symbols-outlined text-ink-deep">info</span>
          <p className="text-xs text-ink-deep/80 leading-relaxed">
            {adminBrandCopy.peerDeployHint}
          </p>
        </div>
      </div>
    </div>
  );
};
