import React, { useState } from 'react';
import type { GovernanceStatus, PermissionMatrixEntry } from '../../../../../services/agentService';
import { OpsTableHead } from '../../../opsUiPrimitives';
import { EFFECT_LABELS, EFFECT_STYLES, StatCard } from '../shared/governanceUi';

type Props = {
  status: GovernanceStatus;
};

export const GovernanceMatrixPanel: React.FC<Props> = ({ status }) => {
  const [filter, setFilter] = useState<'all' | 'ask' | 'deny' | 'allow'>('all');
  const matrix = (status.matrix ?? []).filter((item) => filter === 'all' || item.effect === filter);

  return (
    <details className="group rounded-2xl border border-hairline-soft bg-surface-soft/50 dark:border-white/5 dark:bg-white/[0.02]">
      <summary className="cursor-pointer list-none px-4 py-3 text-[13px] font-medium text-text-charcoal dark:text-text-secondary [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px] transition-transform group-open:rotate-90">
            chevron_right
          </span>
          权限矩阵（允许 {status.allowCount} · 拒绝 {status.denyCount}）
        </span>
      </summary>
      <div className="space-y-4 border-t border-hairline-soft px-4 py-3 dark:border-white/5">
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="允许" value={status.allowCount} accent="text-emerald-600" />
          <StatCard label="拒绝" value={status.denyCount} accent="text-red-600" />
        </div>

        <div className="flex gap-2">
          {(['all', 'ask', 'allow', 'deny'] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setFilter(item)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                filter === item
                  ? 'bg-ink text-white dark:bg-white dark:text-ink'
                  : 'bg-surface-soft text-text-slate dark:bg-white/[0.04] dark:text-text-secondary'
              }`}
            >
              {item === 'all' ? '全部' : EFFECT_LABELS[item]}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto rounded-xl border border-hairline dark:border-border-dark">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline-soft bg-surface-soft/50 text-left dark:border-white/5 dark:bg-surface-dark">
                <OpsTableHead>工具</OpsTableHead>
                <OpsTableHead>动作类型</OpsTableHead>
                <OpsTableHead>风险</OpsTableHead>
                <OpsTableHead>策略</OpsTableHead>
                <OpsTableHead>说明</OpsTableHead>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline dark:divide-border-dark">
              {matrix.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-text-slate dark:text-text-secondary">
                    暂无数据
                  </td>
                </tr>
              )}
              {matrix.map((item) => (
                <MatrixRow key={item.toolId} item={item} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  );
};

function MatrixRow({ item }: { item: PermissionMatrixEntry }) {
  const style = EFFECT_STYLES[item.effect] || EFFECT_STYLES.allow;
  return (
    <tr className="hover:bg-surface-soft/40 dark:hover:bg-white/[0.03]">
      <td className="px-4 py-3">
        <div className="font-medium text-text-ink dark:text-white">{item.toolName}</div>
        <div className="font-mono text-xs text-text-slate dark:text-text-secondary">{item.toolId}</div>
      </td>
      <td className="px-4 py-3 text-xs">{item.actionKind}</td>
      <td className="px-4 py-3 text-xs">{item.riskLevel}</td>
      <td className="px-4 py-3">
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>
          {EFFECT_LABELS[item.effect] || item.effect}
        </span>
      </td>
      <td className="px-4 py-3 max-w-xs truncate text-xs text-text-slate dark:text-text-secondary" title={item.reason}>
        {item.reason || '-'}
      </td>
    </tr>
  );
}
