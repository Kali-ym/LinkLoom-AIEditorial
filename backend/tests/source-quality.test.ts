import { describe, expect, it } from 'vitest';
import { applySourceQualityFilter } from '../src/services/agents/SourceQualityService.js';
import type { UnifiedData } from '../src/types/index.js';

function createStore(config?: Record<string, unknown>) {
  const kv = new Map<string, unknown>();
  if (config) kv.set('platform_source_quality', config);
  return {
    async get(key: string) {
      return kv.get(key);
    },
    async put(key: string, value: unknown) {
      kv.set(key, value);
    }
  };
}

function item(source: string, score?: number): UnifiedData {
  return {
    id: `id_${source}`,
    title: 't',
    url: `https://${source}.example.com/a`,
    published_date: new Date().toISOString(),
    source,
    metadata: score == null ? {} : { ai_score: score }
  };
}

describe('source quality filter', () => {
  it('passes through when config disabled', async () => {
    const store = createStore();
    const result = await applySourceQualityFilter(store as never, [item('alpha', 10)]);
    expect(result).toHaveLength(1);
  });

  it('blocks blacklisted sources', async () => {
    const store = createStore({ sourceBlacklist: ['spam.example.com'], minAiScore: 0 });
    const result = await applySourceQualityFilter(store as never, [
      item('spam', 90),
      item('good', 90)
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('good');
  });

  it('enforces whitelist and min score', async () => {
    const store = createStore({
      sourceWhitelist: ['official'],
      minAiScore: 70,
      sourceBlacklist: []
    });
    const result = await applySourceQualityFilter(store as never, [
      item('official', 80),
      item('official', 50),
      item('other', 95)
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].metadata?.ai_score).toBe(80);
  });
});
