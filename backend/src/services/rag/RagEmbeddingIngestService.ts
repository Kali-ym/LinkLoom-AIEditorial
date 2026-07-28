import crypto from 'crypto';
import { typeid } from 'typeid-js';
import type { RagReindexTargetStorage } from '../../types/rag.js';
import type { LocalStore } from '../LocalStore.js';

export function hashChunkContent(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

export class RagEmbeddingIngestService {
  constructor(private readonly store: LocalStore) {}

  async enqueueChunks(chunks: Array<{
    id: string;
    documentId: string;
    content: string;
    contentHash?: string;
    indexVersion?: string;
  }>, targetStorage: RagReindexTargetStorage = 'dual') {
    let queued = 0;
    let skipped = 0;
    const jobIds: string[] = [];

    for (const chunk of chunks) {
      const content = String(chunk.content || '').trim();
      if (!chunk.id || !chunk.documentId || !content) {
        skipped += 1;
        continue;
      }
      const contentHash = chunk.contentHash || hashChunkContent(content);
      const result = await this.store.upsertRagEmbeddingJob({
        id: typeid('ragjob').toString(),
        chunkId: chunk.id,
        documentId: chunk.documentId,
        sourceType: 'knowledge',
        sourceId: 'knowledge',
        unitId: chunk.id,
        parentId: chunk.documentId,
        indexVersion: chunk.indexVersion,
        contentHash,
        targetStorage
      });
      if (result.queued) queued += 1;
      else skipped += 1;
      jobIds.push(result.id);
    }

    return { queued, skipped, jobIds };
  }

  async enqueueByFilter(options: {
    categoryId?: string;
    categoryIds?: string[];
    documentId?: string;
    documentIds?: string[];
    indexVersion?: string;
    limit?: number;
    onlyMissing?: boolean;
    targetStorage?: RagReindexTargetStorage;
    dryRun?: boolean;
  } = {}) {
    const chunks = await this.store.listKBChunksForEmbedding({
      categoryId: options.categoryId,
      categoryIds: options.categoryIds,
      documentId: options.documentId,
      documentIds: options.documentIds,
      indexVersion: options.indexVersion,
      onlyMissing: options.onlyMissing,
      limit: options.limit
    });
    const documentIds = new Set(chunks.map((chunk) => String(chunk.documentId || '')));
    if (options.dryRun) {
      return {
        documentsScanned: documentIds.size,
        chunksScanned: chunks.length,
        queued: 0,
        skipped: chunks.length,
        alreadyIndexed: chunks.filter((chunk) => chunk.embeddingJson).length,
        jobIds: [] as string[]
      };
    }
    const result = await this.enqueueChunks(
      chunks.map((chunk) => ({
        id: chunk.id,
        documentId: chunk.documentId,
        content: chunk.content,
        contentHash: chunk.contentHash || hashChunkContent(chunk.content),
        indexVersion: options.indexVersion || chunk.indexVersion
      })),
      options.targetStorage || 'dual'
    );
    return {
      documentsScanned: documentIds.size,
      chunksScanned: chunks.length,
      alreadyIndexed: chunks.filter((chunk) => chunk.embeddingJson).length,
      ...result
    };
  }
}