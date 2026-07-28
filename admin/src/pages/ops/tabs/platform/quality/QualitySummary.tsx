import React from 'react';
import type { SourceQualityStatus } from '../../../../../services/agentService';
import { opsInputClass } from '../../../opsUiPrimitives';
import { StatCard } from '../shared/governanceUi';

type Props = {
  status: SourceQualityStatus;
  minAiScore: number;
  onMinAiScoreChange: (value: number) => void;
  onSaveMinScore: () => void;
  saving: boolean;
};

export const QualitySummary: React.FC<Props> = ({
  status,
  minAiScore,
  onMinAiScoreChange,
  onSaveMinScore,
  saving
}) => {
  const blacklistCount = status.sourceBlacklist.length;
  const whitelistCount = status.sourceWhitelist.length;
  const minScoreLabel = `${status.minAiScore}${status.demoteLowTier ? ' · 降权开' : ''}`;

  return (
    <section className="rounded-2xl border border-hairline-soft bg-canvas p-4 dark:border-white/5 dark:bg-surface-dark">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-text-ink dark:text-white">来源质量管理</h4>
          <p className="mt-1 text-xs text-text-slate dark:text-text-secondary">
            store-query 步骤自动应用黑白名单与最低 AI 分过滤
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            status.enabled
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {status.enabled ? '已启用' : '未启用'}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <StatCard label="黑名单" value={`${blacklistCount} 条`} />
        <StatCard
          label="白名单"
          value={whitelistCount > 0 ? `${whitelistCount} 条` : '未限制'}
        />
        <StatCard label="最低分" value={minScoreLabel} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-xs text-text-slate dark:text-text-secondary">
          最低 AI 分
          <input
            type="number"
            min={0}
            max={100}
            value={minAiScore}
            onChange={(e) => onMinAiScoreChange(Number(e.target.value) || 0)}
            className={`w-20 ${opsInputClass}`}
          />
        </label>
        <button
          type="button"
          disabled={saving}
          onClick={onSaveMinScore}
          className="btn-pill-primary !text-xs disabled:opacity-50"
        >
          保存
        </button>
      </div>
    </section>
  );
};
