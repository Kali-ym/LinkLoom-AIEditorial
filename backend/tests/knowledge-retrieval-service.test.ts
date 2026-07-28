import { describe, expect, it, vi } from 'vitest';
import { HybridSearchService } from '../src/services/rag/HybridSearchService.js';
import { KnowledgeRetrievalService } from '../src/services/rag/KnowledgeRetrievalService.js';
import { RagRetrievalPipeline } from '../src/services/rag/RagRetrievalPipeline.js';
import { KnowledgeRetrievalSource } from '../src/services/rag/sources/KnowledgeRetrievalSource.js';
import type { SystemSettings } from '../src/types/config.js';
import type { RagRetrievalUnit } from '../src/types/rag.js';

const FTS_ROWS = [
  { id: 'fts-1', content: 'PostgreSQL FTS baseline', docName: 'Doc A', documentId: 'doc-a', categoryId: 'cat-a' },
  { id: 'fts-2', content: 'keyword match', docName: 'Doc B', documentId: 'doc-b', categoryId: 'cat-b' }
];

const VECTOR_ROWS = [
  { id: 'vec-1', content: 'vector match', docName: 'Doc C', documentId: 'doc-c', categoryId: 'cat-c' }
];

function settings(overrides: Partial<SystemSettings> = {}): SystemSettings {
  return {
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
    ...overrides
  } as SystemSettings;
}

function createStore(overrides: Record<string, any> = {}) {
  return {
    searchKBChunks: vi.fn(async () => FTS_ROWS),
    searchKBChunksByPgVector: vi.fn(async () => VECTOR_ROWS),
    searchKBChunksByEmbedding: vi.fn(async () => VECTOR_ROWS),
    getKBVectorCapability: vi.fn(async () => ({ available: true, dimensions: 3 })),
    getActiveRagIndexVersion: vi.fn(async () => null),
    getRagEmbeddingCoverageStats: vi.fn(async () => ({
      totalChunkCount: 2,
      indexedChunkCount: 2,
      failedChunkCount: 0,
      pendingJobCount: 0,
      runningJobCount: 0,
      dimensionMismatchCount: 0,
      indexCoveragePercent: 100,
      jobStats: { pending: 0, running: 0, success: 2, skipped: 0, failed: 0 }
    })),
    ...overrides
  } as any;
}

describe('KnowledgeRetrievalService', () => {
  it('keeps the FTS baseline and forwards documentIds when hybrid is disabled', async () => {
    const store = createStore();
    const svc = new KnowledgeRetrievalService(store, () => settings({
      RAG_CONFIG: { hybridEnabled: false } as any
    }));

    const result = await svc.search('postgres', {
      categoryIds: ['cat-a'],
      documentIds: ['doc-a'],
      limit: 1
    });

    expect(result.retrievalMode).toBe('fts');
    expect(result.rows).toEqual([FTS_ROWS[0]]);
    expect(result.units[0]).toMatchObject({
      unitId: 'fts-1',
      sourceType: 'knowledge',
      parentId: 'doc-a'
    });
    expect(result.evidence[0]).toMatchObject({
      evidenceId: 'knowledge:fts-1',
      sourceType: 'knowledge',
      unitId: 'fts-1'
    });
    expect(result.trace.retrievedUnitIds).toEqual(['fts-1']);
    expect(store.searchKBChunks).toHaveBeenCalledWith('postgres', expect.objectContaining({
      categoryIds: ['cat-a'],
      documentIds: ['doc-a']
    }));
    expect(store.searchKBChunksByPgVector).not.toHaveBeenCalled();
    expect(store.searchKBChunksByEmbedding).not.toHaveBeenCalled();
  });

  it('injects active index version into retrieval filters by default', async () => {
    const store = createStore({
      getActiveRagIndexVersion: vi.fn(async () => ({
        id: 'idx-1',
        sourceType: 'knowledge',
        sourceId: 'knowledge',
        version: 'knowledge:active:v1',
        status: 'active',
        createdAt: 1,
        updatedAt: 2,
        activatedAt: 2
      }))
    });
    const svc = new KnowledgeRetrievalService(store, () => settings({
      RAG_CONFIG: { hybridEnabled: false } as any
    }));

    const result = await svc.search('postgres', { limit: 1 });

    expect(result.trace.metadata).toMatchObject({
      indexVersion: 'knowledge:active:v1',
      activeIndexVersion: 'knowledge:active:v1'
    });
    expect(store.searchKBChunks).toHaveBeenCalledWith('postgres', expect.objectContaining({
      indexVersion: 'knowledge:active:v1'
    }));
  });

  it('applies sourceFilter during retrieval and reports scope metadata', async () => {
    const store = createStore();
    const svc = new KnowledgeRetrievalService(store, () => settings({
      RAG_CONFIG: { hybridEnabled: false, mmrEnabled: false } as any
    }));

    const result = await svc.search('postgres', {
      sourceFilter: {
        sourceType: 'knowledge',
        sourceIds: ['knowledge'],
        parentIds: ['doc-a'],
        metadata: { categoryIds: ['cat-a'], documentIds: ['doc-a'], scopeSource: 'agent' }
      },
      limit: 2
    });

    expect(store.searchKBChunks).toHaveBeenCalledWith('postgres', expect.objectContaining({
      categoryIds: ['cat-a'],
      documentIds: ['doc-a']
    }));
    expect(result.units.map((unit) => unit.unitId)).toEqual(['fts-1']);
    expect(result.trace.metadata).toMatchObject({
      scopeFilteredCount: 1,
      scope: expect.objectContaining({
        categoryIds: ['cat-a'],
        documentIds: ['doc-a'],
        scopeSource: 'agent'
      }),
      sourceFilter: expect.objectContaining({
        parentIds: ['doc-a'],
        metadata: expect.objectContaining({ categoryIds: ['cat-a'] })
      })
    });
    expect(result.stages[result.stages.length - 1]).toMatchObject({
      name: 'scope_filter',
      resultCount: 1,
      metadata: expect.objectContaining({
        beforeCount: 2,
        afterCount: 1,
        filteredCount: 1
      })
    });
  });

  it('treats empty scope intersection as deny-all instead of no-filter', async () => {
    const store = createStore();
    const svc = new KnowledgeRetrievalService(store, () => settings({
      RAG_CONFIG: { hybridEnabled: false } as any
    }));

    const result = await svc.search('postgres', {
      sourceFilter: {
        sourceType: 'knowledge',
        sourceIds: ['knowledge'],
        parentIds: ['__deny_all__'],
        metadata: { categoryIds: [], documentIds: [], emptyScopePolicy: 'deny_all' }
      },
      limit: 2
    });

    expect(store.searchKBChunks).toHaveBeenCalledWith('postgres', expect.objectContaining({
      documentIds: ['__deny_all__']
    }));
    expect(result.units).toEqual([]);
    expect(result.evidence).toEqual([]);
    expect(result.trace.retrievedUnitIds).toEqual([]);
    expect(result.trace.metadata).toMatchObject({
      scopeFilteredCount: 2,
      scope: expect.objectContaining({
        documentIds: ['__deny_all__'],
        emptyScopePolicy: 'deny_all'
      })
    });
  });

  it('degrades to FTS when embedding service is missing', async () => {
    const store = createStore();
    const svc = new KnowledgeRetrievalService(store, () => settings({
      ACTIVE_EMBEDDING_SERVICE_ID: 'missing',
      SMALL_MODEL_SERVICES: [],
      RAG_CONFIG: { hybridEnabled: true } as any
    }));

    const result = await svc.search('postgres', { limit: 2 });

    expect(result.retrievalMode).toBe('fts');
    expect(result.fallbackReason).toBe('embedding_service_unavailable');
    expect(result.stages.some((stage) => stage.name === 'vector' && stage.reason === 'embedding_service_unavailable')).toBe(true);
    expect(store.getRagEmbeddingCoverageStats).not.toHaveBeenCalled();
  });

  it('uses JSONB vector fallback when pgvector is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: [{ embedding: [1, 0, 0] }] })
    })));
    const store = createStore({
      getKBVectorCapability: vi.fn(async () => ({ available: false, reason: 'vector_extension_missing' }))
    });
    const svc = new KnowledgeRetrievalService(store, () => settings({
      ACTIVE_EMBEDDING_SERVICE_ID: 'embed-1',
      SMALL_MODEL_SERVICES: [{
        id: 'embed-1',
        name: 'Embedding',
        role: 'EMBEDDING',
        backend: 'OPENAI_COMPAT',
        apiUrl: 'http://127.0.0.1:9',
        model: 'mock-embedding',
        dimensions: 3,
        enabled: true,
        useProxy: false
      }],
      RAG_CONFIG: {
        hybridEnabled: true,
        jsonbVectorFallbackEnabled: true,
        minVectorCoverageForHybrid: 0.8,
        retrievalTopK: 5,
        ftsWeight: 0.5,
        vectorWeight: 0.5
      } as any
    }));

    try {
      const result = await svc.search('postgres', { documentIds: ['doc-c'], limit: 3 });

      expect(result.retrievalMode).toBe('hybrid');
      expect(result.fallbackReason).toBe('pgvector_unavailable_jsonb_fallback');
      expect(store.searchKBChunksByPgVector).not.toHaveBeenCalled();
      expect(store.searchKBChunksByEmbedding).toHaveBeenCalledWith([1, 0, 0], expect.objectContaining({
        documentIds: ['doc-c'],
        preferPgvector: false
      }));
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('keeps legacy HybridSearchService on the adapter-backed retrieval pipeline', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: [{ embedding: [1, 0, 0] }] })
    })));
    const store = createStore();
    const svc = new HybridSearchService(store, () => settings({
      ACTIVE_EMBEDDING_SERVICE_ID: 'embed-1',
      SMALL_MODEL_SERVICES: [{
        id: 'embed-1',
        name: 'Embedding',
        role: 'EMBEDDING',
        backend: 'OPENAI_COMPAT',
        apiUrl: 'http://127.0.0.1:9',
        model: 'mock-embedding',
        dimensions: 3,
        enabled: true,
        useProxy: false
      }],
      RAG_CONFIG: {
        hybridEnabled: true,
        jsonbVectorFallbackEnabled: true,
        minVectorCoverageForHybrid: 0.8,
        retrievalTopK: 5,
        ftsWeight: 0.5,
        vectorWeight: 0.5
      } as any
    }));

    try {
      const result = await svc.searchKBChunks('postgres', {
        categoryIds: ['cat-a'],
        documentIds: ['doc-c'],
        limit: 3
      });

      expect(result.retrievalMode).toBe('hybrid');
      expect(store.searchKBChunksByPgVector).toHaveBeenCalledWith([1, 0, 0], expect.objectContaining({
        categoryIds: ['cat-a'],
        documentIds: ['doc-c']
      }));
      expect(store.searchKBChunksByEmbedding).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('delegates legacy HybridSearchService to the unified retrieval service', async () => {
    const store = createStore();
    const delegated = vi.spyOn(KnowledgeRetrievalService.prototype, 'search').mockResolvedValue({
      rows: FTS_ROWS,
      units: [],
      evidence: [],
      trace: {} as any,
      retrievalMode: 'fts',
      stages: [],
      durationMs: 1
    });

    try {
      const svc = new HybridSearchService(store, () => settings());
      const result = await svc.searchKBChunks('postgres', {
        categoryIds: ['cat-a'],
        documentIds: ['doc-a'],
        limit: 2
      });

      expect(delegated).toHaveBeenCalledWith('postgres', {
        categoryIds: ['cat-a'],
        documentIds: ['doc-a'],
        limit: 2
      });
      expect(result).toMatchObject({ rows: FTS_ROWS, retrievalMode: 'fts' });
      expect(store.searchKBChunks).not.toHaveBeenCalled();
      expect(store.searchKBChunksByPgVector).not.toHaveBeenCalled();
      expect(store.searchKBChunksByEmbedding).not.toHaveBeenCalled();
    } finally {
      delegated.mockRestore();
    }
  });

  it('keeps RagRetrievalPipeline behind the retrieval source adapter', async () => {
    const store = createStore({
      searchKBChunks: vi.fn(async () => {
        throw new Error('pipeline must not read KB chunks directly');
      })
    });
    const source = new KnowledgeRetrievalSource(store);
    const unit: RagRetrievalUnit = {
      unitId: 'unit-a',
      sourceType: 'knowledge',
      sourceId: 'knowledge',
      parentId: 'doc-a',
      text: 'adapter owned unit',
      title: 'Doc A',
      score: 0.8
    };
    const searchFts = vi.spyOn(source, 'searchFts').mockResolvedValue([unit]);
    const pipeline = new RagRetrievalPipeline(
      source,
      () => settings({ RAG_CONFIG: { hybridEnabled: false } as any }),
      () => store.getKBVectorCapability(),
      async () => store.getRagEmbeddingCoverageStats()
    );

    const result = await pipeline.search('postgres', {
      filters: [{ sourceType: 'knowledge', metadata: { categoryIds: ['cat-a'] } }],
      limit: 1
    });

    expect(result.units).toEqual([unit]);
    expect(result.evidence[0]).toMatchObject({
      evidenceId: 'knowledge:unit-a',
      sourceType: 'knowledge',
      unitId: 'unit-a'
    });
    expect(searchFts).toHaveBeenCalledWith('postgres', expect.objectContaining({
      filter: expect.objectContaining({
        sourceType: 'knowledge',
        metadata: expect.objectContaining({ categoryIds: ['cat-a'] })
      }),
      limit: expect.any(Number)
    }));
    expect(store.searchKBChunks).not.toHaveBeenCalled();
  });

  it('runs expanded FTS queries and merges duplicate units with query-source metadata', async () => {
    const store = createStore();
    const source = new KnowledgeRetrievalSource(store);
    const searchFts = vi.spyOn(source, 'searchFts').mockImplementation(async (query: string) => {
      if (query === 'postgres vector') {
        return [
          { unitId: 'unit-a', sourceType: 'knowledge', sourceId: 'knowledge', parentId: 'doc-a', text: 'original hit', title: 'Doc A' },
          { unitId: 'unit-b', sourceType: 'knowledge', sourceId: 'knowledge', parentId: 'doc-b', text: 'secondary hit', title: 'Doc B' }
        ];
      }
      return [
        { unitId: 'unit-a', sourceType: 'knowledge', sourceId: 'knowledge', parentId: 'doc-a', text: 'expanded hit', title: 'Doc A' },
        { unitId: 'unit-c', sourceType: 'knowledge', sourceId: 'knowledge', parentId: 'doc-c', text: 'hyde hit', title: 'Doc C' }
      ];
    });
    const pipeline = new RagRetrievalPipeline(
      source,
      () => settings({ RAG_CONFIG: { hybridEnabled: false } as any }),
      () => store.getKBVectorCapability(),
      async () => store.getRagEmbeddingCoverageStats()
    );

    const result = await pipeline.search('postgres vector', {
      queries: ['postgres vector', 'pgvector 检索配置'],
      limit: 3
    });

    expect(result.rewrittenQueries).toEqual(['postgres vector', 'pgvector 检索配置']);
    expect(searchFts).toHaveBeenCalledTimes(2);
    expect(result.units.map((unit) => unit.unitId)).toEqual(['unit-a', 'unit-b', 'unit-c']);
    expect(result.units[0].metadata?.retrievalSources).toEqual(expect.arrayContaining([
      expect.objectContaining({ query: 'postgres vector', mode: 'fts', rank: 1 }),
      expect.objectContaining({ query: 'pgvector 检索配置', mode: 'fts', rank: 1 })
    ]));
    expect(result.stages[0]).toMatchObject({
      name: 'fts',
      status: 'success',
      metadata: expect.objectContaining({
        queryCount: 2,
        perQuery: expect.arrayContaining([
          expect.objectContaining({ query: 'postgres vector', resultCount: 2 }),
          expect.objectContaining({ query: 'pgvector 检索配置', resultCount: 2 })
        ])
      })
    });
  });

  it('uses text fallback MMR to keep diverse evidence when embeddings are unavailable', async () => {
    const store = createStore();
    const source = new KnowledgeRetrievalSource(store);
    vi.spyOn(source, 'searchFts').mockResolvedValue([
      { unitId: 'unit-a', sourceType: 'knowledge', sourceId: 'knowledge', parentId: 'doc-a', text: 'postgres vector index pgvector embedding search', title: 'Doc A', score: 100 },
      { unitId: 'unit-b', sourceType: 'knowledge', sourceId: 'knowledge', parentId: 'doc-b', text: 'postgres vector index pgvector embedding search', title: 'Doc B', score: 99 },
      { unitId: 'unit-c', sourceType: 'knowledge', sourceId: 'knowledge', parentId: 'doc-c', text: 'sqlite fts keyword matching fallback query', title: 'Doc C', score: 70 }
    ]);
    const pipeline = new RagRetrievalPipeline(
      source,
      () => settings({ RAG_CONFIG: { hybridEnabled: false, mmrLambda: 0.1 } as any }),
      () => store.getKBVectorCapability(),
      async () => store.getRagEmbeddingCoverageStats()
    );

    const result = await pipeline.search('postgres vector', { limit: 2 });
    const mmrStage = result.stages.find((stage) => stage.name === 'mmr');

    expect(result.units.map((unit) => unit.unitId)).toEqual(['unit-a', 'unit-c']);
    expect(mmrStage).toMatchObject({
      status: 'success',
      resultCount: 2,
      metadata: expect.objectContaining({
        similarityMode: 'text',
        selectedUnitIds: ['unit-a', 'unit-c'],
        dropped: expect.arrayContaining([
          expect.objectContaining({ unitId: 'unit-b', reason: 'duplicate_text' })
        ])
      })
    });
  });

  it('skips MMR and preserves relevance order when MMR is disabled', async () => {
    const store = createStore();
    const source = new KnowledgeRetrievalSource(store);
    vi.spyOn(source, 'searchFts').mockResolvedValue([
      { unitId: 'unit-a', sourceType: 'knowledge', sourceId: 'knowledge', parentId: 'doc-a', text: 'postgres vector index pgvector embedding search', title: 'Doc A', score: 100 },
      { unitId: 'unit-b', sourceType: 'knowledge', sourceId: 'knowledge', parentId: 'doc-b', text: 'postgres vector index pgvector embedding search', title: 'Doc B', score: 99 },
      { unitId: 'unit-c', sourceType: 'knowledge', sourceId: 'knowledge', parentId: 'doc-c', text: 'sqlite fts keyword matching fallback query', title: 'Doc C', score: 70 }
    ]);
    const pipeline = new RagRetrievalPipeline(
      source,
      () => settings({ RAG_CONFIG: { hybridEnabled: false, mmrEnabled: false } as any }),
      () => store.getKBVectorCapability(),
      async () => store.getRagEmbeddingCoverageStats()
    );

    const result = await pipeline.search('postgres vector', { limit: 2 });
    const mmrStage = result.stages.find((stage) => stage.name === 'mmr');

    expect(result.units.map((unit) => unit.unitId)).toEqual(['unit-a', 'unit-b']);
    expect(mmrStage).toMatchObject({
      status: 'skipped',
      resultCount: 2,
      reason: 'mmr_disabled'
    });
  });

  it('uses embedding MMR when chunk embeddings are available', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: [{ embedding: [1, 0] }] })
    })));
    const store = createStore({
      getKBVectorCapability: vi.fn(async () => ({ available: false, reason: 'pgvector_missing' }))
    });
    const source = new KnowledgeRetrievalSource(store);
    vi.spyOn(source, 'searchFts').mockResolvedValue([]);
    vi.spyOn(source, 'searchJsonbVector').mockResolvedValue([
      { unitId: 'unit-a', sourceType: 'knowledge', sourceId: 'knowledge', parentId: 'doc-a', text: 'vector a', title: 'Doc A', score: 100, metadata: { knowledge: { embedding: [1, 0] } } },
      { unitId: 'unit-b', sourceType: 'knowledge', sourceId: 'knowledge', parentId: 'doc-b', text: 'vector b', title: 'Doc B', score: 98, metadata: { knowledge: { embedding: [0.99, 0.01] } } },
      { unitId: 'unit-c', sourceType: 'knowledge', sourceId: 'knowledge', parentId: 'doc-c', text: 'vector c', title: 'Doc C', score: 60, metadata: { knowledge: { embedding: [0, 1] } } }
    ]);
    const pipeline = new RagRetrievalPipeline(
      source,
      () => settings({
        ACTIVE_EMBEDDING_SERVICE_ID: 'embed-1',
        SMALL_MODEL_SERVICES: [{
          id: 'embed-1',
          name: 'Embedding',
          role: 'EMBEDDING',
          backend: 'OPENAI_COMPAT',
          apiUrl: 'http://127.0.0.1:9',
          model: 'mock-embedding',
          dimensions: 2,
          enabled: true,
          useProxy: false
        }],
        RAG_CONFIG: {
          hybridEnabled: true,
          jsonbVectorFallbackEnabled: true,
          minVectorCoverageForHybrid: 0.8,
          retrievalTopK: 3,
          ftsWeight: 0,
          vectorWeight: 1,
          mmrLambda: 0.1
        } as any
      }),
      () => store.getKBVectorCapability(),
      async () => store.getRagEmbeddingCoverageStats()
    );

    try {
      const result = await pipeline.search('postgres vector', { limit: 2 });
      const mmrStage = result.stages.find((stage) => stage.name === 'mmr');

      expect(result.units.map((unit) => unit.unitId)).toEqual(['unit-a', 'unit-c']);
      expect(mmrStage).toMatchObject({
        status: 'success',
        metadata: expect.objectContaining({
          similarityMode: 'embedding',
          selectedUnitIds: ['unit-a', 'unit-c']
        })
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});