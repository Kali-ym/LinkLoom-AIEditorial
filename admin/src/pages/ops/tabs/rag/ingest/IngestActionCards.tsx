import React from 'react';
import { asNumber, formatPercent } from '../shared/ragStatusLabels.js';
import { computeMissingChunkLimit } from './ingestPresets.js';

type PrimaryAction = 'reindex-missing' | 'run-once' | 'view-failed' | null;

type Props = {
  hasActiveEmbedding: boolean;
  pendingJobs: number;
  failedJobs: number;
  lastEmbeddingError?: string | null;
  coverage: any;
  embeddingBatchSize: number;
  busy: string | null;
  onReindexMissing: () => void;
  onRunOnce: () => void;
  onViewFailed: () => void;
};

function resolvePrimaryAction(props: {
  hasActiveEmbedding: boolean;
  pendingJobs: number;
  failedJobs: number;
  missing: number;
}): PrimaryAction {
  if (props.failedJobs > 0) return 'view-failed';
  if (props.pendingJobs > 0) return 'run-once';
  if (props.hasActiveEmbedding && props.missing > 0) return 'reindex-missing';
  if (props.hasActiveEmbedding) return 'reindex-missing';
  return null;
}

export const IngestActionCards: React.FC<Props> = ({
  hasActiveEmbedding,
  pendingJobs,
  failedJobs,
  lastEmbeddingError,
  coverage,
  embeddingBatchSize,
  busy,
  onReindexMissing,
  onRunOnce,
  onViewFailed
}) => {
  const total = asNumber(coverage?.totalChunkCount);
  const indexed = asNumber(coverage?.indexedChunkCount);
  const missing = total > 0 ? Math.max(0, total - indexed) : 0;
  const missingLimit = computeMissingChunkLimit(coverage);
  const primaryAction = resolvePrimaryAction({ hasActiveEmbedding, pendingJobs, failedJobs, missing });

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <ActionCard
        title="补建缺失索引"
        summary={
          hasActiveEmbedding
            ? total > 0
              ? `${formatPercent(coverage?.indexCoveragePercent)} 覆盖 · 约 ${missing} 块待补`
              : '暂无知识库分块'
            : '向量模型未配置，仅全文检索可用'
        }
        actionLabel={busy === 'reindex' ? '处理中…' : '立即补建'}
        disabled={!hasActiveEmbedding || busy !== null}
        onAction={onReindexMissing}
        hint={hasActiveEmbedding ? `扫描上限 ${missingLimit}` : undefined}
        emphasis={primaryAction === 'reindex-missing'}
      />
      <ActionCard
        title="处理待办任务"
        summary={pendingJobs > 0 ? `${pendingJobs} 个排队 · 每批 ${embeddingBatchSize}` : '队列空闲'}
        actionLabel={busy === 'run-once' ? '处理中…' : '处理一批'}
        disabled={pendingJobs === 0 || busy !== null}
        onAction={onRunOnce}
        emphasis={primaryAction === 'run-once'}
      />
      <ActionCard
        title="失败任务"
        summary={
          failedJobs > 0
            ? `${failedJobs} 个需处理${lastEmbeddingError ? ` · ${lastEmbeddingError}` : ''}`
            : '暂无失败任务'
        }
        actionLabel="查看失败任务"
        disabled={failedJobs === 0}
        onAction={onViewFailed}
        warning
        emphasis={primaryAction === 'view-failed'}
      />
    </div>
  );
};

function ActionCard({
  title,
  summary,
  actionLabel,
  disabled,
  onAction,
  hint,
  warning,
  emphasis = false
}: {
  title: string;
  summary: string;
  actionLabel: string;
  disabled?: boolean;
  onAction: () => void;
  hint?: string;
  warning?: boolean;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`flex flex-col rounded-2xl border p-4 ${
        warning
          ? 'border-amber-200 bg-amber-50/50 dark:border-amber-400/30 dark:bg-amber-400/5'
          : emphasis
            ? 'border-ink/20 bg-canvas dark:border-white/15 dark:bg-surface-dark'
            : 'border-hairline-soft bg-surface-soft/40 dark:border-white/10 dark:bg-white/[0.02]'
      }`}
    >
      <p className="text-sm font-semibold text-text-ink dark:text-white">{title}</p>
      <p className="mt-1 flex-1 text-[13px] leading-relaxed text-text-charcoal dark:text-text-secondary">
        {summary}
      </p>
      {hint && <p className="mt-1 text-[12px] text-text-stone">{hint}</p>}
      <button
        type="button"
        disabled={disabled}
        onClick={onAction}
        className={`mt-3 self-start !text-xs !py-1.5 !px-3 disabled:opacity-50 ${
          emphasis ? 'btn-pill-primary' : 'btn-pill-secondary'
        }`}
      >
        {actionLabel}
      </button>
    </div>
  );
}
