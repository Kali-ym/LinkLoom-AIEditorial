import { beforeEach, describe, expect, it, vi } from 'vitest';

const remoteEmbed = vi.fn(async (texts: string[]) => texts.map(() => [0.1, 0.2, 0.3, 0.4]));

vi.mock('../src/services/rag/SmallModelClient.js', () => ({
  cosineSimilarity: () => 0,
  createEmbeddingClient: () => ({
    dimensions: 4,
    embed: remoteEmbed
  })
}));

import {
  createHotEmbedder,
  hotEmbedContentHash,
  hotEmbedModelKey,
  type HotEmbedCacheStore
} from '../src/services/feed/hotEmbed.js';

describe('hot embed persistent cache', () => {
  const service = {
    id: 'svc1',
    name: 'Test Embed',
    role: 'EMBEDDING' as const,
    backend: 'OPENAI_COMPAT' as const,
    apiUrl: 'http://localhost',
    model: 'test-model',
    dimensions: 4,
    enabled: true,
    useProxy: false
  };

  beforeEach(() => {
    remoteEmbed.mockClear();
  });

  it('hashes text stably and builds model key', () => {
    expect(hotEmbedContentHash('  hello  ')).toBe(hotEmbedContentHash('hello'));
    expect(hotEmbedModelKey(service)).toBe('svc1:test-model:4');
  });

  it('skips remote embed when cache hits', async () => {
    const text = 'OpenAI 发布 ChatGPT Health';
    const hash = hotEmbedContentHash(text);
    const stored = [1, 0, 0, 0];
    const getHotEmbedCache = vi.fn(async () => new Map([[hash, stored]]));
    const upsertHotEmbedCache = vi.fn(async () => undefined);
    const cache: HotEmbedCacheStore = { getHotEmbedCache, upsertHotEmbedCache };

    const embed = createHotEmbedder(service, cache);
    const out = await embed([text, text]);
    expect(out).toEqual([stored, stored]);
    expect(getHotEmbedCache).toHaveBeenCalled();
    expect(remoteEmbed).not.toHaveBeenCalled();
    expect(upsertHotEmbedCache).not.toHaveBeenCalled();
  });

  it('fetches missing then upserts cache', async () => {
    const text = '全新摘要文本';
    const getHotEmbedCache = vi.fn(async () => new Map());
    const upsertHotEmbedCache = vi.fn(async () => undefined);
    const cache: HotEmbedCacheStore = { getHotEmbedCache, upsertHotEmbedCache };

    const embed = createHotEmbedder(service, cache);
    const out = await embed([text]);
    expect(out?.[0]).toEqual([0.1, 0.2, 0.3, 0.4]);
    expect(remoteEmbed).toHaveBeenCalledTimes(1);
    expect(upsertHotEmbedCache).toHaveBeenCalledWith(
      'svc1:test-model:4',
      expect.arrayContaining([
        expect.objectContaining({
          contentHash: hotEmbedContentHash(text),
          dimensions: 4,
          embedding: [0.1, 0.2, 0.3, 0.4]
        })
      ])
    );
  });
});
