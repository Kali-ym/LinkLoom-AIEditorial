import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { SystemSettings } from '../src/types/config.js';

const runOnceMock = vi.fn(async () => ({
  status: 'success' as const,
  claimed: 1,
  succeeded: 1,
  skipped: 0,
  failed: 0,
  message: 'ok'
}));

vi.mock('../src/services/rag/RagEmbeddingJobRunner.js', () => ({
  RagEmbeddingJobRunner: class {
    runOnce = runOnceMock;
  }
}));

import { DatabaseKnowledgeService } from '../src/services/knowledge/DatabaseKnowledgeService.js';

const baseSettings = {
  ACTIVE_AI_PROVIDER_ID: 'default-gemini',
  ACTIVE_EMBEDDING_SERVICE_ID: 'embed-1',
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
  SMALL_MODEL_SERVICES: [
    {
      id: 'embed-1',
      name: 'Test Embed',
      role: 'EMBEDDING',
      enabled: true,
      model: 'test-embed',
      dimensions: 4
    }
  ],
  RAG_CONFIG: {
    hybridEnabled: false,
    embedOnIngest: true,
    embeddingBatchSize: 16
  } as any
} satisfies SystemSettings;

describe('DatabaseKnowledgeService embedding auto-run', () => {
  beforeEach(() => {
    runOnceMock.mockClear();
  });

  it('triggers embedding job runner after queued ingest on document update', async () => {
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
      saveKBChunk: vi.fn(async (chunk: any) => {
        savedChunks.push(chunk);
      }),
      saveKBDocument: vi.fn(async () => undefined),
      upsertRagEmbeddingJob: vi.fn(async (job: any) => ({ id: job.id, queued: true }))
    } as any;
    const service = new DatabaseKnowledgeService(store, null, () => baseSettings);

    await service.updateDocumentContentDetailed('doc-1', '新的知识库内容');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(runOnceMock).toHaveBeenCalledWith({ limit: 1 });
  });

  it('does not trigger runner when embedOnIngest is disabled', async () => {
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
      saveKBChunk: vi.fn(async () => undefined),
      saveKBDocument: vi.fn(async () => undefined),
      upsertRagEmbeddingJob: vi.fn(async (job: any) => ({ id: job.id, queued: true }))
    } as any;
    const service = new DatabaseKnowledgeService(store, null, () => ({
      ...baseSettings,
      RAG_CONFIG: { ...baseSettings.RAG_CONFIG, embedOnIngest: false }
    }));

    await service.updateDocumentContentDetailed('doc-1', '新的知识库内容');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(store.upsertRagEmbeddingJob).not.toHaveBeenCalled();
    expect(runOnceMock).not.toHaveBeenCalled();
  });
});
