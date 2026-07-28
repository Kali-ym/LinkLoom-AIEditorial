import { beforeAll, describe, expect, it, vi } from 'vitest';
import { PromptService } from '../src/services/PromptService.js';
import { RagQueryPlanner } from '../src/services/rag/RagQueryPlanner.js';
import type { SystemSettings } from '../src/types/config.js';

function settings(queryRewriteEnabled: boolean): SystemSettings {
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
    RAG_CONFIG: {
      hybridEnabled: false,
      queryRewriteEnabled,
      plannerMaxCategories: 2,
      plannerMaxDocuments: 2,
      synthesisAgentId: 'planner_agent',
      plannerAgentId: 'planner_agent'
    } as any
  } as SystemSettings;
}

describe('RagQueryPlanner', () => {
  beforeAll(async () => {
    await PromptService.getInstance().loadTemplates();
  });

  it('does not rewrite when query rewrite is disabled', async () => {
    const store = {
      listKBCategories: vi.fn()
    } as any;
    const agentService = {
      runAgent: vi.fn()
    } as any;
    const planner = new RagQueryPlanner(store, agentService, () => settings(false));

    const result = await planner.plan('postgres vector', { categoryIds: ['cat-a'] });

    expect(result.retrievalQuery).toBe('postgres vector');
    expect(result.categoryIds).toEqual(['cat-a']);
    expect(result.documentIds).toBeUndefined();
    expect(result.stages).toEqual([
      { name: 'query_rewrite', status: 'skipped', reason: 'query_rewrite_disabled' }
    ]);
    expect(store.listKBCategories).not.toHaveBeenCalled();
    expect(agentService.runAgent).not.toHaveBeenCalled();
  });

  it('keeps caller document scope authoritative', async () => {
    const store = {
      listKBCategories: vi.fn()
    } as any;
    const agentService = {
      runAgent: vi.fn()
    } as any;
    const planner = new RagQueryPlanner(store, agentService, () => settings(true));

    const result = await planner.plan('postgres vector', {
      categoryIds: ['cat-a'],
      documentIds: ['doc-a']
    });

    expect(result.categoryIds).toEqual(['cat-a']);
    expect(result.documentIds).toEqual(['doc-a']);
    expect(result.stages).toEqual([
      { name: 'scope', status: 'skipped', reason: 'document_scope_provided' }
    ]);
    expect(store.listKBCategories).not.toHaveBeenCalled();
    expect(agentService.runAgent).not.toHaveBeenCalled();
  });

  it('falls back to the original query when planner work fails', async () => {
    const store = {
      listKBCategories: vi.fn(async () => {
        throw new Error('category lookup failed');
      })
    } as any;
    const agentService = {
      runAgent: vi.fn()
    } as any;
    const planner = new RagQueryPlanner(store, agentService, () => settings(true));

    const result = await planner.plan('postgres vector');

    expect(result.originalQuery).toBe('postgres vector');
    expect(result.retrievalQuery).toBe('postgres vector');
    expect(result.fallbackReason).toBe('planner_failed');
    expect(result.stages.some((stage) => stage.name === 'planner' && stage.status === 'failed')).toBe(true);
  });

  it('skips planner when synthesis agent is not configured', async () => {
    const store = {
      listKBCategories: vi.fn()
    } as any;
    const agentService = {
      runAgent: vi.fn()
    } as any;
    const planner = new RagQueryPlanner(store, agentService, () => ({
      ...settings(true),
      RAG_CONFIG: {
        ...settings(true).RAG_CONFIG,
        synthesisAgentId: '',
        plannerAgentId: ''
      }
    }));

    const result = await planner.plan('postgres vector');

    expect(result.fallbackReason).toBe('planner_agent_unconfigured');
    expect(result.stages).toEqual([
      { name: 'query_rewrite', status: 'skipped', reason: 'planner_agent_unconfigured' }
    ]);
    expect(agentService.runAgent).not.toHaveBeenCalled();
  });

  it('sanitizes model-selected ids against existing categories and documents', async () => {
    const store = {
      listKBCategories: vi.fn(async () => [
        { id: 'cat-a', name: 'A', description: '' },
        { id: 'cat-b', name: 'B', description: '' }
      ]),
      getKBCategory: vi.fn(async (id: string) => ({ id, name: id, description: '' })),
      listKBDocuments: vi.fn(async () => [
        { id: 'doc-a', name: 'Doc A', summary: '' },
        { id: 'doc-b', name: 'Doc B', summary: '' }
      ])
    } as any;
    const agentService = {
      runAgent: vi
        .fn()
        .mockResolvedValueOnce({ content: '["cat-a", "missing-cat", "cat-a", "cat-b"]' })
        .mockResolvedValueOnce({ content: 'prefix ["doc-a", "missing-doc", "doc-a", "doc-b"] suffix' })
    } as any;
    const planner = new RagQueryPlanner(store, agentService, () => settings(true));

    const result = await planner.plan('postgres vector');

    expect(result.categoryIds).toEqual(['cat-a', 'cat-b']);
    expect(result.documentIds).toEqual(['doc-a', 'doc-b']);
    expect(result.stages.some((stage) => stage.name === 'category_choice' && stage.outputCount === 2)).toBe(true);
    expect(result.stages.some((stage) => stage.name === 'document_choice' && stage.outputCount === 2)).toBe(true);
    expect(agentService.runAgent).toHaveBeenCalledWith(
      'planner_agent',
      expect.any(String),
      undefined,
      expect.objectContaining({ silent: true, noTools: true })
    );
  });

  it('expands a query into HyDE and multi-query variants', async () => {
    const store = {
      listKBCategories: vi.fn()
    } as any;
    const agentService = {
      runAgent: vi.fn(async () => ({
        content: JSON.stringify({
          hydeQuery: 'PostgreSQL 向量检索需要 embedding 索引和召回配置',
          multiQueryVariants: ['pgvector 检索配置', 'embedding 索引覆盖率', 'postgres vector']
        })
      }))
    } as any;
    const planner = new RagQueryPlanner(store, agentService, () => ({
      ...settings(true),
      RAG_CONFIG: {
        ...settings(true).RAG_CONFIG,
        queryExpansionMaxQueries: 4
      } as any
    }));

    const result = await planner.expand('postgres vector');

    expect(result.queries).toEqual([
      'postgres vector',
      'PostgreSQL 向量检索需要 embedding 索引和召回配置',
      'pgvector 检索配置',
      'embedding 索引覆盖率'
    ]);
    expect(result.hydeQuery).toBe('PostgreSQL 向量检索需要 embedding 索引和召回配置');
    expect(result.multiQueryVariants).toEqual(['pgvector 检索配置', 'embedding 索引覆盖率']);
    expect(result.stages[0]).toMatchObject({
      name: 'query_expansion',
      status: 'success',
      outputCount: 3
    });
  });

  it('falls back to the original query when expansion fails', async () => {
    const store = {
      listKBCategories: vi.fn()
    } as any;
    const agentService = {
      runAgent: vi.fn(async () => {
        throw new Error('expansion failed');
      })
    } as any;
    const planner = new RagQueryPlanner(store, agentService, () => settings(true));

    const result = await planner.expand('postgres vector');

    expect(result.queries).toEqual(['postgres vector']);
    expect(result.fallbackReason).toBe('query_expansion_failed');
    expect(result.stages.some((stage) => stage.name === 'query_expansion' && stage.status === 'failed')).toBe(true);
  });
});