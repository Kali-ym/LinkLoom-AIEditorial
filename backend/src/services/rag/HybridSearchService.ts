import type { LocalStore } from '../LocalStore.js';
import type { SystemSettings } from '../../types/config.js';
import { LogService } from '../LogService.js';
import { createEmbeddingClient, cosineSimilarity } from './SmallModelClient.js';
import { resolveEmbeddingService } from './RagSettings.js';
import { KnowledgeRetrievalService } from './KnowledgeRetrievalService.js';

export interface HybridSearchResult {
  rows: any[];
  retrievalMode: 'fts' | 'hybrid' | 'hybrid+rerank';
  fallbackReason?: string;
}

export class HybridSearchService {
  constructor(
    private readonly store: LocalStore,
    private readonly getSettings: () => SystemSettings | null | undefined
  ) {}

  async searchKBChunks(
    query: string,
    options: { categoryIds?: string[]; documentIds?: string[]; limit?: number } = {}
  ): Promise<HybridSearchResult> {
    const result = await new KnowledgeRetrievalService(this.store, this.getSettings).search(query, options);
    return {
      rows: result.rows,
      retrievalMode: result.retrievalMode,
      fallbackReason: result.fallbackReason
    };
  }

  async embedChunkTexts(texts: string[]): Promise<number[][] | null> {
    const settings = this.getSettings();
    const embedSvc = resolveEmbeddingService(settings);
    if (!embedSvc) return null;
    try {
      const client = createEmbeddingClient(embedSvc);
      return await client.embed(texts);
    } catch (err) {
      LogService.warn(`Chunk embed failed: ${err}`);
      return null;
    }
  }
}

export { cosineSimilarity };