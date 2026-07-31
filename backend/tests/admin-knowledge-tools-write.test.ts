import { describe, expect, it, vi, beforeEach } from 'vitest';
import { knowledgeTools } from '../src/plugins/builtin/tools/admin/knowledgeTools.js';
import type { ToolExecutionContext } from '../src/services/ToolExecutionContext.js';

const { mockAddCategory, mockDeleteDocument } = vi.hoisted(() => ({
  mockAddCategory: vi.fn(),
  mockDeleteDocument: vi.fn(),
}));

vi.mock('../src/services/api/KnowledgeRouteService.js', () => ({
  KnowledgeRouteService: class MockKnowledgeRouteService {
    addCategory = mockAddCategory;
    deleteDocument = mockDeleteDocument;
  },
}));

function ctx(): ToolExecutionContext {
  return { store: {}, services: {} } as unknown as ToolExecutionContext;
}

describe('admin knowledge write tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAddCategory.mockResolvedValue({ id: 'cat-new' });
    mockDeleteDocument.mockResolvedValue({ status: 'success' });
  });

  it('create_kb_category calls addCategory', async () => {
    const t = knowledgeTools.find((x) => x.id === 'create_kb_category')!;
    const r = await t.handler({ name: 'New Cat', description: 'desc' }, ctx());
    expect(r.ok).toBe(true);
    expect(r.id).toBe('cat-new');
    expect(mockAddCategory).toHaveBeenCalledWith('New Cat', 'desc');
  });

  it('create_kb_category has medium execution policy', () => {
    const t = knowledgeTools.find((x) => x.id === 'create_kb_category')!;
    expect(t.execution).toEqual({ readonly: false, riskLevel: 'medium' });
  });

  it('delete_kb_document calls deleteDocument', async () => {
    const t = knowledgeTools.find((x) => x.id === 'delete_kb_document')!;
    const r = await t.handler({ documentId: 'doc1' }, ctx());
    expect(r.ok).toBe(true);
    expect(mockDeleteDocument).toHaveBeenCalledWith('doc1');
  });

  it('delete_kb_document has high execution policy', () => {
    const t = knowledgeTools.find((x) => x.id === 'delete_kb_document')!;
    expect(t.execution).toEqual({ readonly: false, riskLevel: 'high' });
  });

  it('knowledgeTools has the complete tool set including write tools', () => {
    expect(knowledgeTools).toHaveLength(13);
  });
});
