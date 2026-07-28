import { describe, expect, it, vi } from 'vitest';
import {
  buildOpenAiCompatEmbeddingPayload,
  resolveOpenAiCompatEmbeddingUrl,
  resolveOpenAiCompatRerankUrl
} from '../src/services/rag/SmallModelClient.js';

describe('resolveOpenAiCompatEmbeddingUrl', () => {
  it('passes through the configured URL unchanged', () => {
    expect(
      resolveOpenAiCompatEmbeddingUrl('https://maas-api.cn-huabei-1.xf-yun.com/v2/embeddings')
    ).toBe('https://maas-api.cn-huabei-1.xf-yun.com/v2/embeddings');
  });

  it('only trims whitespace and trailing slash', () => {
    expect(resolveOpenAiCompatEmbeddingUrl('  https://api.example.com/v1/embeddings/  ')).toBe(
      'https://api.example.com/v1/embeddings'
    );
  });
});

describe('resolveOpenAiCompatRerankUrl', () => {
  it('passes through the configured URL unchanged', () => {
    expect(resolveOpenAiCompatRerankUrl('https://api.example.com/v2/rerank')).toBe(
      'https://api.example.com/v2/rerank'
    );
  });
});

describe('buildOpenAiCompatEmbeddingPayload', () => {
  it('includes dimensions when configured', () => {
    expect(
      buildOpenAiCompatEmbeddingPayload(
        { model: 'xop3qwen8bembedding', dimensions: 1024 },
        'hello'
      )
    ).toEqual({
      model: 'xop3qwen8bembedding',
      input: 'hello',
      dimensions: 1024
    });
  });

  it('omits dimensions when not configured', () => {
    expect(buildOpenAiCompatEmbeddingPayload({ model: 'bge-m3' }, ['a', 'b'])).toEqual({
      model: 'bge-m3',
      input: ['a', 'b']
    });
  });
});

describe('OpenAiCompatEmbeddingClient', () => {
  it('sends configured dimensions to the embedding API', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: [{ embedding: new Array(1024).fill(0.1) }] })
    }));
    vi.stubGlobal('fetch', fetchMock);

    try {
      const { createEmbeddingClient } = await import('../src/services/rag/SmallModelClient.js');
      const client = createEmbeddingClient({
        id: 'embed-1',
        name: 'Embedding',
        role: 'EMBEDDING',
        backend: 'OPENAI_COMPAT',
        apiUrl: 'https://api.example.com/v1/embeddings',
        apiKey: 'secret',
        model: 'xop3qwen8bembedding',
        dimensions: 1024,
        enabled: true,
        useProxy: false
      });
      const vectors = await client.embed(['hello']);
      expect(vectors[0]).toHaveLength(1024);
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.example.com/v1/embeddings',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            model: 'xop3qwen8bembedding',
            input: ['hello'],
            dimensions: 1024
          })
        })
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
