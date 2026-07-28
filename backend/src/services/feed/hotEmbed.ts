import { createHash } from 'node:crypto';
import type { SmallModelServiceConfig } from '../../types/config.js';
import { createEmbeddingClient, cosineSimilarity } from '../rag/SmallModelClient.js';
import { LogService } from '../LogService.js';

export type EmbedTextsFn = (texts: string[]) => Promise<number[][] | null>;

export interface HotEmbedCacheStore {
  getHotEmbedCache(modelKey: string, contentHashes: string[]): Promise<Map<string, number[]>>;
  upsertHotEmbedCache(
    modelKey: string,
    rows: Array<{ contentHash: string; dimensions: number; embedding: number[] }>
  ): Promise<void>;
}

export function hotEmbedContentHash(text: string): string {
  return createHash('sha256').update(text.trim(), 'utf8').digest('hex');
}

export function hotEmbedModelKey(service: SmallModelServiceConfig): string {
  const dims = Number(service.dimensions) || 0;
  return `${service.id}:${service.model || 'model'}:${dims}`;
}

export function createHotEmbedder(
  service: SmallModelServiceConfig,
  cacheStore?: HotEmbedCacheStore | null
): EmbedTextsFn {
  const client = createEmbeddingClient(service);
  const modelKey = hotEmbedModelKey(service);
  const mem = new Map<string, number[]>();

  return async (texts: string[]) => {
    try {
      const keys = texts.map((t) => t.trim());
      const hashes = keys.map((k) => (k ? hotEmbedContentHash(k) : ''));

      // 1) memory
      const needDb: string[] = [];
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        const h = hashes[i];
        if (!k || !h) continue;
        if (mem.has(h)) continue;
        needDb.push(h);
      }

      // 2) persistent cache
      if (cacheStore && needDb.length > 0) {
        const cached = await cacheStore.getHotEmbedCache(modelKey, needDb);
        for (const [h, vec] of cached) {
          mem.set(h, vec);
        }
      }

      // 3) remote embed missing
      const missingTexts: string[] = [];
      const missingHashes: string[] = [];
      const seenMissing = new Set<string>();
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        const h = hashes[i];
        if (!k || !h) continue;
        if (mem.has(h)) continue;
        if (seenMissing.has(h)) continue;
        seenMissing.add(h);
        missingTexts.push(k);
        missingHashes.push(h);
      }

      if (missingTexts.length > 0) {
        const vectors = await client.embed(missingTexts);
        const toStore: Array<{ contentHash: string; dimensions: number; embedding: number[] }> =
          [];
        for (let i = 0; i < missingTexts.length; i++) {
          const vec = vectors[i];
          if (!vec?.length) continue;
          mem.set(missingHashes[i], vec);
          toStore.push({
            contentHash: missingHashes[i],
            dimensions: vec.length,
            embedding: vec
          });
        }
        if (cacheStore && toStore.length > 0) {
          await cacheStore.upsertHotEmbedCache(modelKey, toStore);
        }
        LogService.info(
          `Hot embed: fetched=${toStore.length} cached_hit=${keys.length - missingTexts.length} model=${modelKey}`
        );
      }

      return keys.map((k, i) => {
        if (!k) throw new Error('embedding_missing');
        const v = mem.get(hashes[i]);
        if (!v) throw new Error('embedding_missing');
        return v;
      });
    } catch (err) {
      LogService.warn(`Hot embed failed: ${err}`);
      return null;
    }
  };
}

export { cosineSimilarity };
