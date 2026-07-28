import { describe, expect, it, vi } from 'vitest';
import { BusinessWorkflowPipelineService } from '../src/services/agents/BusinessWorkflowPipelineService.js';
import { RagRouteService } from '../src/services/rag/RagRouteService.js';

function createBusinessStore() {
  return {
    get: vi.fn(async (key: string) =>
      key === 'system_settings' ? { ACTIVE_AI_PROVIDER_ID: 'test-provider' } : undefined
    ),
    getAgent: vi.fn(async () => null),
    saveAgent: vi.fn(async () => undefined),
    saveWorkflow: vi.fn(async () => undefined),
    saveSchedule: vi.fn(async () => undefined),
    getWorkflow: vi.fn(async () => null),
    getSchedule: vi.fn(async () => null),
    listSchedules: vi.fn(async () => [])
  } as any;
}

function createContext() {
  return {
    schedulerService: {
      startSchedule: vi.fn(),
      runNow: vi.fn()
    }
  } as any;
}

describe('business capability isolation', () => {
  it('does not deploy unverified business workflows or schedules during setup', async () => {
    const store = createBusinessStore();
    const context = createContext();
    const service = new BusinessWorkflowPipelineService(store, context);

    const result = await service.setup({ enableSchedules: true });

    expect(result.status).toBe('disabled');
    expect(result.message).toContain('业务工作流默认部署仍关闭');
    expect(store.saveWorkflow).not.toHaveBeenCalled();
    expect(store.saveSchedule).not.toHaveBeenCalled();
    expect(context.schedulerService.startSchedule).not.toHaveBeenCalled();
    expect(store.saveAgent).toHaveBeenCalled();
  });

  it('reports business pipelines as rebuild-required rather than ready', async () => {
    const service = new BusinessWorkflowPipelineService(createBusinessStore(), createContext());

    const status = await service.getStatus();

    expect(status.rebuildRequired).toBe(true);
    expect(status.pipelines.length).toBeGreaterThan(0);
    expect(status.pipelines.every((pipeline) => pipeline.ready === false)).toBe(true);
    expect(status.pipelines.every((pipeline) => pipeline.defaultRouteEnabled === false)).toBe(true);
    expect(status.pipelines.every((pipeline) => pipeline.scheduleEnabled === false)).toBe(true);
    expect(status.explicitEntryReady.length).toBeGreaterThan(0);
    expect(
      status.pipelines.every((pipeline) =>
        pipeline.explicitEntryReady
          ? pipeline.status === 'explicit_entry_ready'
          : pipeline.status === 'rebuild_required'
      )
    ).toBe(true);
  });

  it('keeps RAG reindex disabled while embedding service is unavailable', async () => {
    const store = {
      get: vi.fn(async (key: string) =>
        key === 'system_settings'
          ? {
              ACTIVE_AI_PROVIDER_ID: 'test-provider',
              AI_PROVIDERS: [],
              PUBLISHERS: [],
              STORAGES: [],
              AUTH_EXPIRE_TIME: '7d',
              API_PROXY: '',
              IMAGE_PROXY: '',
              ADAPTERS: [],
              CATEGORIES: [],
              SELECTION_FETCH_DAYS: 2,
              SELECTION_QUERY_FIELD: 'published_date',
              RAG_CONFIG: { hybridEnabled: true, embedOnIngest: true }
            }
          : undefined
      ),
      getKBVectorCapability: vi.fn(async () => ({
        available: true,
        dimensions: 768
      })),
      getRagEmbeddingCoverageStats: vi.fn(async () => ({
        totalChunkCount: 1,
        indexedChunkCount: 0,
        indexCoveragePercent: 0,
        pendingJobCount: 0,
        runningJobCount: 0,
        failedJobCount: 0,
        lastIndexedAt: undefined,
        lastEmbeddingError: undefined,
        actualDimensions: undefined,
        jobStats: {
          pending: 0,
          running: 0,
          success: 0,
          skipped: 0,
          failed: 0
        }
      })),
      getAgent: vi.fn(async () => null),
      updateKBChunkEmbedding: vi.fn(async () => undefined)
    } as any;
    const service = new RagRouteService(store, createContext());

    const status = await service.getStatus();
    const reindex = await service.reindexEmbeddings({ limit: 10 });

    expect(status.runtimeMode).toBe('degraded');
    expect(status.rebuildRequired).toBe(false);
    expect(status.fallbackReason).toBe('embedding_service_unavailable');
    expect(reindex.status).toBe('disabled');
    expect(store.updateKBChunkEmbedding).not.toHaveBeenCalled();
  });
});