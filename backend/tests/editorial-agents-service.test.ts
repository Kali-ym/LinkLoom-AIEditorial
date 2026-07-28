import { describe, expect, it, vi } from 'vitest';

import { EditorialAgentsService } from '../src/services/editorial/EditorialAgentsService.js';

describe('EditorialAgentsService.ensureBuiltinAgents', () => {
  it('merges missing canonical toolIds into an existing topic_copilot', async () => {
    const saveAgent = vi.fn().mockResolvedValue(undefined);
    const store = {
      get: vi.fn(),
      getAgent: vi.fn().mockResolvedValue({
        id: 'topic_copilot',
        name: '选题 Copilot',
        toolIds: ['query_data', 'query_knowledge'],
        systemPrompt: 'old prompt',
        metadata: { customized: true },
      }),
      saveAgent,
      deleteAgent: vi.fn().mockResolvedValue(undefined),
    };

    const service = new EditorialAgentsService(store as never);
    const updated = await service.ensureBuiltinAgents();

    expect(updated).toContain('topic_copilot');
    expect(saveAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'topic_copilot',
        toolIds: expect.arrayContaining([
          'query_data',
          'query_knowledge',
          'read_skill',
          'list_skill',
          'web_search',
          'crawl_single_page',
        ]),
        systemPrompt: 'old prompt',
      }),
    );
  });

  it('deletes retired fact_reviewer agents', async () => {
    const saveAgent = vi.fn().mockResolvedValue(undefined);
    const deleteAgent = vi.fn().mockResolvedValue(undefined);
    const store = {
      get: vi.fn(),
      getAgent: vi.fn().mockImplementation(async (id: string) => {
        if (id === 'fact_reviewer_a' || id === 'fact_reviewer_b') {
          return { id, name: id };
        }
        if (id === 'topic_copilot') {
          return {
            id: 'topic_copilot',
            name: '选题 Copilot',
            toolIds: [
              'query_data',
              'query_knowledge',
              'read_skill',
              'list_skill',
              'web_search',
              'crawl_single_page',
              'crawl_multi_pages',
              'query_memory',
              'save_memory',
              'read_upload',
              'create_todos',
              'update_todos',
              'clear_todos',
              'create_plan',
              'update_plan',
            ],
            systemPrompt: { role: '选题 Copilot', identity: 'test' },
            metadata: {
              ui: {
                gradient: 'linear-gradient(135deg, #6366f1, #8b5cf6, #ec4899)',
                isPrimary: true,
                consoleVisible: true,
                welcome: 'hello',
                openingQuestions: ['q'],
              },
            },
          };
        }
        return null;
      }),
      saveAgent,
      deleteAgent,
    };

    const service = new EditorialAgentsService(store as never);
    const updated = await service.ensureBuiltinAgents();

    expect(deleteAgent).toHaveBeenCalledWith('fact_reviewer_a');
    expect(deleteAgent).toHaveBeenCalledWith('fact_reviewer_b');
    expect(updated).toEqual(expect.arrayContaining(['fact_reviewer_a', 'fact_reviewer_b']));
  });
});

describe('EditorialAgentsService.ensureBuiltinAgents — super_admin', () => {
  it('creates super_admin with admin tool ids + helper tools', async () => {
    const saveAgent = vi.fn().mockResolvedValue(undefined);
    const store = {
      get: vi.fn().mockResolvedValue({ ACTIVE_AI_PROVIDER_ID: 'p1' }),
      getAgent: vi.fn().mockResolvedValue(null),
      saveAgent,
      deleteAgent: vi.fn().mockResolvedValue(undefined),
    };
    const service = new EditorialAgentsService(store as never);
    const created = await service.ensureBuiltinAgents();
    expect(created).toContain('super_admin');
    const saved = saveAgent.mock.calls.find((call) => call[0]?.id === 'super_admin')?.[0];
    expect(saved).toBeTruthy();
    expect(saved.toolIds).toEqual(
      expect.arrayContaining([
        'create_cron',
        'trigger_scoring',
        'generate_daily_report',
        'decide_workflow_step',
        'query_knowledge',
        'query_memory',
        'list_agents',
        'list_kb_categories',
        'create_todos',
        'create_plan',
      ]),
    );
    expect(saved.runtime).toEqual({ mode: 'react', maxRounds: 12, maxToolCalls: 25 });
    expect(saved.metadata?.ui?.consoleVisible).toBe(true);
    expect(saved.metadata?.ui?.isPrimary).toBe(false);
  });
});
