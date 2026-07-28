import React, { useState } from 'react';
import { StatusChip, type ChipTone } from '../shared/ragUi.js';

export type RagStage = {
  name?: string;
  status?: string;
  durationMs?: number;
  resultCount?: number;
  reason?: string;
  error?: string;
  metadata?: Record<string, unknown>;
};

const STAGE_LABELS: Record<string, string> = {
  fts: '全文检索',
  vector: '向量检索',
  pgvector: 'pgvector',
  jsonb_vector: 'JSONB 向量',
  query_embedding: 'Query Embedding',
  rerank: 'Rerank 精排',
  mmr: 'MMR 去冗余',
  coverage: '覆盖率检查',
  scope_filter: '范围过滤',
  query_expansion: 'Query 扩展',
  query_rewrite: 'Query 改写',
  category_choice: '分类预选',
  document_choice: '文档预选',
  context_build: '上下文组装',
  generation: '答案合成',
  generation_retry: '引用重试生成',
  citation_check: '引用校验',
  citation_check_retry: '引用重试校验',
  dimension_check: '维度校验',
  planner: 'Query Planner'
};

const MAX_STAGE_DETAIL_LENGTH = 280;

export function labelStageName(name?: string): string {
  if (!name) return '-';
  return STAGE_LABELS[name] || name;
}

export function stageTone(status?: string): ChipTone {
  if (status === 'success') return 'green';
  if (status === 'failed') return 'red';
  if (status === 'skipped') return 'amber';
  return 'slate';
}

export function formatStageDuration(value: unknown): string {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return '0ms';
  if (n < 1000) return `${Math.round(n)}ms`;
  return `${(n / 1000).toFixed(2)}s`;
}

export function normalizeStages(value: unknown): RagStage[] {
  return Array.isArray(value) ? (value as RagStage[]) : [];
}

type PipelineStageTimelineProps = {
  stages: RagStage[];
  compact?: boolean;
  emptyText?: string;
};

export const PipelineStageTimeline: React.FC<PipelineStageTimelineProps> = ({
  stages,
  compact = false,
  emptyText = '暂无阶段明细'
}) => {
  if (stages.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-hairline-soft p-4 text-center text-[12px] text-text-charcoal dark:text-text-secondary">
        {emptyText}
      </p>
    );
  }

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {stages.map((stage, index) => (
          <React.Fragment key={`${stage.name}-${index}`}>
            {index > 0 && (
              <span className="text-[12px] text-text-stone dark:text-text-secondary">→</span>
            )}
            <StageChip stage={stage} />
          </React.Fragment>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {stages.map((stage, index) => (
        <StageRow key={`${stage.name}-${index}`} stage={stage} />
      ))}
    </div>
  );
};

function StageChip({ stage }: { stage: RagStage }) {
  return (
    <span
      title={[stage.reason, stage.error].filter(Boolean).join(' · ') || undefined}
      className="inline-flex items-center gap-1 rounded-full border border-hairline-soft bg-surface-soft/60 px-2 py-0.5 dark:border-white/10 dark:bg-white/[0.03]"
    >
      <StatusChip label={labelStageName(stage.name)} tone={stageTone(stage.status)} />
      {stage.durationMs != null && stage.durationMs > 0 && (
        <span className="text-[12px] text-text-stone">{formatStageDuration(stage.durationMs)}</span>
      )}
    </span>
  );
}

export function StageRow({ stage }: { stage: RagStage }) {
  const [expanded, setExpanded] = useState(false);
  const detail = stage.metadata ? JSON.stringify(stage.metadata) : '';
  const isLong = detail.length > MAX_STAGE_DETAIL_LENGTH;

  return (
    <div className="rounded-lg border border-hairline-soft bg-canvas p-3 dark:border-white/10 dark:bg-black/20">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip label={stage.status || '-'} tone={stageTone(stage.status)} />
          <span className="text-sm font-semibold text-text-ink dark:text-white">
            {labelStageName(stage.name)}
          </span>
        </div>
        <span className="text-[12px] text-text-charcoal dark:text-text-secondary">
          {formatStageDuration(stage.durationMs)}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-[12px] text-text-charcoal dark:text-text-secondary">
        {stage.resultCount !== undefined && <span>结果 {stage.resultCount}</span>}
        {stage.reason && <span>原因 {stage.reason}</span>}
        {stage.error && <span className="text-red-600 dark:text-red-200">{stage.error}</span>}
      </div>
      {detail && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="text-[12px] text-primary hover:underline"
          >
            {expanded ? '收起' : '展开'}元数据 {isLong && `(${detail.length} 字符)`}
          </button>
          {(expanded || !isLong) && (
            <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded bg-surface-soft p-2 text-[12px] leading-relaxed text-text-stone dark:bg-black/30">
              {detail}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
