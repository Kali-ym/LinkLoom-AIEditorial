import { describe, expect, it } from 'vitest';

import { mapBackendConsoleSearchToResults } from './consoleSearch';
import type { BackendConsoleSearchDto } from './consoleSearch';

describe('consoleSearch mapper', () => {
  const dto: BackendConsoleSearchDto = {
    agents: [
      {
        id: 'a1',
        title: 'Copilot',
        description: 'Main agent',
        agentAvatar: 'C',
        agentBackgroundColor: 'linear-gradient(#000, #fff)',
      },
    ],
    topics: [
      {
        id: 't1',
        title: 'Deploy notes',
        agentId: 'a1',
        agentName: 'Copilot',
        agentAvatar: 'C',
        agentBackgroundColor: 'linear-gradient(#000, #fff)',
        updatedAt: '2026-06-20T10:00:00.000Z',
      },
    ],
    documents: [{ id: 'd1', title: 'Runbook', description: 'runbook.md' }],
    skills: [{ id: 's1', title: 'Summarize', description: 'Short summaries' }],
    actions: [
      { id: 'action-page', title: '文稿', type: 'page', description: 'Pages' },
      { id: 'action-settings', title: '设置', type: 'plugin', description: 'Settings' },
    ],
  };

  it('maps all sections when no type filter', () => {
    const results = mapBackendConsoleSearchToResults(dto, 'inbox');
    expect(results).toHaveLength(6);
    expect(results.find((r) => r.type === 'agent')).toMatchObject({
      id: 'a1',
      avatar: 'C',
      backgroundColor: 'linear-gradient(#000, #fff)',
    });
    expect(results.find((r) => r.type === 'topic')).toMatchObject({
      id: 't1',
      agentId: 'a1',
      agentName: 'Copilot',
      avatar: 'C',
      updatedAt: '2026-06-20T10:00:00.000Z',
    });
    expect(results.find((r) => r.type === 'knowledgeBase')?.id).toBe('d1');
    expect(results.find((r) => r.type === 'plugin')?.identifier).toBe('s1');
    expect(results.find((r) => r.type === 'page')?.title).toBe('文稿');
  });

  it('filters by type when typeFilter is set', () => {
    const results = mapBackendConsoleSearchToResults(dto, 'inbox', 'topic');
    expect(results).toEqual([
      {
        id: 't1',
        title: 'Deploy notes',
        description: undefined,
        agentId: 'a1',
        agentName: 'Copilot',
        avatar: 'C',
        backgroundColor: 'linear-gradient(#000, #fff)',
        updatedAt: '2026-06-20T10:00:00.000Z',
        type: 'topic',
      },
    ]);
  });

  it('uses activeAgentId when topic agentId is missing', () => {
    const results = mapBackendConsoleSearchToResults(
      {
        ...dto,
        topics: [{ id: 't2', title: 'Untitled' }],
      },
      'fallback-agent',
      'topic',
    );
    expect(results[0]?.agentId).toBe('fallback-agent');
  });
});
