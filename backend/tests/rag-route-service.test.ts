import { describe, expect, it, vi } from 'vitest';
import { RagRouteService } from '../src/services/rag/RagRouteService.js';
import { compareEvalRuns, summarizeEvalScores } from '../src/services/rag/RagEvalService.js';
import type { SystemSettings } from '../src/types/config.js';

function settings(overrides: Partial<SystemSettings> = {}): SystemSettings {
  return {
    ACTIVE_AI_PROVIDER_ID: 'default-gemini',
    ACTIVE_EMBEDDING_SERVICE_ID: 'embed-1',
    ACTIVE_RERANK_SERVICE_ID: '',
    AI_PROVIDERS: [],
    SMALL_MODEL_SERVICES: [{
      id: 'embed-1',
      name: 'Embedding',
      role: 'EMBEDDING',
      backend: 'OPENAI_COMPAT',
      apiUrl: 'http://127.0.0.1:9',
      model: 'mock-embedding',
      dimensions: 1024,
      enabled: true,
      useProxy: false
    }],
    PUBLISHERS: [],
    STORAGES: [],
    AUTH_EXPIRE_TIME: '7d',
    API_PROXY: '',
    IMAGE_PROXY: '',
    ADAPTERS: [],
    CATEGORIES: [],
    SELECTION_FETCH_DAYS: 2,
    SELECTION_QUERY_FIELD: 'published_date',
    RAG_CONFIG: {
      hybridEnabled: true,
      minVectorCoverageForHybrid: 0.8,
      rerankEnabled: false
    } as any,
    ...overrides
  } as SystemSettings;
}

function createStore(storedSettings: SystemSettings, overrides: Record<string, any> = {}) {
  return {
    get: vi.fn(async (key: string) => key === 'system_settings' ? storedSettings : undefined),
    getKBVectorCapability: vi.fn(async () => ({ available: true, dimensions: 1024 })),
    getRagEmbeddingCoverageStats: vi.fn(async () => ({
      totalChunkCount: 10,
      indexedChunkCount: 10,
      failedChunkCount: 0,
      pendingJobCount: 0,
      runningJobCount: 0,
      dimensionMismatchCount: 0,
      indexCoveragePercent: 100,
      actualDimensions: 1024,
      jobStats: { pending: 0, running: 0, success: 10, skipped: 0, failed: 0 }
    })),
    listKBChunksForEmbedding: vi.fn(async () => [
      { id: 'chunk-1', documentId: 'doc-1', content: 'chunk one', contentHash: 'hash-1', embeddingJson: null },
      { id: 'chunk-2', documentId: 'doc-1', content: 'chunk two', contentHash: 'hash-2', embeddingJson: [0] }
    ]),
    upsertRagEmbeddingJob: vi.fn(async (job) => ({ id: job.id, queued: true })),
    listRagEmbeddingJobs: vi.fn(async () => []),
    listRagIndexVersions: vi.fn(async () => []),
    getActiveRagIndexVersion: vi.fn(async () => null),
    getRagIndexVersion: vi.fn(async () => null),
    markRagIndexVersionBuilding: vi.fn(async () => null),
    upsertRagIndexVersion: vi.fn(async () => undefined),
    attachEvalToRagIndexVersion: vi.fn(async () => null),
    listRagEvalRuns: vi.fn(async () => []),
    activateRagIndexVersion: vi.fn(async () => null),
    rollbackRagIndexVersion: vi.fn(async () => null),
    ...overrides
  } as any;
}

describe('RagRouteService contract', () => {
  it('returns productized runtime status instead of legacy rebuild flags', async () => {
    const store = createStore(settings());
    const service = new RagRouteService(store, {} as any);

    const status = await service.getStatus();

    expect(status.productized).toBe(true);
    expect(status.rebuildRequired).toBe(false);
    expect(status.rebuildStatus).toBe('productized');
    expect(status.runtimeMode).toBe('hybrid');
    expect(status.readiness).toBe('hybrid_ready');
    expect(status.vectorStorageMode).toBe('pgvector_active');
    expect(status.coverage.indexCoveragePercent).toBe(100);
    expect(status.dimensions).toEqual({ configured: 1024, actual: 1024, database: 1024 });
    expect(status.outputContract.fields).toEqual(['answer', 'meta', 'sources']);
  });

  it('surfaces rebuild_required when configured and database dimensions diverge', async () => {
    const store = createStore(settings(), {
      getKBVectorCapability: vi.fn(async () => ({ available: true, dimensions: 768 }))
    });
    const service = new RagRouteService(store, {} as any);

    const status = await service.getStatus();

    expect(status.runtimeMode).toBe('degraded');
    expect(status.readiness).toBe('rebuild_required');
    expect(status.rebuildRequired).toBe(true);
    expect(status.fallbackReason).toBe('dimension_mismatch');
  });

  it('validates reindex input without queueing invalid requests', async () => {
    const store = createStore(settings());
    const service = new RagRouteService(store, {} as any);

    const result = await service.reindexEmbeddings({ documentIds: 'doc-1', dryRun: 'yes' });

    expect(result.status).toBe('invalid_input');
    expect(result.issues?.map((issue) => issue.path)).toEqual(['$.documentIds', '$.dryRun']);
    expect(store.listKBChunksForEmbedding).not.toHaveBeenCalled();
    expect(store.upsertRagEmbeddingJob).not.toHaveBeenCalled();
  });

  it('supports reindex dryRun and documentIds without creating jobs', async () => {
    const store = createStore(settings());
    const service = new RagRouteService(store, {} as any);

    const result = await service.reindexEmbeddings({ documentIds: ['doc-1'], dryRun: true, onlyMissing: true });

    expect(result.status).toBe('success');
    expect(result.dryRun).toBe(true);
    expect(result.documentsScanned).toBe(1);
    expect(result.chunksScanned).toBe(2);
    expect(result.alreadyIndexed).toBe(1);
    expect(result.queued).toBe(0);
    expect(store.listKBChunksForEmbedding).toHaveBeenCalledWith(expect.objectContaining({
      documentIds: ['doc-1'],
      onlyMissing: true
    }));
    expect(store.upsertRagEmbeddingJob).not.toHaveBeenCalled();
  });

  it('binds reindex jobs to the candidate index version string', async () => {
    const candidate = {
      id: 'idx-1',
      sourceType: 'knowledge',
      sourceId: 'knowledge',
      version: 'knowledge:knowledge:chunker:embed',
      status: 'candidate',
      createdAt: 1,
      updatedAt: 1
    };
    const store = createStore(settings(), {
      getRagIndexVersion: vi.fn(async () => candidate),
      markRagIndexVersionBuilding: vi.fn(async () => ({ ...candidate, status: 'building' }))
    });
    const service = new RagRouteService(store, {} as any);

    const result = await service.reindexEmbeddings({ indexVersion: 'idx-1', documentIds: ['doc-1'] });

    expect(result.status).toBe('queued');
    expect(store.markRagIndexVersionBuilding).toHaveBeenCalledWith('idx-1');
    expect(store.listKBChunksForEmbedding).toHaveBeenCalledWith(expect.objectContaining({
      documentIds: ['doc-1'],
      indexVersion: 'knowledge:knowledge:chunker:embed'
    }));
    expect(store.upsertRagEmbeddingJob).toHaveBeenCalledWith(expect.objectContaining({
      indexVersion: 'knowledge:knowledge:chunker:embed'
    }));
  });

  it('rejects reindex when index version is missing or no longer buildable', async () => {
    const failedVersion = {
      id: 'idx-failed',
      sourceType: 'knowledge',
      sourceId: 'knowledge',
      version: 'knowledge:knowledge:chunker:failed',
      status: 'failed',
      createdAt: 1,
      updatedAt: 1
    };
    const missingStore = createStore(settings());
    const missingService = new RagRouteService(missingStore, {} as any);

    const missingResult = await missingService.reindexEmbeddings({ indexVersion: 'missing', documentIds: ['doc-1'] });

    expect(missingResult.status).toBe('invalid_input');
    expect(missingResult.issues?.[0]?.path).toBe('$.indexVersion');
    expect(missingStore.listKBChunksForEmbedding).not.toHaveBeenCalled();

    const failedStore = createStore(settings(), {
      getRagIndexVersion: vi.fn(async () => failedVersion)
    });
    const failedService = new RagRouteService(failedStore, {} as any);

    const failedResult = await failedService.reindexEmbeddings({ indexVersion: 'idx-failed', documentIds: ['doc-1'] });

    expect(failedResult.status).toBe('invalid_input');
    expect(failedResult.issues?.[0]?.value).toBe('failed');
    expect(failedStore.listKBChunksForEmbedding).not.toHaveBeenCalled();
  });

  it('creates candidate index versions with chunker and embedding config metadata', async () => {
    const store = createStore(settings());
    const service = new RagRouteService(store, {} as any);

    const result = await service.createIndexVersion({ metadata: { requestedBy: 'test' } });

    expect(result.version.status).toBe('candidate');
    expect(result.version.sourceType).toBe('knowledge');
    expect(result.version.version).toContain('knowledge:knowledge:');
    expect(result.version.chunkerVersion).toContain('structure');
    expect(result.version.embeddingProviderId).toBe('embed-1');
    expect(result.version.embeddingConfigHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.version.metadata).toMatchObject({
      lifecycle: 'candidate',
      requestedBy: 'test',
      embeddingConfig: {
        providerId: 'embed-1',
        model: 'mock-embedding',
        dimensions: 1024
      }
    });
    expect(store.upsertRagIndexVersion).toHaveBeenCalledWith(result.version);
  });

  it('rejects activation without eval unless force is explicit', async () => {
    const candidate = {
      id: 'idx-1',
      sourceType: 'knowledge',
      sourceId: 'knowledge',
      version: 'knowledge:knowledge:chunker:embed',
      status: 'evaluated',
      evalResult: { passed: true, passRate: 1 },
      createdAt: 1,
      updatedAt: 1
    };
    const store = createStore(settings(), {
      getRagIndexVersion: vi.fn(async () => candidate),
      listRagEvalRuns: vi.fn(async () => []),
      activateRagIndexVersion: vi.fn(async () => ({ version: { ...candidate, status: 'active' } }))
    });
    const service = new RagRouteService(store, {} as any);

    const rejected = await service.activateIndexVersion({ indexVersion: 'idx-1' });

    expect(rejected.status).toBe('rejected');
    expect(rejected.gate).toMatchObject({ passed: false, reason: 'missing_eval_run' });
    expect(store.activateRagIndexVersion).not.toHaveBeenCalled();

    const forced = await service.activateIndexVersion({ indexVersion: 'idx-1', force: true });

    expect(forced.status).toBe('active');
    expect(forced.gate).toMatchObject({ passed: false, force: true });
    expect(store.activateRagIndexVersion).toHaveBeenCalledWith('idx-1', expect.objectContaining({
      activationReason: 'forced_without_passing_gate',
      force: true,
      gatePassed: false
    }));
  });

  it('summarizes eval metrics and produces baseline candidate diff', () => {
    const baseline = {
      id: 'run-baseline',
      datasetId: 'dataset-1',
      indexVersion: 'knowledge:baseline',
      scores: [
        { caseId: 'case-1', recallAtK: 1, precisionAtK: 0.5, mrr: 1, hitRate: 1, citationAccuracy: 1, passed: true },
        { caseId: 'case-2', recallAtK: 1, precisionAtK: 0.5, mrr: 1, hitRate: 1, citationAccuracy: 1, passed: true }
      ],
      summary: {},
      createdAt: 1
    };
    const candidate = {
      id: 'run-candidate',
      datasetId: 'dataset-1',
      indexVersion: 'knowledge:candidate',
      scores: [
        { caseId: 'case-1', recallAtK: 1, precisionAtK: 1, mrr: 1, hitRate: 1, citationAccuracy: 1, passed: true },
        { caseId: 'case-2', recallAtK: 0, precisionAtK: 0, mrr: 0, hitRate: 0, citationAccuracy: 0, passed: false }
      ],
      summary: {},
      createdAt: 2
    };

    expect(summarizeEvalScores(candidate.scores)).toMatchObject({
      total: 2,
      passed: 1,
      passRate: 0.5,
      recallAtK: 0.5,
      precisionAtK: 0.5,
      mrr: 0.5,
      hitRate: 0.5,
      citationAccuracy: 0.5
    });

    const comparison = compareEvalRuns({
      datasetId: 'dataset-1',
      baselineRun: baseline,
      candidateRun: candidate,
      threshold: 0.8,
      maxRegressionRate: 0
    });

    expect(comparison.metrics.delta).toMatchObject({ passRate: -0.5, recallAtK: -0.5, mrr: -0.5 });
    expect(comparison.cases.map((item) => [item.caseId, item.status])).toEqual([
      ['case-1', 'improved'],
      ['case-2', 'regressed']
    ]);
    expect(comparison.gate).toMatchObject({
      passed: false,
      reason: 'pass_rate_below_threshold',
      passRate: 0.5,
      baselinePassRate: 1,
      regressionRate: 0.5
    });
  });

  it('rejects activation when candidate regresses against baseline', async () => {
    const candidate = {
      id: 'idx-1',
      sourceType: 'knowledge',
      sourceId: 'knowledge',
      version: 'knowledge:candidate',
      status: 'evaluated',
      evalResult: {
        passed: true,
        passRate: 1,
        runId: 'run-candidate',
        comparison: { baselineRunId: 'run-baseline' }
      },
      createdAt: 1,
      updatedAt: 1
    };
    const baselineRun = {
      id: 'run-baseline',
      datasetId: 'dataset-1',
      indexVersion: 'knowledge:baseline',
      scores: [
        { caseId: 'case-1', passed: true, recallAtK: 1, hitRate: 1 },
        { caseId: 'case-2', passed: true, recallAtK: 1, hitRate: 1 }
      ],
      summary: { total: 2, passed: 2, passRate: 1, recallAtK: 1, hitRate: 1 },
      createdAt: 1
    };
    const candidateRun = {
      id: 'run-candidate',
      datasetId: 'dataset-1',
      indexVersion: 'knowledge:candidate',
      scores: [
        { caseId: 'case-1', passed: true, recallAtK: 1, hitRate: 1 },
        { caseId: 'case-2', passed: false, recallAtK: 0, hitRate: 0 }
      ],
      summary: { total: 2, passed: 1, passRate: 0.5, recallAtK: 0.5, hitRate: 0.5 },
      createdAt: 2
    };
    const store = createStore(settings(), {
      getRagIndexVersion: vi.fn(async () => candidate),
      listRagEvalRuns: vi.fn(async (_datasetId?: string, options?: { indexVersion?: string }) => {
        if (options?.indexVersion === 'knowledge:candidate') return [candidateRun];
        return [candidateRun, baselineRun];
      }),
      activateRagIndexVersion: vi.fn(async () => ({ version: { ...candidate, status: 'active' } }))
    });
    const service = new RagRouteService(store, {} as any);

    const result = await service.activateIndexVersion({
      indexVersion: 'idx-1',
      threshold: 0.5,
      maxRegressionRate: 0
    });

    expect(result.status).toBe('rejected');
    expect(result.comparison?.gate).toMatchObject({
      passed: false,
      reason: 'regression_rate_exceeded',
      passRate: 0.5,
      regressionRate: 0.5
    });
    expect(result.gate).toMatchObject({ passed: false, reason: 'regression_rate_exceeded' });
    expect(store.activateRagIndexVersion).not.toHaveBeenCalled();
  });

  it('activates versions only when latest eval run passes the gate', async () => {
    const candidate = {
      id: 'idx-1',
      sourceType: 'knowledge',
      sourceId: 'knowledge',
      version: 'knowledge:knowledge:chunker:embed',
      status: 'evaluated',
      evalResult: { passed: true, passRate: 1, runId: 'run-1' },
      createdAt: 1,
      updatedAt: 1
    };
    const run = {
      id: 'run-1',
      datasetId: 'dataset-1',
      indexVersion: candidate.version,
      scores: [{ caseId: 'case-1', passed: true }],
      summary: { total: 1, passed: 1, passRate: 1 },
      createdAt: 2
    };
    const store = createStore(settings(), {
      getRagIndexVersion: vi.fn(async () => candidate),
      listRagEvalRuns: vi.fn(async () => [run]),
      activateRagIndexVersion: vi.fn(async () => ({
        version: { ...candidate, status: 'active', activatedAt: 3 },
        previousActiveVersion: { id: 'idx-old', version: 'old', status: 'active' }
      }))
    });
    const service = new RagRouteService(store, {} as any);

    const result = await service.activateIndexVersion({ indexVersion: 'idx-1', threshold: 0.9 });

    expect(result.status).toBe('active');
    expect(result.gate).toMatchObject({ passed: true, passRate: 1, threshold: 0.9 });
    expect(result.previousActiveVersion?.id).toBe('idx-old');
    expect(store.activateRagIndexVersion).toHaveBeenCalledWith('idx-1', expect.objectContaining({
      activationReason: 'eval_gate_passed',
      evalRunId: 'run-1',
      gatePassRate: 1,
      gateThreshold: 0.9
    }));
  });

  it('lists index versions with active candidates and history buckets', async () => {
    const versions = [
      { id: 'idx-active', status: 'active' },
      { id: 'idx-candidate', status: 'candidate' },
      { id: 'idx-building', status: 'building' },
      { id: 'idx-evaluated', status: 'evaluated' },
      { id: 'idx-rolled', status: 'rolled_back' }
    ];
    const active = { id: 'idx-active', status: 'active' };
    const store = createStore(settings(), {
      listRagIndexVersions: vi.fn(async () => versions),
      getActiveRagIndexVersion: vi.fn(async () => active)
    });
    const service = new RagRouteService(store, {} as any);

    const result = await service.listIndexVersions({ sourceType: 'knowledge', sourceId: 'knowledge' });

    expect(result.active).toBe(active);
    expect(result.candidates.map((item: any) => item.id)).toEqual(['idx-candidate', 'idx-building']);
    expect(result.history.map((item: any) => item.id)).toEqual(['idx-evaluated', 'idx-rolled']);
  });

  it('lists observability traces index versions and eval runs for the RAG ops panel', async () => {
    const trace = {
      traceId: 'trace-1',
      originalQuery: 'RAG 基线',
      rewrittenQueries: ['RAG 基线'],
      filters: [],
      retrievedUnitIds: ['chunk-1'],
      rerankedUnitIds: ['chunk-1'],
      selectedEvidenceIds: ['knowledge:chunk-1'],
      citationIds: ['[K1]'],
      sourceTypeBreakdown: { knowledge: 1 },
      metadata: {
        traceStages: [{ name: 'context_build', status: 'success', durationMs: 3 }]
      }
    };
    const versions = [
      { id: 'idx-active', status: 'active' },
      { id: 'idx-candidate', status: 'candidate' },
      { id: 'idx-evaluated', status: 'evaluated' }
    ];
    const active = versions[0];
    const run = {
      id: 'run-1',
      datasetId: 'dataset-1',
      scores: [{ caseId: 'case-1', passed: true }],
      summary: { total: 1, passed: 1, passRate: 1 },
      createdAt: 2
    };
    const store = createStore(settings(), {
      listRagQueryTraces: vi.fn(async () => [trace]),
      getRagQueryTrace: vi.fn(async () => trace),
      listRagIndexVersions: vi.fn(async () => versions),
      getActiveRagIndexVersion: vi.fn(async () => active),
      listRagEvalRuns: vi.fn(async () => [run])
    });
    const service = new RagRouteService(store, {} as any);

    const traces = await service.listTraces({ limit: '5' });
    const traceDetail = await service.getTrace({ traceId: 'trace-1' });
    const indexVersions = await service.listIndexVersions({ limit: '5' });
    const evalRuns = await service.listEvalRuns({ limit: '5' });

    expect(store.listRagQueryTraces).toHaveBeenCalledWith({ limit: 5 });
    expect(store.getRagQueryTrace).toHaveBeenCalledWith('trace-1');
    expect(traces.traces).toEqual([trace]);
    expect(traceDetail.trace?.metadata?.traceStages).toEqual(trace.metadata.traceStages);
    expect(indexVersions).toMatchObject({
      active,
      candidates: [{ id: 'idx-candidate', status: 'candidate' }],
      history: [{ id: 'idx-evaluated', status: 'evaluated' }]
    });
    expect(evalRuns.runs).toEqual([run]);
  });

  it('lists embedding jobs with normalized status and limit', async () => {
    const store = createStore(settings(), {
      listRagEmbeddingJobs: vi.fn(async () => [{
        id: 'job-1',
        chunkId: 'chunk-1',
        documentId: 'doc-1',
        sourceType: 'knowledge',
        sourceId: 'knowledge',
        unitId: 'chunk-1',
        parentId: 'doc-1',
        indexVersion: 'structure:3000',
        contentHash: 'hash-1',
        targetStorage: 'dual',
        status: 'failed',
        attempts: 2,
        lastError: 'dimension_mismatch',
        lockedAt: 10,
        createdAt: 1,
        updatedAt: 2
      }])
    });
    const service = new RagRouteService(store, {} as any);

    const result = await service.listEmbeddingJobs({ status: 'failed', limit: '5' });

    expect(store.listRagEmbeddingJobs).toHaveBeenCalledWith({ status: 'failed', limit: 5 });
    expect(result.jobs).toEqual([{ 
      id: 'job-1',
      chunkId: 'chunk-1',
      documentId: 'doc-1',
      sourceType: 'knowledge',
      sourceId: 'knowledge',
      unitId: 'chunk-1',
      parentId: 'doc-1',
      indexVersion: 'structure:3000',
      contentHash: 'hash-1',
      targetStorage: 'dual',
      status: 'failed',
      attempts: 2,
      lastError: 'dimension_mismatch',
      lockedAt: 10,
      createdAt: 1,
      updatedAt: 2
    }]);
  });
});