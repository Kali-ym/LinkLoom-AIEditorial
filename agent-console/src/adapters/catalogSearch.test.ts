import { describe, expect, it } from 'vitest';

import { queryCommandSearch } from './catalogSearch';
import { mapSettingsProvidersToCatalog } from './api/catalogPort';

describe('mapSettingsProvidersToCatalog', () => {
  it('maps AI_PROVIDERS with models array', () => {
    const result = mapSettingsProvidersToCatalog([
      {
        id: 'openai-1',
        name: 'OpenAI',
        type: 'OPENAI',
        models: ['gpt-4o', 'gpt-4o-mini'],
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('openai-1');
    expect(result[0].children.map((m) => m.id)).toEqual(['gpt-4o', 'gpt-4o-mini']);
    expect(result[0].children.every((m) => m.displayName === 'OpenAI')).toBe(true);
  });

  it('uses provider display name for model label', () => {
    const result = mapSettingsProvidersToCatalog([
      {
        id: 'openai-1',
        name: 'GPT 5.5',
        type: 'OPENAI',
        models: ['gpt-5.5'],
      },
    ]);

    expect(result[0].children[0].id).toBe('gpt-5.5');
    expect(result[0].children[0].displayName).toBe('GPT 5.5');
  });

  it('falls back to single model field', () => {
    const result = mapSettingsProvidersToCatalog([
      { id: 'gemini', name: 'Gemini', model: 'gemini-2.0-flash' },
    ]);
    expect(result[0].children[0].id).toBe('gemini-2.0-flash');
  });

  it('skips providers without models', () => {
    expect(mapSettingsProvidersToCatalog([{ id: 'empty', name: 'Empty' }])).toEqual([]);
  });
});

describe('queryCommandSearch', () => {
  const sources = {
    activeAgentId: 'agent-1',
    agents: [
      {
        id: 'agent-1',
        name: 'Copilot',
        description: 'helper',
        gradient: '',
        welcome: '',
        openingQuestions: [],
      },
    ],
    topics: [{ id: 'topic-1', title: 'RSS 整理', status: 'completed' as const }],
    messagesByTopicId: {
      'topic-1': [{ id: 'm1', role: 'user' as const, content: 'hello rss', createdAt: '2026-06-20' }],
    },
  };

  it('finds topics and messages in api mode (no extra mocks)', () => {
    const results = queryCommandSearch('rss', undefined, sources, { includeExtraMocks: false });
    expect(results.some((r) => r.type === 'topic')).toBe(true);
    expect(results.some((r) => r.type === 'message')).toBe(true);
  });

  it('returns empty for blank query', () => {
    expect(queryCommandSearch('  ', undefined, sources)).toEqual([]);
  });
});
