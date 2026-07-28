import React from 'react';
import type { SourceQualityStatus } from '../../../../../services/agentService';
import { opsInputClass } from '../../../opsUiPrimitives';

type Props = {
  status: SourceQualityStatus;
  blacklist: string;
  whitelist: string;
  demoteLowTier: boolean;
  saving: boolean;
  onBlacklistChange: (value: string) => void;
  onWhitelistChange: (value: string) => void;
  onDemoteLowTierChange: (value: boolean) => void;
  onSave: () => void;
};

export const QualityRulesPanel: React.FC<Props> = ({
  status,
  blacklist,
  whitelist,
  demoteLowTier,
  saving,
  onBlacklistChange,
  onWhitelistChange,
  onDemoteLowTierChange,
  onSave
}) => {
  return (
    <details className="group rounded-2xl border border-hairline-soft bg-surface-soft/50 dark:border-white/5 dark:bg-white/[0.02]">
      <summary className="cursor-pointer list-none px-4 py-3 text-[13px] font-medium text-text-charcoal dark:text-text-secondary [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px] transition-transform group-open:rotate-90">
            chevron_right
          </span>
          高级规则配置
        </span>
      </summary>
      <div className="space-y-4 border-t border-hairline-soft px-4 py-3 dark:border-white/5">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs text-text-slate dark:text-text-secondary">
            黑名单（每行一个来源/域名）
            <textarea
              value={blacklist}
              onChange={(e) => onBlacklistChange(e.target.value)}
              rows={3}
              className={`mt-1 w-full ${opsInputClass}`}
            />
          </label>
          <label className="text-xs text-text-slate dark:text-text-secondary">
            白名单（非空时仅允许列表内来源）
            <textarea
              value={whitelist}
              onChange={(e) => onWhitelistChange(e.target.value)}
              rows={3}
              className={`mt-1 w-full ${opsInputClass}`}
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-1.5 text-xs text-text-slate dark:text-text-secondary">
            <input
              type="checkbox"
              checked={demoteLowTier}
              onChange={(e) => onDemoteLowTierChange(e.target.checked)}
            />
            低质源降权（aggregator + 分数&lt;60 过滤）
          </label>
          <button
            type="button"
            disabled={saving}
            onClick={onSave}
            className="btn-pill-primary !text-xs disabled:opacity-50"
          >
            保存
          </button>
        </div>

        {status.blockedTiers.length > 0 && (
          <p className="text-xs text-text-slate dark:text-text-secondary">
            已屏蔽层级：{status.blockedTiers.join('、')}
          </p>
        )}

        {status.updatedAt && (
          <p className="text-xs text-text-slate dark:text-text-secondary">
            最后更新：{new Date(status.updatedAt).toLocaleString('zh-CN')}
          </p>
        )}
      </div>
    </details>
  );
};
