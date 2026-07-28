import React from 'react';
import {
  asNumber,
  formatPercent,
  labelFallbackReason,
  labelReadiness,
  labelVectorStorageMode,
  percentFromThreshold
} from './shared/ragStatusLabels.js';
import { StatusChip, type ChipTone } from './shared/ragUi.js';
import type { RagPipelineTab } from './shared/types.js';
import { OpsRefreshButton } from '../../opsUiPrimitives';

type Props = {
  status: any;
  ragConfig: Record<string, unknown>;
  activeTab: RagPipelineTab;
  pendingJobs: number;
  failedJobs: number;
  hasActiveEmbedding: boolean;
  synthesisConfigured: boolean;
  saveState: 'idle' | 'pending' | 'saving' | 'saved';
  loading: boolean;
  onTabChange: (tab: RagPipelineTab) => void;
  onRefresh: () => void;
};

function readinessTone(readiness?: string, hybridEnabled?: boolean, hasEmbedding?: boolean): ChipTone {
  if (readiness === 'hybrid_ready') return 'green';
  if (readiness === 'rebuild_required') return 'red';
  if (readiness === 'indexing') return 'blue';
  if (hybridEnabled && !hasEmbedding) return 'amber';
  return 'slate';
}

type PipelineNode = {
  id: RagPipelineTab | 'synthesis';
  label: string;
  tab?: RagPipelineTab;
};

const NODES: PipelineNode[] = [
  { id: 'ingest', label: '入库', tab: 'ingest' },
  { id: 'retrieve', label: '检索', tab: 'retrieve' },
  { id: 'synthesis', label: '合成', tab: 'retrieve' }
];

export const RagPipelineHeader: React.FC<Props> = ({
  status,
  ragConfig,
  activeTab,
  pendingJobs,
  failedJobs,
  hasActiveEmbedding,
  synthesisConfigured,
  saveState,
  loading,
  onTabChange,
  onRefresh
}) => {
  const coverage = status?.coverage;
  const coveragePct = asNumber(coverage?.indexCoveragePercent);
  const threshold = percentFromThreshold(ragConfig.minVectorCoverageForHybrid);
  const hybridEnabled = ragConfig.hybridEnabled === true;
  const tone = readinessTone(status?.readiness, hybridEnabled, hasActiveEmbedding);

  const needsIntervention =
    failedJobs > 0 ||
    (hybridEnabled && coveragePct < asNumber(ragConfig.minVectorCoverageForHybrid) * (Number(ragConfig.minVectorCoverageForHybrid) <= 1 ? 100 : 1)) ||
    Boolean(status?.fallbackReason) ||
    !synthesisConfigured;

  const interventionMessages: string[] = [];
  if (failedJobs > 0) interventionMessages.push(`${failedJobs} 个索引任务失败`);
  if (hybridEnabled && hasActiveEmbedding && coveragePct < 80) {
    interventionMessages.push(`索引覆盖率 ${formatPercent(coveragePct)}（门槛 ${threshold}）`);
  }
  if (status?.fallbackReason) interventionMessages.push(labelFallbackReason(status.fallbackReason));
  if (!synthesisConfigured) interventionMessages.push('答案合成智能体未配置');

  return (
    <div className="space-y-3 rounded-2xl border border-hairline-soft bg-canvas p-4 dark:border-white/10 dark:bg-surface-dark">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip label={labelReadiness(status?.readiness)} tone={tone} />
          {coverage && (
            <StatusChip
              label={`${formatPercent(coverage.indexCoveragePercent)} 索引覆盖`}
              tone={coveragePct >= 80 ? 'green' : 'amber'}
            />
          )}
          {(pendingJobs > 0 || failedJobs > 0) && (
            <StatusChip
              label={failedJobs > 0 ? `${failedJobs} 任务失败` : `${pendingJobs} 待处理`}
              tone={failedJobs > 0 ? 'red' : 'blue'}
            />
          )}
          <StatusChip label={labelVectorStorageMode(status?.vectorStorageMode)} tone="slate" />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {saveState !== 'idle' && (
            <span className="text-[12px] text-text-charcoal dark:text-text-secondary">
              {saveState === 'pending' && '待保存…'}
              {saveState === 'saving' && '保存中…'}
              {saveState === 'saved' && '已保存'}
            </span>
          )}
          <OpsRefreshButton onClick={onRefresh} disabled={loading || saveState === 'saving'} />
        </div>
      </div>

      <div
        className="flex flex-wrap items-center gap-1 text-[12px] text-text-charcoal dark:text-text-secondary"
        aria-label="RAG 流水线阶段"
      >
        {NODES.map((node, index) => {
          const isCurrent = node.tab === activeTab;
          return (
            <React.Fragment key={node.id}>
              {index > 0 && <span className="px-1 text-text-stone" aria-hidden="true">→</span>}
              <span
                className={`rounded-full px-2.5 py-1 font-medium ${
                  isCurrent
                    ? 'bg-ink text-white dark:bg-white dark:text-ink'
                    : 'bg-surface-soft text-text-slate dark:bg-white/5 dark:text-text-secondary'
                }`}
                aria-current={isCurrent ? 'step' : undefined}
              >
                {node.label}
              </span>
            </React.Fragment>
          );
        })}
      </div>

      {needsIntervention && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-400/30 dark:bg-amber-400/10">
          <p className="text-[13px] font-medium text-amber-900 dark:text-amber-100">需要介入</p>
          <ul className="mt-1 list-inside list-disc text-[12px] text-amber-800 dark:text-amber-200">
            {interventionMessages.filter(Boolean).map((msg) => (
              <li key={msg}>{msg}</li>
            ))}
          </ul>
          <div className="mt-2 flex flex-wrap gap-2">
            {(failedJobs > 0 || pendingJobs > 0) && (
              <button
                type="button"
                onClick={() => onTabChange('ingest')}
                className="btn-pill-secondary !text-xs !py-1 !px-2"
              >
                前往入库
              </button>
            )}
            {(status?.fallbackReason || !synthesisConfigured) && (
              <button
                type="button"
                onClick={() => onTabChange('retrieve')}
                className="btn-pill-secondary !text-xs !py-1 !px-2"
              >
                检查检索配置
              </button>
            )}
            <button
              type="button"
              onClick={() => onTabChange('diagnose')}
              className="btn-pill-secondary !text-xs !py-1 !px-2"
            >
              打开诊断
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
