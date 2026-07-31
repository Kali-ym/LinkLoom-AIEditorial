import { describe, expect, it, vi, beforeEach } from 'vitest';
import { knowledgeTools } from '../src/plugins/builtin/tools/admin/knowledgeTools.js';
import type { ToolExecutionContext } from '../src/services/ToolExecutionContext.js';

const {
  mockGetCategories,
  mockGetDocuments,
  mockGetDocumentContent,
  mockMemoryGetCategories,
  mockGetRagStatus,
  mockGetPluginMetadata,
} = vi.hoisted(() => ({
  mockGetCategories: vi.fn(),
  mockGetDocuments: vi.fn(),
  mockGetDocumentContent: vi.fn(),
  mockMemoryGetCategories: vi.fn(),
  mockGetRagStatus: vi.fn(),
  mockGetPluginMetadata: vi.fn(),
}));

vi.mock('../src/services/api/KnowledgeRouteService.js', () => ({
  KnowledgeRouteService: class MockKnowledgeRouteService {
    getCategories = mockGetCategories;
    getDocuments = mockGetDocuments;
    getDocumentContent = mockGetDocumentContent;
  },
}));

vi.mock('../src/services/api/MemoryRouteService.js', () => ({
  MemoryRouteService: class MockMemoryRouteService {
    getCategories = mockMemoryGetCategories;
  },
}));

vi.mock('../src/services/rag/RagRouteService.js', () => ({
  RagRouteService: class MockRagRouteService {
    getStatus = mockGetRagStatus;
  },
}));

vi.mock('../src/services/api/SettingsRouteService.js', () => ({
  SettingsRouteService: class MockSettingsRouteService {
    getPluginMetadata = mockGetPluginMetadata;
  },
}));

function ctx(): ToolExecutionContext {
  return { store: {}, services: {} } as unknown as ToolExecutionContext;
}

describe('admin knowledge tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCategories.mockResolvedValue([{ id: 'cat1', name: 'Category 1' }]);
    mockGetDocuments.mockResolvedValue([{ id: 'doc1', name: 'Doc 1' }]);
    mockGetDocumentContent.mockResolvedValue({ content: 'Hello KB' });
    mockMemoryGetCategories.mockResolvedValue([{ id: 'mem1', name: 'Memory 1' }]);
    mockGetRagStatus.mockResolvedValue({ readiness: 'hybrid_ready', runtimeMode: 'hybrid' });
    mockGetPluginMetadata.mockReturnValue([{ id: 'plugin1', name: 'Plugin 1' }]);
  });

  it('list_kb_categories returns categories', async () => {
    const t = knowledgeTools.find((x) => x.id === 'list_kb_categories')!;
    const r = await t.handler({}, ctx());
    expect(r.ok).toBe(true);
    expect(r.categories[0].id).toBe('cat1');
  });

  it('list_kb_documents requires categoryId', async () => {
    const t = knowledgeTools.find((x) => x.id === 'list_kb_documents')!;
    const r = await t.handler({ categoryId: 'cat1' }, ctx());
    expect(r.ok).toBe(true);
    expect(r.documents[0].id).toBe('doc1');
    expect(mockGetDocuments).toHaveBeenCalledWith('cat1');
  });

  it('get_kb_content returns document content', async () => {
    const t = knowledgeTools.find((x) => x.id === 'get_kb_content')!;
    const r = await t.handler({ documentId: 'doc1' }, ctx());
    expect(r.ok).toBe(true);
    expect(r.content).toBe('Hello KB');
  });

  it('list_memory_categories returns categories', async () => {
    const t = knowledgeTools.find((x) => x.id === 'list_memory_categories')!;
    const r = await t.handler({}, ctx());
    expect(r.ok).toBe(true);
    expect(r.categories[0].id).toBe('mem1');
  });

  it('get_rag_status returns status', async () => {
    const t = knowledgeTools.find((x) => x.id === 'get_rag_status')!;
    const r = await t.handler({}, ctx());
    expect(r.ok).toBe(true);
    expect(r.status.readiness).toBe('hybrid_ready');
  });

  it('list_plugin_metadata returns plugins', async () => {
    const t = knowledgeTools.find((x) => x.id === 'list_plugin_metadata')!;
    const r = await t.handler({}, ctx());
    expect(r.ok).toBe(true);
    expect(r.plugins[0].id).toBe('plugin1');
  });

  it('does not register query_knowledge or query_memory', () => {
    const ids = knowledgeTools.map((t) => t.id);
    expect(ids).not.toContain('query_knowledge');
    expect(ids).not.toContain('query_memory');
  });

  it('read-only knowledge tools have no execution policy', () => {
    const readOnlyIds = [
      'list_kb_categories',
      'list_kb_documents',
      'get_kb_content',
      'list_memory_categories',
      'get_rag_status',
      'list_plugin_metadata',
    ];
    for (const id of readOnlyIds) {
      const t = knowledgeTools.find((x) => x.id === id)!;
      expect((t as { execution?: unknown }).execution).toBeUndefined();
    }
  });

  it('has the complete knowledge and RAG tool set', () => {
    expect(knowledgeTools).toHaveLength(13);
  });
});
