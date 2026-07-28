import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '../../../../context/ToastContext.js';
import { agentService } from '../../../../services/agentService';
import { getSettings, saveSettings } from '../../../../services/settingsService';
import {
  activateRagIndexVersion,
  createRagIndexVersion,
  evaluateRagIndexVersion,
  getRagEvalDatasets,
  getRagEvalRuns,
  getRagIndexVersions,
  getRagJobs,
  getRagStatus,
  getRagTrace,
  getRagTraces,
  reindexRagEmbeddings,
  rollbackRagIndexVersion,
  runRagEmbeddingJobsOnce,
  testRagService,
  type RagIndexVersion
} from '../../../../services/ragService';
import { prepareSettingsForSave } from '../../../../utils/secretField';
import { type SmallModelService } from '../../../settings/fields/ai/smallModelUtils';
import { AnimatedPillTabs } from '../../../../components/UI/ScrollablePillNav';
import { getOpsErrorMessage, OpsErrorBanner } from '../../opsUiPrimitives';
import { useOpsConfirm } from '../../useOpsConfirm';
import { DiagnoseTab } from './diagnose/DiagnoseTab.js';
import { IngestTab } from './ingest/IngestTab.js';
import { buildReindexMissingParams } from './ingest/ingestPresets.js';
import { RagPipelineHeader } from './RagPipelineHeader.js';
import { RetrieveTab } from './retrieve/RetrieveTab.js';
import { asNumber, parseCsv } from './shared/ragStatusLabels.js';
import type { DiagnoseAdvancedView, RagObservabilityData, RagPipelineTab, ReindexOptions } from './shared/types.js';

const RAG_TABS: Array<{ id: RagPipelineTab; label: string }> = [
  { id: 'ingest', label: '入库' },
  { id: 'retrieve', label: '检索' },
  { id: 'diagnose', label: '诊断' }
];

const AUTO_SAVE_DELAY_MS = 600;

type SaveState = 'idle' | 'pending' | 'saving' | 'saved';

const EMPTY_OBSERVABILITY_DATA: RagObservabilityData = {
  traces: [],
  indexVersions: [],
  evalRuns: [],
  evalDatasets: []
};

function serializePolicy(
  ragConfig: Record<string, unknown>,
  activeEmbeddingId: string,
  activeRerankId: string
) {
  return JSON.stringify({ ragConfig, activeEmbeddingId, activeRerankId });
}

async function fetchRagObservabilityData(selectedTraceId?: string): Promise<RagObservabilityData> {
  const [tracesResult, indexVersionsResult, evalDatasetsResult, evalRunsResult] = await Promise.all([
    getRagTraces({ limit: 20 }),
    getRagIndexVersions({ limit: 20 }),
    getRagEvalDatasets(),
    getRagEvalRuns({ limit: 20 })
  ]);
  const traces = asArray(tracesResult?.traces);
  const traceId = selectedTraceId || traces[0]?.traceId;
  const selectedTrace = traceId
    ? (await getRagTrace(traceId))?.trace || traces.find((trace) => trace.traceId === traceId)
    : undefined;

  return {
    traces,
    selectedTrace,
    indexVersions: asArray(indexVersionsResult?.versions),
    activeIndexVersion: indexVersionsResult?.active,
    evalDatasets: asArray(evalDatasetsResult?.datasets),
    evalRuns: asArray(evalRunsResult?.runs)
  };
}

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function resolveTraceId(value: any): string | undefined {
  return value?.traceId || value?.trace?.traceId;
}

function formatPassRateToast(passRate: unknown): string {
  if (passRate == null || !Number.isFinite(Number(passRate))) return '评估完成';
  const raw = Number(passRate);
  const percent = Math.round(raw <= 1 ? raw * 100 : raw);
  return `评估完成，通过率 ${percent}%`;
}

export const RagOpsTab: React.FC = () => {
  const { success: toastSuccess, error: toastError } = useToast();
  const { confirm } = useOpsConfirm();
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [ragConfig, setRagConfig] = useState<Record<string, unknown>>({});
  const [activeEmbeddingId, setActiveEmbeddingId] = useState('');
  const [activeRerankId, setActiveRerankId] = useState('');
  const [status, setStatus] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [jobsFilter, setJobsFilter] = useState<'all' | 'failed'>('all');
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [busy, setBusy] = useState<string | null>(null);
  const lastSavedSnapshotRef = useRef('');
  const saveRequestIdRef = useRef(0);
  const [testingServiceId, setTestingServiceId] = useState<string | null>(null);
  const [reindexOptions, setReindexOptions] = useState<ReindexOptions>({
    limit: 100,
    targetStorage: 'dual',
    dryRun: false,
    onlyMissing: true,
    documentIds: '',
    categoryIds: '',
    indexVersion: ''
  });
  const [observabilityData, setObservabilityData] = useState<RagObservabilityData>(EMPTY_OBSERVABILITY_DATA);
  const [observabilityLoading, setObservabilityLoading] = useState(false);
  const [observabilityBusy, setObservabilityBusy] = useState<string | null>(null);
  const [sandboxQuery, setSandboxQuery] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<RagPipelineTab>('ingest');
  const [diagnoseAdvancedView, setDiagnoseAdvancedView] = useState<DiagnoseAdvancedView>('versions');
  const [diagnoseAdvancedOpen, setDiagnoseAdvancedOpen] = useState(false);
  const selectedTraceIdRef = useRef<string | undefined>(undefined);

  const loadJobs = useCallback(async (filter: 'all' | 'failed' = jobsFilter) => {
    const jobsResult = await getRagJobs({
      limit: 10,
      ...(filter === 'failed' ? { status: 'failed' } : {})
    });
    setJobs(jobsResult.jobs || []);
    setJobsFilter(filter);
  }, [jobsFilter]);

  const loadObservability = useCallback(async (traceId?: string, options: { silent?: boolean } = {}) => {
    try {
      setObservabilityLoading(true);
      const nextData = await fetchRagObservabilityData(traceId || selectedTraceIdRef.current);
      selectedTraceIdRef.current = resolveTraceId(nextData.selectedTrace);
      setObservabilityData(nextData);
    } catch (err: any) {
      if (!options.silent) {
        toastError(err?.message || '加载 RAG 可观测数据失败');
      }
    } finally {
      setObservabilityLoading(false);
    }
  }, [toastError]);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      setHydrated(false);
      saveRequestIdRef.current += 1;
      const [settingsData, nextStatus, jobsResult, agentsData] = await Promise.all([
        getSettings(),
        getRagStatus(),
        getRagJobs({ limit: 10, ...(jobsFilter === 'failed' ? { status: 'failed' } : {}) }),
        agentService.getAgents()
      ]);
      const nextRagConfig = settingsData?.RAG_CONFIG || {};
      const nextEmbeddingId = settingsData?.ACTIVE_EMBEDDING_SERVICE_ID || '';
      const nextRerankId = settingsData?.ACTIVE_RERANK_SERVICE_ID || '';
      setSettings(settingsData || {});
      setRagConfig(nextRagConfig);
      setAgents(agentsData || []);
      setActiveEmbeddingId(nextEmbeddingId);
      setActiveRerankId(nextRerankId);
      setStatus(nextStatus);
      setJobs(jobsResult.jobs || []);
      lastSavedSnapshotRef.current = serializePolicy(nextRagConfig, nextEmbeddingId, nextRerankId);
      setHydrated(true);
      setSaveState('idle');
      setLoadError(null);
      void loadObservability(undefined, { silent: true });
    } catch (err: unknown) {
      const message = getOpsErrorMessage(err, '加载知识库检索设置失败');
      setLoadError(message);
      toastError(message);
    } finally {
      setLoading(false);
    }
  }, [jobsFilter, loadObservability, toastError]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const patchRag = useCallback((patch: Record<string, unknown>) => {
    setRagConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  const persistPolicy = useCallback(async () => {
    const snapshot = serializePolicy(ragConfig, activeEmbeddingId, activeRerankId);
    if (snapshot === lastSavedSnapshotRef.current) return;

    const requestId = ++saveRequestIdRef.current;
    setSaveState('saving');
    try {
      const nextSettings = {
        ...settings,
        RAG_CONFIG: ragConfig,
        ACTIVE_EMBEDDING_SERVICE_ID: activeEmbeddingId,
        ACTIVE_RERANK_SERVICE_ID: activeRerankId
      };
      await saveSettings(prepareSettingsForSave(nextSettings));
      if (requestId !== saveRequestIdRef.current) return;

      setSettings(nextSettings);
      lastSavedSnapshotRef.current = snapshot;
      setSaveState('saved');
      const nextStatus = await getRagStatus();
      if (requestId === saveRequestIdRef.current) {
        setStatus(nextStatus);
      }
    } catch (err: any) {
      if (requestId !== saveRequestIdRef.current) return;
      setSaveState('idle');
      toastError(err?.message || '自动保存失败');
    }
  }, [activeEmbeddingId, activeRerankId, ragConfig, settings, toastError]);

  useEffect(() => {
    if (!hydrated || loading) return;
    const snapshot = serializePolicy(ragConfig, activeEmbeddingId, activeRerankId);
    if (snapshot === lastSavedSnapshotRef.current) return;
    setSaveState('pending');
    const timer = window.setTimeout(() => {
      void persistPolicy();
    }, AUTO_SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [ragConfig, activeEmbeddingId, activeRerankId, hydrated, loading, persistPolicy]);

  useEffect(() => {
    if (saveState !== 'saved') return;
    const timer = window.setTimeout(() => setSaveState('idle'), 2000);
    return () => window.clearTimeout(timer);
  }, [saveState]);

  const smallServices: SmallModelService[] = settings.SMALL_MODEL_SERVICES || [];
  const embeddingServices = useMemo(
    () => smallServices.filter((svc) => svc.role === 'EMBEDDING' && svc.enabled),
    [smallServices]
  );
  const rerankServices = useMemo(
    () => smallServices.filter((svc) => svc.role === 'RERANK' && svc.enabled),
    [smallServices]
  );

  const hasActiveEmbedding = Boolean(activeEmbeddingId || status?.embeddingService);
  const synthesisConfigured = Boolean(
    status?.synthesisAgent?.configured && status?.synthesisAgent?.found
  ) || Boolean(String(ragConfig.synthesisAgentId || '').trim());
  const jobStats = status?.jobStats;
  const pendingJobs = asNumber(jobStats?.pending) + asNumber(jobStats?.running);
  const failedJobs = asNumber(jobStats?.failed);

  const enqueueReindex = async (options?: Partial<ReindexOptions>) => {
    const opts = { ...reindexOptions, ...options };
    try {
      setBusy('reindex');
      const result = await reindexRagEmbeddings({
        targetStorage: opts.targetStorage,
        onlyMissing: opts.onlyMissing,
        dryRun: opts.dryRun,
        limit: opts.limit,
        documentIds: parseCsv(opts.documentIds),
        categoryIds: parseCsv(opts.categoryIds),
        indexVersion: opts.indexVersion.trim() || undefined
      });
      toastSuccess(result.message || `已入队 ${result.queued || 0} 个索引任务`);
      await loadAll();
    } catch (err: any) {
      toastError(err?.message || '重建索引失败');
    } finally {
      setBusy(null);
    }
  };

  const retryDocuments = async (documentIds: string[]) => {
    const ids = documentIds.map((id) => id.trim()).filter(Boolean);
    if (!ids.length) return;
    await enqueueReindex({
      documentIds: ids.join(','),
      onlyMissing: false,
      dryRun: false
    });
  };

  const retryFailedDocument = async (documentId: string) => {
    await retryDocuments([documentId]);
  };

  const retryAllFailedJobs = async () => {
    const ids = jobs
      .filter((job) => job.status === 'failed' && job.documentId)
      .map((job) => String(job.documentId));
    if (!ids.length) {
      toastError('没有可重新入队的失败任务');
      return;
    }
    await retryDocuments(ids);
  };

  const reindexMissing = async () => {
    if (failedJobs > 10) {
      const ok = await confirm({
        title: '补建缺失索引',
        message: `当前有 ${failedJobs} 个失败任务，确认继续补建缺失索引？`,
        confirmLabel: '继续'
      });
      if (!ok) return;
    }
    const params = buildReindexMissingParams(status?.coverage);
    await enqueueReindex(params);
  };

  const runOnce = async () => {
    try {
      setBusy('run-once');
      const result = await runRagEmbeddingJobsOnce({
        limit: Number(ragConfig.embeddingBatchSize) || 16
      });
      toastSuccess(`本次处理 ${result.claimed || 0} 个，成功 ${result.succeeded || 0} 个`);
      await loadAll();
    } catch (err: any) {
      toastError(err?.message || '处理索引任务失败');
    } finally {
      setBusy(null);
    }
  };

  const testService = async (serviceId: string, label: string) => {
    if (!serviceId) return;
    try {
      setTestingServiceId(serviceId);
      const result = await testRagService({ serviceId });
      const dimensionText = result.dimensions ? `，向量维度 ${result.dimensions}` : '';
      toastSuccess(`${label} 连接正常${dimensionText}`);
    } catch (err: any) {
      toastError(err?.message || `${label} 连接测试失败`);
    } finally {
      setTestingServiceId(null);
    }
  };

  const selectTrace = useCallback((traceId: string) => {
    selectedTraceIdRef.current = traceId;
    void loadObservability(traceId);
  }, [loadObservability]);

  const handleBindVersionNavigate = (version: string) => {
    setDiagnoseAdvancedView('versions');
    setDiagnoseAdvancedOpen(true);
    setActiveTab('diagnose');
    toastSuccess(`已绑定 reindex 目标版本：${version}`);
  };

  if (loading && !status && !loadError) {
    return <div className="py-12 text-center text-[13px] text-text-charcoal dark:text-text-secondary">加载中…</div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold text-text-ink dark:text-white">知识库检索</h3>
        <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-text-charcoal dark:text-text-secondary">
          按知识库流水线管理：入库索引 → 混合检索 → 诊断验收。全文检索始终可用，混合检索与精排可按需启用。
        </p>
      </div>

      {loadError && <OpsErrorBanner message={loadError} onRetry={() => void loadAll()} />}

      <RagPipelineHeader
        status={status}
        ragConfig={ragConfig}
        activeTab={activeTab}
        pendingJobs={pendingJobs}
        failedJobs={failedJobs}
        hasActiveEmbedding={hasActiveEmbedding}
        synthesisConfigured={synthesisConfigured}
        saveState={saveState}
        loading={loading}
        onTabChange={setActiveTab}
        onRefresh={() => void loadAll()}
      />

      <AnimatedPillTabs
        tabs={RAG_TABS}
        active={activeTab}
        onChange={setActiveTab}
        layoutId="rag-pipeline-tabs"
        size="sm"
        aria-label="知识库检索分区"
      />

      {activeTab === 'ingest' && (
        <IngestTab
          ragConfig={ragConfig}
          status={status}
          hasActiveEmbedding={hasActiveEmbedding}
          pendingJobs={pendingJobs}
          failedJobs={failedJobs}
          jobs={jobs}
          jobsFilter={jobsFilter}
          busy={busy}
          reindexOptions={reindexOptions}
          indexVersions={observabilityData.indexVersions}
          onReindexOptionsChange={(patch) => setReindexOptions((prev) => ({ ...prev, ...patch }))}
          onPatch={patchRag}
          onReindexMissing={() => void reindexMissing()}
          onEnqueueReindex={() => void enqueueReindex()}
          onRunOnce={() => void runOnce()}
          onLoadJobs={(filter) => void loadJobs(filter)}
          onRetryDocument={(documentId) => void retryFailedDocument(documentId)}
          onRetryAllFailed={() => void retryAllFailedJobs()}
          onBindVersionNavigate={handleBindVersionNavigate}
        />
      )}

      {activeTab === 'retrieve' && (
        <RetrieveTab
          ragConfig={ragConfig}
          status={status}
          agents={agents}
          hasActiveEmbedding={hasActiveEmbedding}
          synthesisConfigured={synthesisConfigured}
          activeEmbeddingId={activeEmbeddingId}
          activeRerankId={activeRerankId}
          embeddingServices={embeddingServices}
          rerankServices={rerankServices}
          testingServiceId={testingServiceId}
          onPatch={patchRag}
          onChangeEmbedding={setActiveEmbeddingId}
          onChangeRerank={setActiveRerankId}
          onTest={(id, label) => void testService(id, label)}
          onNavigate={setActiveTab}
        />
      )}

      {activeTab === 'diagnose' && (
        <DiagnoseTab
          sandboxQuery={sandboxQuery}
          observabilityData={observabilityData}
          observabilityLoading={observabilityLoading}
          observabilityBusy={observabilityBusy}
          advancedView={diagnoseAdvancedView}
          advancedOpen={diagnoseAdvancedOpen}
          onSandboxQueryChange={setSandboxQuery}
          onSelectTrace={selectTrace}
          onRefreshObservability={() => void loadObservability()}
          onCreateCandidate={async () => {
            try {
              setObservabilityBusy('create-candidate');
              const result = await createRagIndexVersion();
              const version = result?.version?.version || result?.version?.id;
              toastSuccess(version ? `已创建候选版本：${version}` : '已创建候选版本');
              await loadObservability();
            } catch (err: unknown) {
              toastError(err instanceof Error ? err.message : '创建候选版本失败');
            } finally {
              setObservabilityBusy(null);
            }
          }}
          onEvaluateVersion={async (version: RagIndexVersion, datasetId: string) => {
            try {
              setObservabilityBusy('evaluate');
              const result = await evaluateRagIndexVersion({
                indexVersion: version.version || version.id,
                datasetId
              });
              const passRate = result?.gate?.passRate ?? result?.version?.evalResult?.passRate;
              toastSuccess(formatPassRateToast(passRate));
              await loadObservability();
            } catch (err: unknown) {
              toastError(err instanceof Error ? err.message : '评估失败');
            } finally {
              setObservabilityBusy(null);
            }
          }}
          onActivateVersion={async (version: RagIndexVersion, force = false) => {
            try {
              setObservabilityBusy('activate');
              const result = await activateRagIndexVersion({
                indexVersion: version.version || version.id,
                force
              });
              if (result?.status === 'rejected') {
                toastError(result?.message || '激活被拒绝（质量门槛未通过）');
              } else {
                toastSuccess(result?.message || '索引版本已激活');
              }
              await loadAll();
            } catch (err: unknown) {
              toastError(err instanceof Error ? err.message : '激活失败');
            } finally {
              setObservabilityBusy(null);
            }
          }}
          onRollbackVersion={async () => {
            try {
              setObservabilityBusy('rollback');
              const result = await rollbackRagIndexVersion();
              if (result?.status === 'rejected') {
                toastError(result?.message || '没有可回滚的版本');
              } else {
                toastSuccess(result?.message || '已回滚索引版本');
              }
              await loadAll();
            } catch (err: unknown) {
              toastError(err instanceof Error ? err.message : '回滚失败');
            } finally {
              setObservabilityBusy(null);
            }
          }}
        />
      )}
    </div>
  );
};
