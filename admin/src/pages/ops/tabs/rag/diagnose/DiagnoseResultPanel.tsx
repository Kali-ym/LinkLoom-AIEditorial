import React, { useState } from 'react';
import type { RagEvidenceItem, RagSearchExplicitResult } from '../../../../../services/ragService';
import {
  labelFallbackReason,
  labelRuntimeMode,
  labelSearchStatus
} from '../shared/ragStatusLabels.js';
import { formatStageDuration, normalizeStages, PipelineStageTimeline } from './diagnoseTraceUtils.js';
import { opsHintClass, SectionCard, StatusChip } from '../shared/ragUi.js';
import { DiagnoseTraceDrawer } from './DiagnoseTraceDrawer.js';

type Props = {
  result: RagSearchExplicitResult;
  selectedTrace?: any;
  onSelectTrace?: (traceId: string) => void;
  onPrefillSearch?: (query: string) => void;
};

export const DiagnoseResultPanel: React.FC<Props> = ({
  result,
  selectedTrace,
  onSelectTrace,
  onPrefillSearch
}) => {
  const [showTrace, setShowTrace] = useState(false);
  const evidence = result.evidence ?? [];
  const stages = normalizeStages(result.stages);
  const modeLabel = result.retrievalMode
    ? labelRuntimeMode(result.retrievalMode)
    : labelSearchStatus(result.status);
  const fallbackLabel = result.fallbackReason
    ? labelFallbackReason(result.fallbackReason) || result.fallbackReason
    : '';

  React.useEffect(() => {
    if (result.traceId && onSelectTrace) {
      onSelectTrace(result.traceId);
      setShowTrace(true);
    }
  }, [result.traceId, onSelectTrace]);

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <SectionCard title={`召回结果（${evidence.length} 条）`}>
        {evidence.length === 0 ? (
          <p className="text-[12px] text-text-charcoal dark:text-text-secondary">无检索证据</p>
        ) : (
          evidence.map((item, index) => (
            <EvidenceRow key={item.id || item.chunkId || index} item={item} rank={index + 1} />
          ))
        )}
      </SectionCard>

      <SectionCard title="阶段摘要">
        <div className="flex flex-wrap items-center gap-2 text-[12px]">
          <StatusChip label={modeLabel} tone="blue" />
          {fallbackLabel && <StatusChip label={fallbackLabel} tone="amber" />}
          <span className="text-text-charcoal dark:text-text-secondary">
            {formatStageDuration(result.durationMs)} · {evidence.length} 条证据
          </span>
        </div>
        {stages.length > 0 && (
          <div className="mt-3">
            <PipelineStageTimeline stages={stages} compact />
          </div>
        )}
        {result.traceId && (
          <button
            type="button"
            onClick={() => setShowTrace((v) => !v)}
            className="mt-3 text-[12px] font-medium text-primary hover:underline"
          >
            {showTrace ? '收起' : '展开'}检索追踪详情 →
          </button>
        )}
        {showTrace && selectedTrace && (
          <div className="mt-3">
            <DiagnoseTraceDrawer
              trace={selectedTrace?.trace || selectedTrace}
              onPrefillSearch={onPrefillSearch}
              onClose={() => setShowTrace(false)}
            />
          </div>
        )}
      </SectionCard>
    </div>
  );
};

function EvidenceRow({ item, rank }: { item: RagEvidenceItem; rank: number }) {
  return (
    <div className="mb-2 rounded-2xl border border-hairline-soft bg-surface-soft/60 p-3 dark:border-white/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-text-ink dark:text-white">
          <span className="mr-2 text-[12px] font-normal text-text-stone">#{rank}</span>
          {item.title || item.documentId || item.chunkId || '证据'}
        </p>
        {item.score != null && (
          <span className="text-[12px] text-text-charcoal dark:text-text-secondary">
            {Number(item.score).toFixed(4)}
          </span>
        )}
      </div>
      {item.citation && <p className={`mt-1 ${opsHintClass}`}>引用：{item.citation}</p>}
      {item.content && (
        <p className="mt-2 max-h-24 overflow-auto whitespace-pre-wrap text-xs text-text-slate dark:text-text-secondary">
          {item.content}
        </p>
      )}
    </div>
  );
}
