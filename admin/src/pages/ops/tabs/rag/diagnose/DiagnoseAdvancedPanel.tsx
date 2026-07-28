import React, { useState } from 'react';
import {
  compareRagEval,
  runRagEval,
  type RagIndexVersion
} from '../../../../../services/ragService';
import { OPS_METRIC_HINTS } from '../../../opsMetricHints';
import { OpsLabelWithHint, OpsRefreshButton, OpsSubNav } from '../../../opsUiPrimitives';
import { useOpsConfirm } from '../../../useOpsConfirm';
import { DiagnoseTraceDrawer } from './DiagnoseTraceDrawer.js';
import { formatStageDuration } from './diagnoseTraceUtils.js';
import { opsHintClass, opsInputClass, opsSelectClass, SectionCard, StatusChip, type ChipTone } from '../shared/ragUi.js';
import type { DiagnoseAdvancedView, RagObservabilityData } from '../shared/types.js';

type Props = {
  data: RagObservabilityData;
  loading?: boolean;
  busyAction?: string | null;
  initialView?: DiagnoseAdvancedView;
  forceOpen?: boolean;
  onSelectTrace: (traceId: string) => void;
  onRefresh: () => void;
  onPrefillSearch?: (query: string) => void;
  onCreateCandidate?: () => void | Promise<void>;
  onEvaluateVersion?: (version: RagIndexVersion, datasetId: string) => void | Promise<void>;
  onActivateVersion?: (version: RagIndexVersion, force?: boolean) => void | Promise<void>;
  onRollbackVersion?: () => void | Promise<void>;
};

export const DiagnoseAdvancedPanel: React.FC<Props> = ({
  data,
  loading,
  busyAction,
  initialView = 'traces',
  forceOpen,
  onSelectTrace,
  onRefresh,
  onPrefillSearch,
  onCreateCandidate,
  onEvaluateVersion,
  onActivateVersion,
  onRollbackVersion
}) => {
  const { confirm } = useOpsConfirm();
  const [view, setView] = useState<DiagnoseAdvancedView>(initialView);
  const [evalDatasetId, setEvalDatasetId] = useState('');
  const [datasetId, setDatasetId] = useState('');
  const [indexVersion, setIndexVersion] = useState('');
  const [limit, setLimit] = useState(5);
  const [compareBaselineRunId, setCompareBaselineRunId] = useState('');
  const [compareCandidateRunId, setCompareCandidateRunId] = useState('');
  const [evalBusy, setEvalBusy] = useState<string | null>(null);
  const [evalMessage, setEvalMessage] = useState<string | null>(null);

  React.useEffect(() => {
    if (initialView) setView(initialView);
  }, [initialView]);

  const selectedTrace = data.selectedTrace?.trace || data.selectedTrace;

  const handleRunEval = async () => {
    if (!datasetId) return;
    setEvalBusy('run');
    setEvalMessage(null);
    try {
      const result = await runRagEval({
        datasetId,
        indexVersion: indexVersion.trim() || undefined,
        limit
      });
      const passRate = result?.run?.summary?.passRate ?? result?.gate?.passRate;
      setEvalMessage(
        passRate != null ? `评估完成，通过率 ${formatPercent(passRate)}` : '评估完成'
      );
      onRefresh();
    } catch (err: unknown) {
      setEvalMessage(err instanceof Error ? err.message : '评估运行失败');
    } finally {
      setEvalBusy(null);
    }
  };

  const handleCompare = async () => {
    if (!compareBaselineRunId || !compareCandidateRunId) return;
    setEvalBusy('compare');
    setEvalMessage(null);
    try {
      const result = await compareRagEval({
        baselineRunId: compareBaselineRunId.trim(),
        candidateRunId: compareCandidateRunId.trim(),
        datasetId: datasetId || undefined
      });
      const passed = result?.comparison?.gate?.passed ?? result?.gate?.passed;
      setEvalMessage(passed === true ? '对比通过质量门槛' : passed === false ? '对比未通过质量门槛' : '对比完成');
    } catch (err: unknown) {
      setEvalMessage(err instanceof Error ? err.message : '对比失败');
    } finally {
      setEvalBusy(null);
    }
  };

  return (
    <details className="rounded-2xl border border-hairline-soft bg-canvas dark:border-white/10 dark:bg-surface-dark" open={forceOpen}>
      <summary className="cursor-pointer select-none px-4 py-3 text-base font-semibold text-text-ink dark:text-white">
        高级诊断
      </summary>
      <div className="space-y-4 border-t border-hairline-soft px-4 py-4 dark:border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <OpsSubNav
            items={[
              { id: 'traces' as const, label: '检索记录' },
              { id: 'versions' as const, label: '版本评估' },
              { id: 'eval' as const, label: '评估对比' }
            ]}
            active={view}
            onChange={setView}
            aria-label="高级诊断视图"
          />
          <OpsRefreshButton onClick={onRefresh} disabled={loading} label={loading ? '刷新中…' : '刷新'} />
        </div>

        {view === 'traces' && (
          <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)]">
            <div className="min-w-0 space-y-2">
              {(data.traces || []).length === 0 && <EmptyState text="暂无检索记录" />}
              {(data.traces || []).map((trace) => (
                <button
                  key={trace.traceId}
                  type="button"
                  onClick={() => onSelectTrace(trace.traceId)}
                  className={`w-full rounded-2xl border p-3 text-left transition ${
                    selectedTrace?.traceId === trace.traceId
                      ? 'border-ink/30 bg-ink/[0.04] dark:border-white/30 dark:bg-white/10'
                      : 'border-hairline-soft bg-surface-soft/60 hover:border-ink/20 dark:border-white/10'
                  }`}
                >
                  <p className="line-clamp-2 text-sm font-semibold text-text-ink dark:text-white">
                    {trace.originalQuery || '-'}
                  </p>
                  <p className="mt-1 font-mono text-[12px] text-text-stone">{trace.traceId}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-[12px] text-text-charcoal dark:text-text-secondary">
                    <span>{formatStageDuration(trace.latencyMs)}</span>
                    <span>{trace.selectedEvidenceIds?.length || 0} 条证据</span>
                  </div>
                </button>
              ))}
            </div>
            {selectedTrace ? (
              <DiagnoseTraceDrawer trace={selectedTrace} onPrefillSearch={onPrefillSearch} />
            ) : (
              <EmptyState text="选择一条检索记录查看详情" />
            )}
          </div>
        )}

        {view === 'versions' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {onCreateCandidate && (
                <button
                  type="button"
                  disabled={!!busyAction}
                  onClick={() => void onCreateCandidate()}
                  className="btn-pill-primary !text-xs !py-1.5 !px-3 disabled:opacity-50"
                >
                  {busyAction === 'create-candidate' ? '创建中…' : '创建候选版本'}
                </button>
              )}
              {onRollbackVersion && (
                <button
                  type="button"
                  disabled={!!busyAction}
                  onClick={() => {
                    void (async () => {
                      const ok = await confirm({
                        title: '回滚索引版本',
                        message: '确认回滚到上一个已通过评估的索引版本？',
                        confirmLabel: '确认回滚',
                        tone: 'danger'
                      });
                      if (ok) void onRollbackVersion();
                    })();
                  }}
                  className="btn-pill-secondary !text-xs !py-1.5 !px-3 text-red-700 disabled:opacity-50"
                >
                  {busyAction === 'rollback' ? '回滚中…' : '回滚激活版本'}
                </button>
              )}
              {data.evalDatasets.length > 0 && (
                <select value={evalDatasetId} onChange={(e) => setEvalDatasetId(e.target.value)} className={opsSelectClass}>
                  <option value="">选择评估数据集</option>
                  {data.evalDatasets.map((ds) => (
                    <option key={ds.id} value={ds.id}>{ds.name}</option>
                  ))}
                </select>
              )}
            </div>
            {data.activeIndexVersion && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-[12px] text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-400/10">
                当前激活：{data.activeIndexVersion.version || data.activeIndexVersion.id}
              </div>
            )}
            {(data.indexVersions || []).map((version) => (
              <VersionRow
                key={version.id || version.version}
                version={version}
                evalDatasetId={evalDatasetId}
                busyAction={busyAction}
                onEvaluateVersion={onEvaluateVersion}
                onActivateVersion={onActivateVersion}
                confirm={confirm}
              />
            ))}
          </div>
        )}

        {view === 'eval' && (
          <SectionCard title="评估对比" subtitle="选择测试集运行评估，或对比两次评估记录。">
            <div className="grid gap-3 md:grid-cols-3">
              <label className="space-y-1 text-sm">
                <OpsLabelWithHint label="测试集" hint={OPS_METRIC_HINTS.passRate} />
                <select value={datasetId} onChange={(e) => setDatasetId(e.target.value)} className={`w-full ${opsSelectClass}`}>
                  <option value="">选择测试集</option>
                  {data.evalDatasets.map((ds) => (
                    <option key={ds.id} value={ds.id}>{ds.name}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span>索引版本（可选）</span>
                <select value={indexVersion} onChange={(e) => setIndexVersion(e.target.value)} className={`w-full ${opsSelectClass}`}>
                  <option value="">当前激活</option>
                  {data.indexVersions.map((v) => (
                    <option key={v.id} value={v.version || v.id}>{v.version || v.id}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span>用例上限</span>
                <input type="number" min={1} max={50} value={limit} onChange={(e) => setLimit(Number(e.target.value) || 5)} className={`w-full ${opsInputClass}`} />
              </label>
            </div>
            <button
              type="button"
              disabled={evalBusy !== null || !datasetId}
              onClick={() => void handleRunEval()}
              className="btn-pill-primary !text-xs !py-1.5 !px-3 mt-3 disabled:opacity-50"
            >
              {evalBusy === 'run' ? '运行中…' : '运行评估'}
            </button>
            <div className="mt-4 rounded-2xl border border-hairline-soft bg-surface-soft/40 p-3">
              <p className="text-sm font-semibold">对比两次评估记录</p>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <input value={compareBaselineRunId} onChange={(e) => setCompareBaselineRunId(e.target.value)} placeholder="基线评估 ID" className={opsInputClass} />
                <input value={compareCandidateRunId} onChange={(e) => setCompareCandidateRunId(e.target.value)} placeholder="候选评估 ID" className={opsInputClass} />
              </div>
              <button
                type="button"
                disabled={evalBusy !== null || !compareBaselineRunId || !compareCandidateRunId}
                onClick={() => void handleCompare()}
                className="btn-pill-secondary !text-xs !py-1.5 !px-3 mt-2 disabled:opacity-50"
              >
                {evalBusy === 'compare' ? '对比中…' : '对比'}
              </button>
            </div>
            {evalMessage && <p className={`mt-3 ${opsHintClass}`}>{evalMessage}</p>}
            {data.evalRuns.slice(0, 5).map((run) => (
              <div key={run.id} className="mt-2 flex items-center justify-between rounded-2xl bg-surface-soft px-3 py-2 text-xs">
                <span className="font-mono">{run.id.slice(-16)}</span>
                <StatusChip label={`通过 ${formatPercent(run.summary?.passRate)}`} tone={Number(run.summary?.passRate || 0) >= 0.8 ? 'green' : 'amber'} />
              </div>
            ))}
          </SectionCard>
        )}
      </div>
    </details>
  );
};

function VersionRow({
  version,
  evalDatasetId,
  busyAction,
  onEvaluateVersion,
  onActivateVersion,
  confirm
}: {
  version: RagIndexVersion;
  evalDatasetId: string;
  busyAction?: string | null;
  onEvaluateVersion?: (v: RagIndexVersion, datasetId: string) => void | Promise<void>;
  onActivateVersion?: (v: RagIndexVersion, force?: boolean) => void | Promise<void>;
  confirm: (opts: any) => Promise<boolean>;
}) {
  return (
    <div className="rounded-2xl border border-hairline-soft bg-surface-soft/60 p-3 dark:border-white/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">{version.version || version.id}</p>
        <StatusChip label={version.status || '-'} tone={versionTone(version.status)} />
      </div>
      <p className="mt-2 text-[12px] text-text-charcoal">
        通过率：{formatPercent(version.evalResult?.passRate)}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {onEvaluateVersion && evalDatasetId && (
          <button type="button" disabled={!!busyAction} onClick={() => void onEvaluateVersion(version, evalDatasetId)} className="btn-pill-secondary !text-xs !py-1 !px-2">
            运行评估
          </button>
        )}
        {onActivateVersion && version.status !== 'active' && (
          <button
            type="button"
            disabled={!!busyAction}
            onClick={() => {
              void (async () => {
                const ok = await confirm({ title: '激活索引版本', message: `确认激活 ${version.version || version.id}？`, confirmLabel: '激活' });
                if (ok) void onActivateVersion(version, false);
              })();
            }}
            className="btn-pill-primary !text-xs !py-1 !px-2 !bg-emerald-600"
          >
            激活
          </button>
        )}
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className={`rounded-2xl border border-dashed border-hairline-soft p-4 text-center ${opsHintClass}`}>
      {text}
    </div>
  );
}

function versionTone(status?: string): ChipTone {
  if (status === 'active') return 'green';
  if (status === 'failed') return 'red';
  if (status === 'building') return 'blue';
  if (status === 'candidate') return 'amber';
  return 'slate';
}

function formatPercent(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  const normalized = n <= 1 ? n * 100 : n;
  return `${Math.round(normalized * 10) / 10}%`;
}
