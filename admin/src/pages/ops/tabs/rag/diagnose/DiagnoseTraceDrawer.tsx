import React from 'react';
import { useMessageDialog } from '../../../../../context/MessageDialogContext';
import {
  formatStageDuration,
  labelStageName,
  normalizeStages,
  PipelineStageTimeline
} from './diagnoseTraceUtils.js';
import { labelFallbackReason, labelRuntimeMode } from '../shared/ragStatusLabels.js';
import { StatusChip, type ChipTone } from '../shared/ragUi.js';

type Props = {
  trace: any;
  onPrefillSearch?: (query: string) => void;
  onClose?: () => void;
};

export const DiagnoseTraceDrawer: React.FC<Props> = ({ trace, onPrefillSearch, onClose }) => {
  const { alert: showAlert } = useMessageDialog();
  if (!trace) return null;

  const traceStages = normalizeStages(trace?.metadata?.traceStages || trace?.retrievalStages);
  const slowestStage = traceStages
    .filter((stage) => typeof stage.durationMs === 'number')
    .sort((a, b) => Number(b.durationMs || 0) - Number(a.durationMs || 0))[0];

  return (
    <div className="rounded-2xl border border-hairline-soft bg-surface-soft/60 p-4 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-text-ink dark:text-white">检索追踪详情</p>
        {onClose && (
          <button type="button" onClick={onClose} className="btn-pill-ghost !text-xs !py-1 !px-2">
            收起
          </button>
        )}
      </div>
      <div className="mt-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip
            label={trace.retrievalMode ? labelRuntimeMode(trace.retrievalMode) : '未知模式'}
            tone={traceTone(trace)}
          />
          {trace.fallbackReason && (
            <StatusChip
              label={labelFallbackReason(trace.fallbackReason) || trace.fallbackReason}
              tone="amber"
            />
          )}
        </div>
        <p className="break-all text-sm font-semibold text-text-ink dark:text-white">
          {trace.originalQuery}
        </p>
        <p className="text-[12px] text-text-charcoal dark:text-text-secondary">
          记录 ID：{trace.traceId}
        </p>
        {trace.originalQuery && onPrefillSearch && (
          <button
            type="button"
            onClick={() => onPrefillSearch(trace.originalQuery)}
            className="text-[12px] font-medium text-primary hover:underline"
          >
            填入试跑查询
          </button>
        )}
        {slowestStage && (
          <p className="text-[12px] text-amber-700 dark:text-amber-200">
            最慢阶段：{labelStageName(slowestStage.name)} · {formatStageDuration(slowestStage.durationMs)}
          </p>
        )}
        <PipelineStageTimeline stages={traceStages} emptyText="该 trace 没有阶段明细" />
        {trace.answer && (
          <div>
            <p className="text-sm font-semibold text-text-ink dark:text-white">最终输出</p>
            <p className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-canvas p-3 text-xs dark:bg-black/20">
              {trace.answer}
            </p>
          </div>
        )}
        {trace.originalQuery && trace.originalQuery.length > 160 && (
          <button
            type="button"
            onClick={() => void showAlert({ title: '查询原文', message: trace.originalQuery })}
            className="text-[12px] text-primary hover:underline"
          >
            弹窗查看完整查询
          </button>
        )}
      </div>
    </div>
  );
};

function traceTone(trace: any): ChipTone {
  if (trace?.fallbackReason) return 'amber';
  if (trace?.metadata?.citationDecision?.action === 'refuse') return 'red';
  return 'blue';
}
