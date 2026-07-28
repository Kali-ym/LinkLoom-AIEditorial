import type { Dispatcher } from 'undici';
import type { SmallModelServiceConfig } from '../../types/config.js';
import { LogService } from '../LogService.js';

export interface EmbeddingClient {
  embed(texts: string[]): Promise<number[][]>;
  dimensions: number;
}

export interface SmallModelClientOptions {
  dispatcher?: Dispatcher;
}

/** Use the configured API URL as-is (only trim whitespace and trailing slash). */
export function resolveOpenAiCompatEmbeddingUrl(apiUrl: string): string {
  const url = apiUrl.trim().replace(/\/$/, '');
  if (!url) throw new Error('Embedding 接口地址不能为空');
  return url;
}

/** Use the configured API URL as-is (only trim whitespace and trailing slash). */
export function resolveOpenAiCompatRerankUrl(apiUrl: string): string {
  const url = apiUrl.trim().replace(/\/$/, '');
  if (!url) throw new Error('Rerank 接口地址不能为空');
  return url;
}

export function buildOpenAiCompatEmbeddingPayload(
  config: Pick<SmallModelServiceConfig, 'model' | 'dimensions'>,
  input: string | string[]
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    model: config.model,
    input
  };
  if (typeof config.dimensions === 'number' && config.dimensions > 0) {
    payload.dimensions = config.dimensions;
  }
  return payload;
}

export function createEmbeddingClient(
  config: SmallModelServiceConfig,
  options: SmallModelClientOptions = {}
): EmbeddingClient {
  if (config.backend === 'OLLAMA') {
    return new OllamaEmbeddingClient(config, options);
  }
  return new OpenAiCompatEmbeddingClient(config, options);
}

class OpenAiCompatEmbeddingClient implements EmbeddingClient {
  dimensions: number;

  constructor(
    private readonly config: SmallModelServiceConfig,
    private readonly options: SmallModelClientOptions = {}
  ) {
    this.dimensions = config.dimensions || 1536;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const url = resolveOpenAiCompatEmbeddingUrl(this.config.apiUrl);
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        dispatcher: this.options.dispatcher,
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {})
        },
        body: JSON.stringify(buildOpenAiCompatEmbeddingPayload(this.config, texts))
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        message === 'fetch failed'
          ? `无法连接 Embedding 接口 ${url}，请检查接口地址、网络或代理设置`
          : message
      );
    }
    if (!res.ok) {
      throw new Error(`Embedding API failed: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as { data?: Array<{ embedding?: number[] }> };
    const vectors = (data.data || []).map((row) => row.embedding || []);
    if (vectors.length !== texts.length) {
      throw new Error('Embedding API returned unexpected vector count');
    }
    if (vectors[0]?.length) this.dimensions = vectors[0].length;
    return vectors;
  }
}

class OllamaEmbeddingClient implements EmbeddingClient {
  dimensions: number;

  constructor(
    private readonly config: SmallModelServiceConfig,
    private readonly options: SmallModelClientOptions = {}
  ) {
    this.dimensions = config.dimensions || 1024;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const base = this.config.apiUrl.replace(/\/$/, '');
    const vectors: number[][] = [];
    for (const prompt of texts) {
      const res = await fetch(`${base}/api/embeddings`, {
        method: 'POST',
        dispatcher: this.options.dispatcher,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.config.model, prompt })
      });
      if (!res.ok) {
        throw new Error(`Ollama embed failed: ${res.status}`);
      }
      const data = (await res.json()) as { embedding?: number[] };
      if (!data.embedding?.length) throw new Error('Ollama embed returned empty vector');
      vectors.push(data.embedding);
      this.dimensions = data.embedding.length;
    }
    return vectors;
  }
}

export interface RerankResult {
  index: number;
  score: number;
}

export interface RerankClient {
  rerank(query: string, documents: string[]): Promise<RerankResult[]>;
}

export function createRerankClient(
  config: SmallModelServiceConfig,
  options: SmallModelClientOptions = {}
): RerankClient {
  return {
    async rerank(query: string, documents: string[]) {
      const url =
        config.backend === 'OLLAMA'
          ? `${config.apiUrl.replace(/\/$/, '')}/api/rerank`
          : resolveOpenAiCompatRerankUrl(config.apiUrl);
      try {
        const res = await fetch(url, {
          method: 'POST',
          dispatcher: options.dispatcher,
          headers: {
            'Content-Type': 'application/json',
            ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {})
          },
          body: JSON.stringify({
            model: config.model,
            query,
            documents,
            top_n: documents.length
          })
        });
        if (!res.ok) throw new Error(`Rerank failed: ${res.status}`);
        const data = (await res.json()) as {
          results?: Array<{ index: number; relevance_score?: number; score?: number }>;
        };
        return (data.results || []).map((row) => ({
          index: row.index,
          score: row.relevance_score ?? row.score ?? 0
        }));
      } catch (err) {
        LogService.warn(`Rerank client error: ${err}`);
        return documents.map((_, index) => ({ index, score: documents.length - index }));
      }
    }
  };
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
