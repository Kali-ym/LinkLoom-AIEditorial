import { describe, expect, it, vi } from 'vitest';
import { HybridSearchService } from '../src/services/rag/HybridSearchService.js';
import type { SystemSettings } from '../src/types/config.js';

const FTS_ROWS = [
  { id: 'c1', content: 'PostgreSQL full text', docName: 'Doc A', documentId: 'd1' },
  { id: 'c2', content: 'Keyword match', docName: 'Doc B', documentId: 'd2' }
];

function createStore() {
  return {
    searchKBChunks: vi.fn(async () => FTS_ROWS),
    searchKBChunksByPgVector: vi.fn(async () => []),
    searchKBChunksByEmbedding: vi.fn(async () => []),
    getActiveRagIndexVersion: vi.fn(async () => null),
    getKBVectorCapability: vi.fn(async () => ({ available: false, reason: 'pgvector_unavailable' })),
    getRagEmbeddingCoverageStats: vi.fn(async () => ({
      totalChunkCount: 2,
      indexedChunkCount: 2,
      failedChunkCount: 0,
      pendingJobCount: 0,
      runningJobCount: 0,
      dimensionMismatchCount: 0,
      indexCoveragePercent: 100,
      jobStats: { pending: 0, running: 0, success: 2, skipped: 0, failed: 0 }
    }))
  } as any;
}

describe('HybridSearchService fallback', () => {
  it('returns pure FTS when hybrid disabled', async () => {
    const store = createStore();
    const settings: SystemSettings = {
      ACTIVE_AI_PROVIDER_ID: 'default-gemini',
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
      RAG_CONFIG: { hybridEnabled: false } as any
    };
    const svc = new HybridSearchService(store, () => settings);
    const result = await svc.searchKBChunks('postgres', { limit: 2 });
    expect(result.retrievalMode).toBe('fts');
    expect(result.rows).toHaveLength(2);
    expect(store.searchKBChunksByEmbedding).not.toHaveBeenCalled();
  });

  it('falls back to FTS when embedding service unavailable', async () => {
    const store = createStore();
    const settings: SystemSettings = {
      ACTIVE_AI_PROVIDER_ID: 'default-gemini',
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
      ACTIVE_EMBEDDING_SERVICE_ID: 'missing',
      SMALL_MODEL_SERVICES: [],
      RAG_CONFIG: { hybridEnabled: true, rerankEnabled: false, retrievalTopK: 20 } as any
    };
    const svc = new HybridSearchService(store, () => settings);
    const result = await svc.searchKBChunks('postgres', { limit: 2 });
    expect(result.retrievalMode).toBe('fts');
    expect(result.fallbackReason).toBe('embedding_service_unavailable');
  });

  it('skips rerank when rerank disabled and keeps hybrid mode', async () => {
    const store = createStore();
    store.searchKBChunksByEmbedding = vi.fn(async () => [
      { id: 'c2', content: 'vector hit', docName: 'Doc B', documentId: 'd2' }
    ]);
    const settings: SystemSettings = {
      ACTIVE_AI_PROVIDER_ID: 'default-gemini',
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
      ACTIVE_EMBEDDING_SERVICE_ID: 'embed-1',
      SMALL_MODEL_SERVICES: [
        {
          id: 'embed-1',
          name: 'Mock Embed',
          role: 'EMBEDDING',
          backend: 'OPENAI_COMPAT',
          apiUrl: 'http://127.0.0.1:9',
          model: 'mock',
          enabled: true,
          useProxy: false
        }
      ],
      RAG_CONFIG: {
        hybridEnabled: true,
        rerankEnabled: false,
        ftsWeight: 0.5,
        vectorWeight: 0.5,
        retrievalTopK: 20
      } as any
    };

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ data: [{ embedding: [1, 0, 0.2] }] })
      }))
    );

    const svc = new HybridSearchService(store, () => settings);
    const result = await svc.searchKBChunks('vector', { limit: 2 });
    expect(result.retrievalMode).toBe('hybrid');
    expect(result.rows.length).toBeGreaterThan(0);
    vi.unstubAllGlobals();
  });
});
