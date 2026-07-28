import { describe, expect, it, vi } from 'vitest';
import { RagEmbeddingJobRunner } from '../src/services/rag/RagEmbeddingJobRunner.js';
import type { SystemSettings } from '../src/types/config.js';

const embeddingService = {
  id: 'embed-1',
  name: 'Embedding',
  role: 'EMBEDDING',
  backend: 'OPENAI_COMPAT',
  apiUrl: 'http://127.0.0.1:9',
  model: 'mock-embedding',
  dimensions: 3,
  enabled: true,
  useProxy: false
} as const;

function settings(overrides: Partial<SystemSettings> = {}): SystemSettings {
  return {
    ACTIVE_AI_PROVIDER_ID: 'default-gemini',
    ACTIVE_EMBEDDING_SERVICE_ID: 'embed-1',
    AI_PROVIDERS: [],
    SMALL_MODEL_SERVICES: [embeddingService as any],
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
      embeddingBatchSize: 5,
      embeddingMaxAttempts: 2
    } as any,
    ...overrides
  } as SystemSettings;
}

function createJob(overrides: Record<string, any> = {}) {
  return {
    id: 'job-1',
    chunkId: 'chunk-1',
    documentId: 'doc-1',
    contentHash: 'hash-1',
    targetStorage: 'dual',
    status: 'running',
    attempts: 1,
    createdAt: 1,
    updatedAt: 1,
    content: 'chunk content',
    ...overrides
  };
}

function createStore(overrides: Record<string, any> = {}) {
  return {
    resetStaleRagEmbeddingJobs: vi.fn(async () => 0),
    claimRagEmbeddingJobs: vi.fn(async () => [createJob()]),
    getKBVectorCapability: vi.fn(async () => ({ available: true, dimensions: 3 })),
    getRagIndexVersion: vi.fn(async () => null),
    updateKBChunkEmbeddingDual: vi.fn(async () => undefined),
    completeRagEmbeddingJob: vi.fn(async () => undefined),
    skipRagEmbeddingJob: vi.fn(async () => undefined),
    failRagEmbeddingJob: vi.fn(async () => undefined),
    markKBChunkEmbeddingError: vi.fn(async () => undefined),
    ...overrides
  } as any;
}

describe('RagEmbeddingJobRunner', () => {
  it('claims a small batch and writes JSONB plus pgvector on success', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: [{ embedding: [1, 0, 0] }] })
    })));
    const store = createStore();
    const runner = new RagEmbeddingJobRunner(store, () => settings());

    try {
      const result = await runner.runOnce({ limit: 10 });

      expect(store.claimRagEmbeddingJobs).toHaveBeenCalledWith(10, 2);
      expect(store.updateKBChunkEmbeddingDual).toHaveBeenCalledWith('chunk-1', [1, 0, 0], expect.objectContaining({
        writeJsonb: true,
        writePgvector: true,
        model: 'mock-embedding',
        dimensions: 3,
        contentHash: 'hash-1'
      }));
      expect(store.completeRagEmbeddingJob).toHaveBeenCalledWith('job-1');
      expect(result).toMatchObject({ status: 'success', claimed: 1, succeeded: 1, skipped: 0, failed: 0 });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('writes index version metadata from the lifecycle record when available', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: [{ embedding: [1, 0, 0] }] })
    })));
    const store = createStore({
      claimRagEmbeddingJobs: vi.fn(async () => [createJob({ indexVersion: 'idx-1' })]),
      getRagIndexVersion: vi.fn(async () => ({
        id: 'idx-1',
        sourceType: 'knowledge',
        sourceId: 'knowledge',
        version: 'knowledge:active:v1',
        status: 'building',
        chunkerVersion: 'semantic:3000:300',
        embeddingConfigHash: 'embed-hash',
        embeddingProviderId: 'embed-1',
        createdAt: 1,
        updatedAt: 2
      }))
    });
    const runner = new RagEmbeddingJobRunner(store, () => settings());

    try {
      await runner.runOnce({ limit: 1 });

      expect(store.updateKBChunkEmbeddingDual).toHaveBeenCalledWith('chunk-1', [1, 0, 0], expect.objectContaining({
        indexVersion: 'knowledge:active:v1',
        embeddingConfigHash: 'embed-hash',
        chunkerVersion: 'semantic:3000:300',
        embeddingProviderId: 'embed-1'
      }));
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('marks dimension mismatch without polluting embeddings', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: [{ embedding: [1, 0] }] })
    })));
    const store = createStore();
    const runner = new RagEmbeddingJobRunner(store, () => settings());

    try {
      const result = await runner.runOnce({ limit: 1 });

      expect(store.markKBChunkEmbeddingError).toHaveBeenCalledWith('chunk-1', 'dimension_mismatch');
      expect(store.skipRagEmbeddingJob).toHaveBeenCalledWith('job-1', 'dimension_mismatch');
      expect(store.updateKBChunkEmbeddingDual).not.toHaveBeenCalled();
      expect(result).toMatchObject({ status: 'success', claimed: 1, succeeded: 0, skipped: 1, failed: 0 });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('records retryable failures through job state', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      text: async () => 'bad gateway'
    })));
    const store = createStore();
    const runner = new RagEmbeddingJobRunner(store, () => settings());

    try {
      const result = await runner.runOnce({ limit: 1 });

      expect(store.failRagEmbeddingJob).toHaveBeenCalledWith(
        'job-1',
        expect.stringContaining('Embedding API failed'),
        2
      );
      expect(result).toMatchObject({ status: 'partial', claimed: 1, succeeded: 0, skipped: 0, failed: 1 });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('skips jobs bound to failed index versions before embedding call', async () => {
    const fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: [{ embedding: [1, 0, 0] }] })
    }));
    vi.stubGlobal('fetch', fetch);
    const store = createStore({
      claimRagEmbeddingJobs: vi.fn(async () => [createJob({ indexVersion: 'idx-failed' })]),
      getRagIndexVersion: vi.fn(async () => ({
        id: 'idx-failed',
        sourceType: 'knowledge',
        sourceId: 'knowledge',
        version: 'knowledge:failed',
        status: 'failed',
        createdAt: 1,
        updatedAt: 2
      }))
    });
    const runner = new RagEmbeddingJobRunner(store, () => settings());

    try {
      const result = await runner.runOnce({ limit: 1 });

      expect(fetch).not.toHaveBeenCalled();
      expect(store.skipRagEmbeddingJob).toHaveBeenCalledWith('job-1', 'index_version_failed');
      expect(store.updateKBChunkEmbeddingDual).not.toHaveBeenCalled();
      expect(result).toMatchObject({ status: 'success', claimed: 1, succeeded: 0, skipped: 1, failed: 0 });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('does not claim jobs when embedding service is not configured', async () => {
    const store = createStore();
    const runner = new RagEmbeddingJobRunner(store, () => settings({
      ACTIVE_EMBEDDING_SERVICE_ID: 'missing',
      SMALL_MODEL_SERVICES: []
    }));

    const result = await runner.runOnce({ limit: 1 });

    expect(store.claimRagEmbeddingJobs).not.toHaveBeenCalled();
    expect(result).toMatchObject({ status: 'disabled', claimed: 0 });
  });
});