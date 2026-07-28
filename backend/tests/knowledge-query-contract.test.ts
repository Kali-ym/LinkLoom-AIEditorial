import { describe, expect, it, vi } from 'vitest';
import { DatabaseKnowledgeService } from '../src/services/knowledge/DatabaseKnowledgeService.js';
import type { SystemSettings } from '../src/types/config.js';

const baseSettings = {
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
  RAG_CONFIG: {
    hybridEnabled: false,
    queryRewriteEnabled: false,
    embedOnIngest: true
  } as any
} satisfies SystemSettings;

function createQueryStore() {
  return {
    searchKBChunks: vi.fn(async () => [
      {
        id: 'chunk-1',
        documentId: 'doc-1',
        categoryId: 'cat-1',
        docName: 'RAG Handbook',
        docSummary: 'RAG production notes',
        content: 'RAG 关闭时应保持 FTS 基线。',
        snippet: 'RAG 关闭时应保持 FTS 基线。'
      }
    ])
  } as any;
}

describe('Knowledge query contract', () => {
  it('keeps queryKnowledge as a string while detailed query returns meta and sources', async () => {
    const store = createQueryStore();
    const service = new DatabaseKnowledgeService(store, null, () => baseSettings);

    const answer = await service.queryKnowledge('RAG 基线', {
      categoryIds: ['cat-1'],
      limit: 1
    });
    const detailed = await service.queryKnowledgeDetailed('RAG 基线', {
      categoryIds: ['cat-1'],
      documentIds: ['doc-1'],
      limit: 1
    });

    expect(typeof answer).toBe('string');
    expect(answer).toContain('知识库已找到相关内容');
    expect(detailed.answer).toContain('知识库已找到相关内容');
    expect(detailed.meta.retrievalMode).toBe('fts');
    expect(detailed.meta.sourceCount).toBe(1);
    expect(detailed.sources).toHaveLength(1);
    expect(store.searchKBChunks).toHaveBeenLastCalledWith('RAG 基线', expect.objectContaining({
      categoryIds: ['cat-1'],
      documentIds: ['doc-1']
    }));
  });

  it('passes query expansion into the real knowledge retrieval chain', async () => {
    const store = createQueryStore() as any;
    store.searchKBChunks = vi.fn(async (query: string) => [
      {
        id: query === 'pgvector 检索配置' ? 'chunk-expanded' : 'chunk-original',
        documentId: query === 'pgvector 检索配置' ? 'doc-expanded' : 'doc-1',
        categoryId: 'cat-1',
        docName: query === 'pgvector 检索配置' ? 'Vector Guide' : 'RAG Handbook',
        docSummary: 'RAG production notes',
        content: query === 'pgvector 检索配置'
          ? 'pgvector 检索配置需要向量索引和覆盖率。'
          : 'RAG 关闭时应保持 FTS 基线。',
        snippet: query
      }
    ]);
    store.saveRagQueryTrace = vi.fn(async () => undefined);
    const agentService = {
      runAgent: vi.fn(async () => ({
        content: JSON.stringify({
          hydeQuery: '向量检索需要 embedding 索引和覆盖率',
          multiQueryVariants: ['pgvector 检索配置']
        })
      }))
    } as any;
    const service = new DatabaseKnowledgeService(store, agentService, () => ({
      ...baseSettings,
      RAG_CONFIG: {
        ...baseSettings.RAG_CONFIG,
        queryRewriteEnabled: true,
        plannerAgentId: 'planner_agent',
        synthesisAgentId: '',
        queryExpansionMaxQueries: 3
      } as any
    }));

    const detailed = await service.queryKnowledgeDetailed('RAG 基线', {
      documentIds: ['doc-1'],
      limit: 3
    });

    expect(store.searchKBChunks).toHaveBeenCalledWith('RAG 基线', expect.any(Object));
    expect(store.searchKBChunks).toHaveBeenCalledWith('向量检索需要 embedding 索引和覆盖率', expect.any(Object));
    expect(store.searchKBChunks).toHaveBeenCalledWith('pgvector 检索配置', expect.any(Object));
    expect(detailed.trace.rewrittenQueries).toEqual([
      'RAG 基线',
      '向量检索需要 embedding 索引和覆盖率',
      'pgvector 检索配置'
    ]);
    expect(detailed.meta.plannerStages.some((stage: any) => stage.name === 'query_expansion' && stage.status === 'success')).toBe(true);
    expect(detailed.trace.metadata?.queryExpansion).toMatchObject({
      hydeQuery: '向量检索需要 embedding 索引和覆盖率',
      multiQueryVariants: ['pgvector 检索配置']
    });
  });

  it('returns citation refusal when retrieval has no evidence', async () => {
    const store = {
      searchKBChunks: vi.fn(async () => []),
      saveRagQueryTrace: vi.fn(async () => undefined)
    } as any;
    const service = new DatabaseKnowledgeService(store, null, () => baseSettings);

    const detailed = await service.queryKnowledgeDetailed('不存在的问题', { limit: 1 });

    expect(detailed.answer).toContain('暂时没有找到');
    expect(detailed.meta.citationCheck).toMatchObject({
      ok: false,
      reason: 'no_evidence'
    });
    expect(detailed.meta.citationDecision).toMatchObject({
      action: 'refuse',
      reason: 'no_evidence',
      retryCount: 0
    });
    expect(detailed.trace?.metadata?.citationDecision).toMatchObject({
      action: 'refuse',
      reason: 'no_evidence'
    });
  });

  it('retries synthesis once when the first answer has no citation', async () => {
    const store = createQueryStore() as any;
    store.saveRagQueryTrace = vi.fn(async () => undefined);
    const agentService = {
      runAgent: vi
        .fn()
        .mockResolvedValueOnce({ content: 'RAG 关闭时应保持 FTS 基线。' })
        .mockResolvedValueOnce({ content: 'RAG 关闭时应保持 FTS 基线。[K1]' })
    } as any;
    const service = new DatabaseKnowledgeService(store, agentService, () => ({
      ...baseSettings,
      RAG_CONFIG: {
        ...baseSettings.RAG_CONFIG,
        synthesisAgentId: 'synthesis_agent'
      } as any
    }));

    const detailed = await service.queryKnowledgeDetailed('RAG 基线', { limit: 1 });

    expect(agentService.runAgent).toHaveBeenCalledTimes(2);
    expect(detailed.answer).toBe('RAG 关闭时应保持 FTS 基线。[K1]');
    expect(detailed.meta.citationCheck).toMatchObject({ ok: true });
    expect(detailed.meta.citationDecision).toMatchObject({
      action: 'accept',
      reason: 'citation_retry_succeeded',
      retryCount: 1,
      previousChecks: [expect.objectContaining({ reason: 'missing_citation' })]
    });
    expect(detailed.trace?.metadata?.citationDecision).toMatchObject({
      action: 'accept',
      reason: 'citation_retry_succeeded'
    });
  });

  it('refuses final answer when citation retry still references missing evidence', async () => {
    const store = createQueryStore() as any;
    store.saveRagQueryTrace = vi.fn(async () => undefined);
    const agentService = {
      runAgent: vi
        .fn()
        .mockResolvedValueOnce({ content: 'RAG 关闭时应保持 FTS 基线。[K9]' })
        .mockResolvedValueOnce({ content: 'RAG 关闭时应保持 FTS 基线。[K9]' })
    } as any;
    const service = new DatabaseKnowledgeService(store, agentService, () => ({
      ...baseSettings,
      RAG_CONFIG: {
        ...baseSettings.RAG_CONFIG,
        synthesisAgentId: 'synthesis_agent'
      } as any
    }));

    const detailed = await service.queryKnowledgeDetailed('RAG 基线', { limit: 1 });

    expect(agentService.runAgent).toHaveBeenCalledTimes(2);
    expect(detailed.answer).toContain('引用了知识库中不存在的证据');
    expect(detailed.meta.citationCheck).toMatchObject({
      ok: false,
      reason: 'citation_not_found',
      missingCitationIds: ['missing:[K9]']
    });
    expect(detailed.meta.citationDecision).toMatchObject({
      action: 'refuse',
      reason: 'citation_not_found',
      retryCount: 1
    });
    expect(detailed.trace?.metadata?.citationDecision).toMatchObject({
      action: 'refuse',
      reason: 'citation_not_found'
    });
  });

  it('exposes unified trace stages for context generation and citation observability', async () => {
    const store = createQueryStore() as any;
    store.saveRagQueryTrace = vi.fn(async () => undefined);
    const agentService = {
      runAgent: vi.fn(async () => ({ content: 'RAG 关闭时应保持 FTS 基线。[K1]' }))
    } as any;
    const service = new DatabaseKnowledgeService(store, agentService, () => ({
      ...baseSettings,
      RAG_CONFIG: {
        ...baseSettings.RAG_CONFIG,
        synthesisAgentId: 'synthesis_agent'
      } as any
    }));

    const detailed = await service.queryKnowledgeDetailed('RAG 基线', { limit: 1 });
    const traceStages = detailed.meta.traceStages || [];
    const stageNames = traceStages.map((stage: any) => stage.name);

    expect(stageNames).toEqual(expect.arrayContaining(['context_build', 'generation', 'citation_check']));
    expect(traceStages.find((stage: any) => stage.name === 'context_build')).toMatchObject({
      status: 'success',
      metadata: expect.objectContaining({
        evidenceCount: 1,
        usedEvidenceCount: 1
      })
    });
    expect(traceStages.find((stage: any) => stage.name === 'generation')).toMatchObject({
      status: 'success',
      metadata: expect.objectContaining({ retry: false })
    });
    expect(traceStages.find((stage: any) => stage.name === 'citation_check')).toMatchObject({
      status: 'success',
      metadata: expect.objectContaining({
        retry: false,
        citationIds: ['knowledge:chunk-1'],
        coverage: 1
      })
    });
    expect(detailed.trace?.metadata?.traceStages).toEqual(traceStages);
    expect(store.saveRagQueryTrace).toHaveBeenLastCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({ traceStages })
    }));
  });

  it('deletes old chunks before updating document content and queues fresh embedding jobs', async () => {
    const savedChunks: any[] = [];
    const store = {
      getKBDocument: vi.fn(async () => ({
        id: 'doc-1',
        categoryId: 'cat-1',
        name: 'Doc',
        fileName: 'doc.md',
        type: 'md',
        summary: '',
        chunkCount: 1,
        metadata: { hash: 'old' },
        createdAt: 1,
        updatedAt: 1
      })),
      deleteKBChunksByDocument: vi.fn(async () => undefined),
      saveKBChunk: vi.fn(async (chunk) => {
        savedChunks.push(chunk);
      }),
      saveKBDocument: vi.fn(async () => undefined),
      upsertRagEmbeddingJob: vi.fn(async (job) => ({ id: job.id, queued: true }))
    } as any;
    const service = new DatabaseKnowledgeService(store, null, () => baseSettings);

    const result = await service.updateDocumentContentDetailed('doc-1', '新的知识库内容');

    expect(store.deleteKBChunksByDocument).toHaveBeenCalledWith('doc-1');
    expect(store.saveKBChunk).toHaveBeenCalledTimes(1);
    expect(savedChunks[0].content).toBe('新的知识库内容');
    expect(savedChunks[0].contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(store.upsertRagEmbeddingJob).toHaveBeenCalledWith(expect.objectContaining({
      chunkId: savedChunks[0].id,
      documentId: 'doc-1',
      sourceType: 'knowledge',
      sourceId: 'knowledge',
      unitId: savedChunks[0].id,
      parentId: 'doc-1',
      contentHash: savedChunks[0].contentHash,
      targetStorage: 'dual'
    }));
    expect(result.embeddingQueuedCount).toBe(1);
    expect(result.embeddingSkippedCount).toBe(0);
  });
});