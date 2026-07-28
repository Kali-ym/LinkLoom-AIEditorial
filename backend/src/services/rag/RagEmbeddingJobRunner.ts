import type { SystemSettings } from '../../types/config.js';
import type { LocalStore } from '../LocalStore.js';
import { LogService } from '../LogService.js';
import { resolveEmbeddingService, resolveRagConfig } from './RagSettings.js';
import { createEmbeddingClient } from './SmallModelClient.js';

export class RagEmbeddingJobRunner {
  constructor(
    private readonly store: LocalStore,
    private readonly getSettings: () => SystemSettings | null | undefined
  ) {}

  async resetStaleJobs(staleMs = 15 * 60 * 1000) {
    return this.store.resetStaleRagEmbeddingJobs(staleMs);
  }

  async runOnce(options: { limit?: number } = {}) {
    const settings = this.getSettings();
    const rag = resolveRagConfig(settings);
    const embedSvc = resolveEmbeddingService(settings);
    const batchLimit = Math.max(1, Math.min(options.limit || rag.embeddingBatchSize || 16, 100));
    const maxAttempts = Math.max(1, rag.embeddingMaxAttempts || 3);

    if (!embedSvc) {
      return {
        status: 'disabled' as const,
        claimed: 0,
        succeeded: 0,
        skipped: 0,
        failed: 0,
        message: '未配置可用 embedding 服务'
      };
    }

    const jobs = await this.store.claimRagEmbeddingJobs(batchLimit, maxAttempts);
    if (jobs.length === 0) {
      return {
        status: 'success' as const,
        claimed: 0,
        succeeded: 0,
        skipped: 0,
        failed: 0,
        message: '没有待处理 embedding job'
      };
    }

    const pgvector = await this.store.getKBVectorCapability();
    const client = createEmbeddingClient(embedSvc);
    const versionCache = new Map<string, Awaited<ReturnType<LocalStore['getRagIndexVersion']>>>();
    const resolveIndexVersion = async (indexVersion?: string) => {
      if (!indexVersion) return null;
      if (!versionCache.has(indexVersion)) {
        versionCache.set(indexVersion, await this.store.getRagIndexVersion(indexVersion));
      }
      return versionCache.get(indexVersion) || null;
    };
    let succeeded = 0;
    let skipped = 0;
    let failed = 0;

    for (const job of jobs) {
      try {
        const content = String(job.content || '').trim();
        if (!content) {
          await this.store.skipRagEmbeddingJob(job.id, 'empty_chunk_content');
          skipped += 1;
          continue;
        }

        const indexVersion = await resolveIndexVersion(job.indexVersion);
        if (job.indexVersion && !indexVersion) {
          await this.store.skipRagEmbeddingJob(job.id, 'index_version_not_found');
          skipped += 1;
          continue;
        }
        if (indexVersion && !['candidate', 'building', 'evaluated', 'active'].includes(indexVersion.status)) {
          await this.store.skipRagEmbeddingJob(job.id, `index_version_${indexVersion.status}`);
          skipped += 1;
          continue;
        }

        const [embedding] = await client.embed([content]);
        const actualDimensions = embedding?.length || 0;
        if (!actualDimensions) {
          await this.store.skipRagEmbeddingJob(job.id, 'empty_embedding');
          skipped += 1;
          continue;
        }

        const configuredDimensions = embedSvc.dimensions || client.dimensions;
        const wantsPgvector = job.targetStorage === 'pgvector' || job.targetStorage === 'dual';
        const pgvectorReady = pgvector.available && (!pgvector.dimensions || pgvector.dimensions === actualDimensions);
        const dimensionMismatch =
          (configuredDimensions && configuredDimensions !== actualDimensions) ||
          (wantsPgvector && pgvector.available && pgvector.dimensions && pgvector.dimensions !== actualDimensions);

        if (dimensionMismatch) {
          await this.store.markKBChunkEmbeddingError(job.chunkId, 'dimension_mismatch');
          await this.store.skipRagEmbeddingJob(job.id, 'dimension_mismatch');
          skipped += 1;
          continue;
        }

        const targetStorage = job.targetStorage;
        const writePgvector = (targetStorage === 'pgvector' || targetStorage === 'dual') && pgvectorReady;
        const writeJsonb = targetStorage !== 'pgvector' || !writePgvector;

        await this.store.updateKBChunkEmbeddingDual(job.chunkId, embedding, {
          writeJsonb,
          writePgvector,
          model: embedSvc.model,
          dimensions: actualDimensions,
          contentHash: job.contentHash,
          indexVersion: indexVersion?.version || job.indexVersion,
          embeddingConfigHash: indexVersion?.embeddingConfigHash || JSON.stringify({ model: embedSvc.model || '', dimensions: configuredDimensions || actualDimensions }),
          chunkerVersion: indexVersion?.chunkerVersion,
          embeddingProviderId: indexVersion?.embeddingProviderId || embedSvc.id
        });
        await this.store.completeRagEmbeddingJob(job.id);
        succeeded += 1;
      } catch (err) {
        failed += 1;
        const message = String(err);
        await this.store.failRagEmbeddingJob(job.id, message, maxAttempts);
        LogService.warn(`RAG embedding job failed ${job.id}: ${message}`);
      }
    }

    return {
      status: failed > 0 ? 'partial' as const : 'success' as const,
      claimed: jobs.length,
      succeeded,
      skipped,
      failed
    };
  }
}