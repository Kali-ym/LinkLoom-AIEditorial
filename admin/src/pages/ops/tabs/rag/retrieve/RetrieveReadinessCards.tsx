import React from 'react';
import {
  formatPercent,
  labelFallbackReason,
  labelReadiness,
  labelRuntimeMode,
  labelVectorStorageMode,
  percentFromThreshold
} from '../shared/ragStatusLabels.js';
import { opsSelectClass, StatusChip } from '../shared/ragUi.js';
import type { RagPipelineTab } from '../shared/types.js';

type Props = {
  status: any;
  ragConfig: Record<string, unknown>;
  hasActiveEmbedding: boolean;
  synthesisConfigured: boolean;
  agents: Array<{ id: string; name: string }>;
  synthesisAgentId: string;
  onPatch: (patch: Record<string, unknown>) => void;
  onNavigate: (tab: RagPipelineTab) => void;
};

export const RetrieveReadinessCards: React.FC<Props> = ({
  status,
  ragConfig,
  hasActiveEmbedding,
  synthesisConfigured,
  agents,
  synthesisAgentId,
  onPatch,
  onNavigate
}) => {
  const hybridEnabled = ragConfig.hybridEnabled === true;
  const coverage = status?.coverage;
  const threshold = percentFromThreshold(ragConfig.minVectorCoverageForHybrid);
  const hybridReady = status?.readiness === 'hybrid_ready';
  const hybridIssue =
    !hasActiveEmbedding ||
    status?.readiness === 'rebuild_required' ||
    status?.fallbackReason ||
    status?.readiness === 'degraded';

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div
        className={`rounded-2xl border p-4 ${
          hybridIssue
            ? 'border-amber-200 bg-amber-50/60 dark:border-amber-400/30 dark:bg-amber-400/5'
            : 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-400/30 dark:bg-emerald-400/5'
        }`}
      >
        <p className="text-sm font-semibold text-text-ink dark:text-white">混合检索</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <StatusChip label={labelReadiness(status?.readiness)} tone={hybridReady ? 'green' : 'amber'} />
          <StatusChip label={labelRuntimeMode(status?.runtimeMode)} tone="slate" />
          <StatusChip label={labelVectorStorageMode(status?.vectorStorageMode)} tone="slate" />
        </div>
        <p className="mt-2 text-[12px] text-text-charcoal dark:text-text-secondary">
          {hybridEnabled
            ? hasActiveEmbedding
              ? `覆盖率 ${formatPercent(coverage?.indexCoveragePercent)}（门槛 ${threshold}）`
              : '向量模型未配置'
            : '当前为全文检索模式'}
        </p>
        {status?.fallbackReason && (
          <p className="mt-1 text-[12px] text-amber-700 dark:text-amber-200">
            {labelFallbackReason(status.fallbackReason)}
          </p>
        )}
        {hybridIssue && (
          <button
            type="button"
            onClick={() => onNavigate('ingest')}
            className="btn-pill-secondary !text-xs !py-1 !px-2 mt-2"
          >
            前往入库修复 →
          </button>
        )}
      </div>

      <div
        className={`rounded-2xl border p-4 ${
          synthesisConfigured
            ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-400/30 dark:bg-emerald-400/5'
            : 'border-amber-200 bg-amber-50/60 dark:border-amber-400/30 dark:bg-amber-400/5'
        }`}
      >
        <p className="text-sm font-semibold text-text-ink dark:text-white">答案合成</p>
        <p className="mt-2 text-[12px] text-text-charcoal dark:text-text-secondary">
          {synthesisConfigured
            ? '已配置答案合成智能体'
            : '未配置时仅返回检索片段'}
        </p>
        {!synthesisConfigured && (
          <label className="mt-3 block space-y-1 text-sm">
            <span className="text-text-charcoal dark:text-text-secondary">选择智能体</span>
            <select
              className={`w-full ${opsSelectClass}`}
              value={synthesisAgentId}
              onChange={(e) => onPatch({ synthesisAgentId: e.target.value })}
            >
              <option value="">未选择</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </div>
  );
};
