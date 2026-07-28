import crypto from 'crypto';
import type { ServiceContext } from '../ServiceContext.js';
import type { LocalStore } from '../LocalStore.js';
import type {
  RagExplicitSearchInput,
  RagExplicitSearchResult,
  RagEvalComparison,
  RagIndexVersionActivationResult,
  RagIndexVersionEvaluateResult,
  RagInputIssue,
  RagMainPathMode,
  RagEmbeddingJobStatus,
  RagReadiness,
  RagReindexInput,
  RagReindexResult,
  RagReindexTargetStorage,
  RagRuntimeMode,
  RagStatusContract,
  RagVectorStorageMode
} from '../../types/rag.js';
import { ConfigService } from '../ConfigService.js';
import { resolveSmallModelConfigForRuntime } from '../settingsSecurity.js';
import type { SystemSettings, SmallModelServiceConfig } from '../../types/config.js';
import {
  createEmbeddingClient,
  createRerankClient
} from './SmallModelClient.js';
import { RagEmbeddingIngestService } from './RagEmbeddingIngestService.js';
import { RagEmbeddingJobRunner } from './RagEmbeddingJobRunner.js';
import { RagEvalService, createCandidateIndexVersion } from './RagEvalService.js';
import { KnowledgeRetrievalService } from './KnowledgeRetrievalService.js';
import { RagQueryPlanner } from './RagQueryPlanner.js';
import {
  isHybridSearchEnabled,
  resolveEmbeddingService,
  resolveRagConfig,
  resolveRagPlannerAgentId,
  resolveRagSynthesisAgentId,
  resolveRerankService
} from './RagSettings.js';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) return [];
  const out = value
    .map((item) => text(item))
    .filter(Boolean);
  return [...new Set(out)];
}

function normalizeLimit(value: unknown): number | undefined {
  const raw = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim()
      ? Number(value)
      : NaN;
  if (!Number.isFinite(raw)) return undefined;
  return Math.min(50, Math.max(1, Math.floor(raw)));
}

function normalizeReindexLimit(value: unknown): number | undefined {
  const raw = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim()
      ? Number(value)
      : NaN;
  if (!Number.isFinite(raw)) return undefined;
  return Math.min(500, Math.max(1, Math.floor(raw)));
}

function normalizeSearchInput(value: unknown): RagExplicitSearchInput {
  const input = asRecord(value);
  return {
    query: text(input.query),
    categoryIds: normalizeStringArray(input.categoryIds),
    documentIds: normalizeStringArray(input.documentIds),
    indexVersion: text(input.indexVersion) || undefined,
    limit: normalizeLimit(input.limit)
  };
}

function normalizeBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function normalizeReindexInput(value: unknown): RagReindexInput {
  const input = asRecord(value);
  const target = text(input.targetStorage) as RagReindexTargetStorage;
  return {
    categoryId: text(input.categoryId) || undefined,
    categoryIds: normalizeStringArray(input.categoryIds),
    documentId: text(input.documentId) || undefined,
    documentIds: normalizeStringArray(input.documentIds),
    indexVersion: text(input.indexVersion) || undefined,
    limit: normalizeReindexLimit(input.limit) || 100,
    targetStorage: ['jsonb_embedding', 'pgvector', 'dual'].includes(target)
      ? target
      : 'dual',
    dryRun: normalizeBoolean(input.dryRun) || false,
    onlyMissing: normalizeBoolean(input.onlyMissing)
  };
}

function validateReindexInput(value: unknown): RagInputIssue[] {
  const input = asRecord(value);
  const issues: RagInputIssue[] = [];

  if (input.categoryId !== undefined && typeof input.categoryId !== 'string') {
    issues.push({
      code: 'invalid_type',
      path: '$.categoryId',
      message: 'RAG reindex categoryId 必须是字符串',
      value: input.categoryId
    });
  }

  if (input.categoryIds !== undefined && !Array.isArray(input.categoryIds)) {
    issues.push({
      code: 'invalid_type',
      path: '$.categoryIds',
      message: 'RAG reindex categoryIds 必须是字符串数组',
      value: input.categoryIds
    });
  }

  if (input.documentId !== undefined && typeof input.documentId !== 'string') {
    issues.push({
      code: 'invalid_type',
      path: '$.documentId',
      message: 'RAG reindex documentId 必须是字符串',
      value: input.documentId
    });
  }

  if (input.documentIds !== undefined && !Array.isArray(input.documentIds)) {
    issues.push({
      code: 'invalid_type',
      path: '$.documentIds',
      message: 'RAG reindex documentIds 必须是字符串数组',
      value: input.documentIds
    });
  }

  if (input.dryRun !== undefined && typeof input.dryRun !== 'boolean') {
    issues.push({
      code: 'invalid_type',
      path: '$.dryRun',
      message: 'RAG reindex dryRun 必须是布尔值',
      value: input.dryRun
    });
  }

  if (input.onlyMissing !== undefined && typeof input.onlyMissing !== 'boolean') {
    issues.push({
      code: 'invalid_type',
      path: '$.onlyMissing',
      message: 'RAG reindex onlyMissing 必须是布尔值',
      value: input.onlyMissing
    });
  }

  if (input.indexVersion !== undefined && typeof input.indexVersion !== 'string') {
    issues.push({
      code: 'invalid_type',
      path: '$.indexVersion',
      message: 'RAG reindex indexVersion 必须是字符串',
      value: input.indexVersion
    });
  }

  if (input.limit !== undefined && normalizeReindexLimit(input.limit) === undefined) {
    issues.push({
      code: 'invalid_type',
      path: '$.limit',
      message: 'RAG reindex limit 必须是有效数字',
      value: input.limit
    });
  }

  if (input.targetStorage !== undefined) {
    const target = text(input.targetStorage);
    if (!['jsonb_embedding', 'pgvector', 'dual'].includes(target)) {
      issues.push({
        code: 'invalid_item',
        path: '$.targetStorage',
        message: 'RAG reindex targetStorage 只能是 jsonb_embedding、pgvector 或 dual',
        value: input.targetStorage
      });
    }
  }

  return issues;
}

function invalidReindexResult(issues: RagInputIssue[]): RagReindexResult {
  return {
    status: 'invalid_input',
    targetStorage: 'jsonb_embedding',
    pgvectorEnabled: false,
    documentsScanned: 0,
    chunksScanned: 0,
    chunksUpdated: 0,
    chunksSkipped: 0,
    chunksFailed: 0,
    queued: 0,
    skipped: [],
    failed: [],
    issues,
    ...productizedRagRunMetadata()
  };
}

function validateSearchInput(value: unknown): RagInputIssue[] {
  const input = asRecord(value);
  const issues: RagInputIssue[] = [];

  if (!text(input.query)) {
    issues.push({
      code: 'missing_required_field',
      path: '$.query',
      message: 'RAG 显式检索入口缺少 query'
    });
  }

  if (input.categoryIds !== undefined && !Array.isArray(input.categoryIds)) {
    issues.push({
      code: 'invalid_type',
      path: '$.categoryIds',
      message: 'RAG 显式检索入口 categoryIds 必须是字符串数组',
      value: input.categoryIds
    });
  }

  if (input.documentIds !== undefined && !Array.isArray(input.documentIds)) {
    issues.push({
      code: 'invalid_type',
      path: '$.documentIds',
      message: 'RAG 显式检索入口 documentIds 必须是字符串数组',
      value: input.documentIds
    });
  }

  if (Array.isArray(input.categoryIds)) {
    input.categoryIds.forEach((item, index) => {
      if (!text(item)) {
        issues.push({
          code: 'invalid_item',
          path: `$.categoryIds[${index}]`,
          message: 'RAG 显式检索入口 categoryIds 不能包含空值',
          value: item
        });
      }
    });
  }

  if (Array.isArray(input.documentIds)) {
    input.documentIds.forEach((item, index) => {
      if (!text(item)) {
        issues.push({
          code: 'invalid_item',
          path: `$.documentIds[${index}]`,
          message: 'RAG 显式检索入口 documentIds 不能包含空值',
          value: item
        });
      }
    });
  }

  if (input.limit !== undefined && normalizeLimit(input.limit) === undefined) {
    issues.push({
      code: 'invalid_type',
      path: '$.limit',
      message: 'RAG 显式检索入口 limit 必须是有效数字',
      value: input.limit
    });
  }

  return issues;
}

function runtimeModeToMainPath(mode: RagRuntimeMode): RagMainPathMode {
  return mode === 'degraded' ? 'degraded' : mode;
}

function productizedRagRunMetadata(mode: RagRuntimeMode = 'fts') {
  return {
    mode: 'explicit' as const,
    mainPathMode: runtimeModeToMainPath(mode),
    defaultRouteEnabled: true as const,
    scheduleEnabled: false as const,
    productized: true as const,
    rebuildStatus: 'productized' as const
  };
}

function normalizeCoverageThreshold(value: number | undefined): number {
  const raw = typeof value === 'number' && Number.isFinite(value) ? value : 0.8;
  return raw <= 1 ? raw * 100 : raw;
}

function normalizeGateThreshold(value: unknown): number {
  const raw = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim()
      ? Number(value)
      : NaN;
  if (!Number.isFinite(raw)) return 0.8;
  return raw > 1 ? raw / 100 : Math.max(0, Math.min(1, raw));
}

function normalizeRegressionRate(value: unknown): number {
  const raw = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim()
      ? Number(value)
      : NaN;
  if (!Number.isFinite(raw)) return 0;
  return raw > 1 ? raw / 100 : Math.max(0, Math.min(1, raw));
}

function evalComparisonGate(comparison?: RagEvalComparison) {
  if (!comparison) return undefined;
  return {
    passed: comparison.gate.passed,
    passRate: comparison.gate.passRate,
    threshold: comparison.gate.threshold,
    baselinePassRate: comparison.gate.baselinePassRate,
    passRateDelta: comparison.gate.passRateDelta,
    maxRegressionRate: comparison.gate.maxRegressionRate,
    regressionRate: comparison.gate.regressionRate,
    reason: comparison.gate.reason
  };
}

function stableHash(value: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function evalPassRate(run: { summary?: Record<string, unknown> }): number {
  const raw = run.summary?.passRate;
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
}

function resolveFallbackReason(input: {
  configuredHybridEnabled: boolean;
  embedAvailable: boolean;
  pgvectorAvailable: boolean;
  pgvectorReason?: string;
  hasEnoughCoverage: boolean;
  dimensionMismatch: boolean;
  hasPendingWork: boolean;
}): string | undefined {
  if (!input.configuredHybridEnabled) return 'hybrid_disabled';
  if (!input.embedAvailable) return 'embedding_service_unavailable';
  if (input.dimensionMismatch) return 'dimension_mismatch';
  if (input.hasPendingWork) return 'embedding_jobs_pending';
  if (!input.hasEnoughCoverage) return 'vector_coverage_below_threshold';
  if (!input.pgvectorAvailable) return input.pgvectorReason || 'pgvector_unavailable_jsonb_fallback';
  return undefined;
}

export class RagRouteService {
  constructor(
    private readonly store: LocalStore,
    private readonly context: ServiceContext
  ) {}

  async getStatus() {
    const configService = await ConfigService.getInstance(this.store);
    const settings = configService.getSettings();
    const rag = resolveRagConfig(settings);
    const embed = resolveEmbeddingService(settings);
    const rerank = resolveRerankService(settings);
    const pgvector = await this.store.getKBVectorCapability();
    const coverageWithJobs = await this.store.getRagEmbeddingCoverageStats();
    const { jobStats, ...coverage } = coverageWithJobs;
    const configuredHybridEnabled = isHybridSearchEnabled(settings);
    const coverageThreshold = normalizeCoverageThreshold(rag.minVectorCoverageForHybrid);
    const hasEnoughCoverage = coverage.totalChunkCount === 0 || coverage.indexCoveragePercent >= coverageThreshold;
    const configuredDimensions = embed?.dimensions;
    const databaseDimensions = pgvector.dimensions;
    const dimensionMismatch = Boolean(
      configuredDimensions && databaseDimensions && configuredDimensions !== databaseDimensions
    );
    const hasPendingWork = coverage.pendingJobCount > 0 || coverage.runningJobCount > 0;
    const vectorStorageMode: RagVectorStorageMode = pgvector.available && configuredHybridEnabled && hasEnoughCoverage && !dimensionMismatch
      ? 'pgvector_active'
      : pgvector.available
        ? 'pgvector_available'
        : coverage.indexedChunkCount > 0
          ? 'jsonb_embedding'
          : 'unavailable';
    const fallbackReason = resolveFallbackReason({
      configuredHybridEnabled,
      embedAvailable: Boolean(embed),
      pgvectorAvailable: pgvector.available,
      pgvectorReason: pgvector.reason,
      hasEnoughCoverage,
      dimensionMismatch,
      hasPendingWork
    });
    const readiness: RagReadiness = !configuredHybridEnabled
      ? 'fts_only'
      : !embed
        ? 'degraded'
        : dimensionMismatch
          ? 'rebuild_required'
          : hasPendingWork
            ? 'indexing'
            : hasEnoughCoverage
              ? 'hybrid_ready'
              : 'degraded';
    const runtimeMode: RagRuntimeMode = readiness === 'hybrid_ready'
      ? (rag.rerankEnabled && rerank ? 'hybrid+rerank' : 'hybrid')
      : configuredHybridEnabled
        ? 'degraded'
        : 'fts';
    const synthesisAgentId = resolveRagSynthesisAgentId(rag);
    const plannerAgentId = resolveRagPlannerAgentId(rag);
    const synthesisAgent = synthesisAgentId ? await this.store.getAgent(synthesisAgentId) : null;
    const plannerAgentRecord =
      plannerAgentId && plannerAgentId !== synthesisAgentId
        ? await this.store.getAgent(plannerAgentId)
        : synthesisAgent;
    const contract: RagStatusContract = {
      mainPathMode: runtimeMode,
      runtimeMode,
      readiness,
      defaultRouteEnabled: true,
      explicitSearchEntryReady: true,
      configuredHybridEnabled,
      productized: true,
      rebuildRequired: readiness === 'rebuild_required',
      rebuildStatus: 'productized',
      vectorStorageMode,
      pgvectorEnabled: vectorStorageMode === 'pgvector_active',
      pgvectorAvailable: pgvector.available,
      pgvectorDimensions: pgvector.dimensions,
      fallbackReason,
      coverage,
      dimensions: {
        configured: configuredDimensions,
        actual: coverage.actualDimensions,
        database: databaseDimensions
      },
      lastReindexAt: coverage.lastIndexedAt,
      lastEmbeddingError: coverage.lastEmbeddingError,
      jobStats,
      inputContract: {
        required: ['query'],
        optional: ['categoryIds[]', 'documentIds[]', 'limit'],
        notes: '知识库主查询已接入统一检索；RAG 关闭或异常时自动回退 FTS。'
      },
      outputContract: {
        fields: ['answer', 'meta', 'sources'],
        notes: 'answer 保持兼容；meta 提供 retrievalMode、fallbackReason、plannerStages、retrievalStages 与耗时。'
      }
    };
    return {
      hybridEnabled: configuredHybridEnabled,
      ...contract,
      ragConfig: rag,
      synthesisAgent: {
        id: synthesisAgentId,
        name: synthesisAgent?.name || '',
        configured: Boolean(synthesisAgentId),
        found: Boolean(synthesisAgent),
        providerId: synthesisAgent?.providerId || '',
        model: synthesisAgent?.model || ''
      },
      plannerAgent: {
        id: plannerAgentId,
        name: plannerAgentRecord?.name || '',
        configured: Boolean(plannerAgentId),
        found: Boolean(plannerAgentRecord),
        providerId: plannerAgentRecord?.providerId || '',
        model: plannerAgentRecord?.model || ''
      },
      activeEmbeddingServiceId: settings.ACTIVE_EMBEDDING_SERVICE_ID || '',
      activeRerankServiceId: settings.ACTIVE_RERANK_SERVICE_ID || '',
      embeddingService: embed ? { id: embed.id, name: embed.name, model: embed.model, dimensions: embed.dimensions } : null,
      rerankService: rerank ? { id: rerank.id, name: rerank.name, model: rerank.model } : null,
      smallModelCount: (settings.SMALL_MODEL_SERVICES || []).length,
      message: fallbackReason
        ? `RAG 主链已启用，当前按 ${runtimeMode} 运行，降级原因：${fallbackReason}`
        : `RAG 主链已启用，当前按 ${runtimeMode} 运行。`
    };
  }

  async searchExplicit(input: unknown): Promise<RagExplicitSearchResult> {
    const issues = validateSearchInput(input);
    if (issues.length > 0) {
      return {
        status: 'invalid_input',
        issues,
        ...productizedRagRunMetadata()
      };
    }

    const configService = await ConfigService.getInstance(this.store);
    const settings = configService.getSettings();
    const normalized = normalizeSearchInput(input);
    const planner = new RagQueryPlanner(this.store, this.context.agentService, () => settings);
    const expansion = await planner.expand(normalized.query);
    const search = new KnowledgeRetrievalService(this.store, () => settings);
    const result = await search.search(normalized.query, {
      categoryIds: normalized.categoryIds,
      documentIds: normalized.documentIds,
      indexVersion: normalized.indexVersion,
      limit: normalized.limit || 5,
      queries: expansion.queries
    });
    const stages = [...expansion.stages, ...result.stages];

    return {
      status: 'success',
      retrievalMode: result.retrievalMode,
      fallbackReason: expansion.fallbackReason || result.fallbackReason,
      resultCount: result.rows.length,
      rows: result.rows,
      stages,
      durationMs: result.durationMs,
      evidence: result.evidence,
      traceId: result.trace.traceId,
      trace: {
        ...result.trace,
        fallbackReason: expansion.fallbackReason || result.trace.fallbackReason,
        retrievalStages: stages,
        metadata: {
          ...(result.trace.metadata || {}),
          queryExpansion: {
            queries: expansion.queries,
            hydeQuery: expansion.hydeQuery,
            multiQueryVariants: expansion.multiQueryVariants,
            fallbackReason: expansion.fallbackReason
          },
          retrievalStages: stages
        }
      },
      ...productizedRagRunMetadata(result.retrievalMode)
    };
  }

  async testService(input: { serviceId?: string; service?: SmallModelServiceConfig }) {
    const configService = await ConfigService.getInstance(this.store);
    const settings = configService.getSettings();
    const svc = this.resolveTestServiceConfig(input, settings);
    if (!svc) throw new Error('小模型服务配置无效');
    if (!svc.enabled) throw new Error(`小模型服务 ${svc.id} 未启用`);

    const dispatcher = svc.useProxy === true ? this.context.proxyAgent : undefined;
    const started = Date.now();
    if (svc.role === 'EMBEDDING') {
      const client = createEmbeddingClient(svc, { dispatcher });
      const vectors = await client.embed(['LinkLoom RAG connectivity test']);
      if (!vectors[0]?.length) throw new Error('Embedding 返回空向量');
      const actualDimensions = vectors[0].length;
      if (svc.dimensions && svc.dimensions !== actualDimensions) {
        throw new Error(
          `Embedding 返回维度 ${actualDimensions}，与配置的 ${svc.dimensions} 不一致`
        );
      }
      return {
        status: 'success',
        role: svc.role,
        dimensions: actualDimensions,
        configuredDimensions: svc.dimensions,
        durationMs: Date.now() - started
      };
    }

    const client = createRerankClient(svc, { dispatcher });
    const ranked = await client.rerank('test query', ['doc a', 'doc b']);
    return {
      status: 'success',
      role: svc.role,
      resultCount: ranked.length,
      durationMs: Date.now() - started
    };
  }

  private resolveTestServiceConfig(
    input: { serviceId?: string; service?: SmallModelServiceConfig },
    settings: SystemSettings
  ): SmallModelServiceConfig | undefined {
    if (input.service) {
      return resolveSmallModelConfigForRuntime(input.service, settings) as SmallModelServiceConfig;
    }
    const serviceId = input.serviceId?.trim();
    if (!serviceId) return undefined;
    const svc = (settings.SMALL_MODEL_SERVICES || []).find((item) => item.id === serviceId);
    if (!svc) throw new Error(`小模型服务 ${serviceId} 不存在`);
    return svc;
  }

  async reindexEmbeddings(input?: unknown): Promise<RagReindexResult> {
    const issues = validateReindexInput(input);
    if (issues.length > 0) return invalidReindexResult(issues);

    const configService = await ConfigService.getInstance(this.store);
    const settings = configService.getSettings();
    const embedSvc = resolveEmbeddingService(settings);
    const normalized = normalizeReindexInput(input);
    const pgvector = await this.store.getKBVectorCapability();
    const targetStorage = normalized.targetStorage || 'dual';
    const indexVersionRecord = normalized.indexVersion
      ? await this.store.getRagIndexVersion(normalized.indexVersion)
      : null;
    if (normalized.indexVersion && !indexVersionRecord) {
      return invalidReindexResult([{
        code: 'invalid_item',
        path: '$.indexVersion',
        message: 'RAG reindex indexVersion 必须指向已存在的候选索引版本',
        value: normalized.indexVersion
      }]);
    }
    if (indexVersionRecord && !['candidate', 'building'].includes(indexVersionRecord.status)) {
      return invalidReindexResult([{
        code: 'invalid_item',
        path: '$.indexVersion',
        message: 'RAG reindex indexVersion 只能绑定 candidate 或 building 状态',
        value: indexVersionRecord.status
      }]);
    }
    const buildIndexVersion = indexVersionRecord?.version;
    if (normalized.indexVersion && indexVersionRecord && !normalized.dryRun) {
      await this.store.markRagIndexVersionBuilding(indexVersionRecord.id);
    }
    const wantsPgvector = targetStorage === 'pgvector' || targetStorage === 'dual';
    const pgvectorEnabled = wantsPgvector && pgvector.available;
    const base = {
      targetStorage,
      pgvectorEnabled,
      ...productizedRagRunMetadata()
    };

    if (!embedSvc) {
      return {
        status: 'disabled',
        documentsScanned: 0,
        chunksScanned: 0,
        chunksUpdated: 0,
        chunksSkipped: 0,
        chunksFailed: 0,
        queued: 0,
        skipped: [],
        failed: [],
        message: '未配置可用 embedding 服务，reindex 未入队。',
        ...base
      };
    }

    const ingest = new RagEmbeddingIngestService(this.store);
    const result = await ingest.enqueueByFilter({
      categoryId: normalized.categoryId,
      categoryIds: normalized.categoryIds,
      documentId: normalized.documentId,
      documentIds: normalized.documentIds,
      indexVersion: buildIndexVersion,
      limit: normalized.limit,
      onlyMissing: normalized.onlyMissing,
      targetStorage,
      dryRun: normalized.dryRun
    });
    const skipped: RagReindexResult['skipped'] = [];
    if (wantsPgvector && !pgvector.available) {
      skipped.push({
        chunkId: '*',
        reason: pgvector.reason || 'pgvector_unavailable_jsonb_fallback'
      });
    }

    return {
      status: normalized.dryRun ? 'success' : 'queued',
      documentsScanned: result.documentsScanned,
      chunksScanned: result.chunksScanned,
      chunksUpdated: 0,
      chunksSkipped: result.skipped,
      chunksFailed: 0,
      queued: result.queued,
      alreadyIndexed: result.alreadyIndexed,
      skipped,
      failed: [],
      dryRun: normalized.dryRun,
      message: normalized.dryRun
        ? 'dryRun 已完成，未创建 embedding job。'
        : `已入队 ${result.queued} 个 embedding job。`,
      ...base
    };
  }

  async runEmbeddingJobsOnce(input?: unknown) {
    const configService = await ConfigService.getInstance(this.store);
    const settings = configService.getSettings();
    const limit = normalizeReindexLimit(asRecord(input).limit);
    return new RagEmbeddingJobRunner(this.store, () => settings).runOnce({ limit });
  }

  async listEmbeddingJobs(input?: unknown) {
    const raw = asRecord(input);
    const status = text(raw.status);
    const limit = normalizeReindexLimit(raw.limit);
    const jobStatus = ['pending', 'running', 'success', 'skipped', 'failed'].includes(status)
      ? status as RagEmbeddingJobStatus
      : undefined;
    const jobs = await this.store.listRagEmbeddingJobs({
      status: jobStatus,
      limit
    });
    return {
      jobs: jobs.map((job) => ({
        id: job.id,
        chunkId: job.chunkId,
        documentId: job.documentId,
        sourceType: job.sourceType,
        sourceId: job.sourceId,
        unitId: job.unitId,
        parentId: job.parentId,
        indexVersion: job.indexVersion,
        contentHash: job.contentHash,
        targetStorage: job.targetStorage,
        status: job.status,
        attempts: job.attempts,
        lastError: job.lastError,
        lockedAt: job.lockedAt,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt
      }))
    };
  }

  async listIndexVersions(input?: unknown) {
    const raw = asRecord(input);
    const versions = await this.store.listRagIndexVersions({
      sourceType: text(raw.sourceType) || undefined,
      sourceId: text(raw.sourceId) || undefined,
      status: text(raw.status) || undefined,
      limit: normalizeReindexLimit(raw.limit)
    });
    const active = await this.store.getActiveRagIndexVersion(
      text(raw.sourceType) || 'knowledge',
      text(raw.sourceId) || 'knowledge'
    );
    return {
      versions,
      active,
      candidates: versions.filter((version) => ['candidate', 'building'].includes(version.status)),
      history: versions.filter((version) => !['candidate', 'building', 'active'].includes(version.status))
    };
  }

  async createIndexVersion(input?: unknown) {
    const raw = asRecord(input);
    const configService = await ConfigService.getInstance(this.store);
    const settings = configService.getSettings();
    const rag = resolveRagConfig(settings);
    const embed = resolveEmbeddingService(settings);
    const chunkerVersion = [
      rag.chunkStrategy,
      rag.chunkSize,
      rag.chunkOverlap,
      rag.semanticMaxChunkSize,
      rag.semanticMinChunkSize,
      rag.semanticBreakpointPercentile
    ].join(':');
    const embeddingConfig = {
      providerId: settings.ACTIVE_EMBEDDING_SERVICE_ID || '',
      model: embed?.model || '',
      dimensions: embed?.dimensions || 0
    };
    const embeddingConfigHash = stableHash(embeddingConfig);
    const version = createCandidateIndexVersion({
      sourceId: text(raw.sourceId) || 'knowledge',
      chunkerVersion,
      embeddingProviderId: embeddingConfig.providerId,
      embeddingConfigHash,
      metadata: {
        ...asRecord(raw.metadata),
        lifecycle: 'candidate',
        embeddingConfig
      }
    });
    await this.store.upsertRagIndexVersion(version);
    return { version };
  }

  async evaluateIndexVersion(input?: unknown): Promise<RagIndexVersionEvaluateResult> {
    const raw = asRecord(input);
    const idOrVersion = text(raw.indexVersion) || text(raw.versionId) || text(raw.id);
    const datasetId = text(raw.datasetId);
    if (!idOrVersion) throw new Error('indexVersion is required');
    if (!datasetId) throw new Error('datasetId is required');
    const version = await this.store.getRagIndexVersion(idOrVersion);
    if (!version) throw new Error(`RAG index version ${idOrVersion} not found`);

    const configService = await ConfigService.getInstance(this.store);
    const settings = configService.getSettings();
    const evalService = new RagEvalService(this.store);
    const run = await evalService.runDataset({
      datasetId,
      indexVersion: version.version,
      getSettings: () => settings,
      limit: normalizeLimit(raw.limit) || 5
    });
    const threshold = normalizeGateThreshold(raw.threshold);
    const maxRegressionRate = normalizeRegressionRate(raw.maxRegressionRate);
    const baselineRunId = text(raw.baselineRunId) || undefined;
    const baselineIndexVersion = text(raw.baselineIndexVersion) || undefined;
    const comparison = baselineRunId || baselineIndexVersion
      ? await evalService.compareRuns({
        datasetId,
        baselineRunId,
        baselineIndexVersion,
        candidateRunId: run.id,
        threshold,
        maxRegressionRate
      })
      : undefined;
    const passRate = evalPassRate(run);
    const gate = comparison
      ? evalComparisonGate(comparison)!
      : { passed: passRate >= threshold, passRate, threshold };
    const updated = await this.store.attachEvalToRagIndexVersion(version.id, {
      passed: gate.passed,
      passRate,
      threshold,
      maxRegressionRate,
      runId: run.id,
      datasetId: run.datasetId,
      comparison: comparison ? {
        baselineRunId: comparison.baselineRun.id,
        candidateRunId: comparison.candidateRun.id,
        metrics: comparison.metrics,
        gate: comparison.gate
      } : undefined,
      evaluatedAt: Date.now()
    });
    if (!updated) throw new Error(`RAG index version ${idOrVersion} not found`);
    return { version: updated, run, comparison, gate };
  }

  async activateIndexVersion(input?: unknown): Promise<RagIndexVersionActivationResult> {
    const raw = asRecord(input);
    const idOrVersion = text(raw.indexVersion) || text(raw.versionId) || text(raw.id);
    if (!idOrVersion) throw new Error('indexVersion is required');
    const force = normalizeBoolean(raw.force) === true;
    const threshold = normalizeGateThreshold(raw.threshold);
    const maxRegressionRate = normalizeRegressionRate(raw.maxRegressionRate);
    const version = await this.store.getRagIndexVersion(idOrVersion);
    if (!version) throw new Error(`RAG index version ${idOrVersion} not found`);

    const runs = await this.store.listRagEvalRuns(undefined, { indexVersion: version.version, limit: 1 });
    const latestRun = runs[0];
    const storedPassRate = typeof version.evalResult?.passRate === 'number'
      ? version.evalResult.passRate
      : undefined;
    const evalRunId = latestRun?.id || text(version.evalResult?.runId);
    const passRate = latestRun ? evalPassRate(latestRun) : storedPassRate;
    const storedComparison = asRecord(version.evalResult?.comparison);
    const baselineRunId = text(raw.baselineRunId) || text(storedComparison.baselineRunId);
    const baselineIndexVersion = text(raw.baselineIndexVersion);
    const comparison = latestRun && (baselineRunId || baselineIndexVersion)
      ? await new RagEvalService(this.store).compareRuns({
        datasetId: latestRun.datasetId,
        baselineRunId: baselineRunId || undefined,
        baselineIndexVersion: baselineIndexVersion || undefined,
        candidateRunId: latestRun.id,
        threshold,
        maxRegressionRate
      })
      : undefined;
    const comparisonGate = evalComparisonGate(comparison);
    const passed = comparisonGate
      ? comparisonGate.passed
      : Boolean(evalRunId) && (
        passRate !== undefined
          ? passRate >= threshold
          : Boolean(version.evalResult?.passed)
      );
    const gate: NonNullable<RagIndexVersionActivationResult['gate']> = comparisonGate
      ? { ...comparisonGate, force }
      : {
        passed,
        force,
        passRate,
        threshold,
        baselinePassRate: undefined,
        passRateDelta: undefined,
        maxRegressionRate,
        regressionRate: undefined,
        reason: passed
          ? undefined
          : latestRun ? 'eval_below_threshold' : 'missing_eval_run'
      };
    if (!passed && !force) {
      return {
        status: 'rejected',
        version,
        run: latestRun,
        comparison,
        gate,
        message: latestRun ? '索引版本评估未达标，拒绝激活。' : '索引版本缺少 eval run，拒绝激活。'
      };
    }

    const activated = await this.store.activateRagIndexVersion(version.id, {
      activationReason: force && !passed ? 'forced_without_passing_gate' : 'eval_gate_passed',
      force,
      gatePassed: passed,
      gateThreshold: gate.threshold,
      gatePassRate: gate.passRate,
      gateBaselinePassRate: gate.baselinePassRate,
      gatePassRateDelta: gate.passRateDelta,
      gateMaxRegressionRate: gate.maxRegressionRate,
      gateRegressionRate: gate.regressionRate,
      gateReason: gate.reason,
      evalRunId,
      activatedBy: 'rag_route_service'
    });
    if (!activated) throw new Error(`RAG index version ${idOrVersion} not found`);
    return {
      status: 'active',
      version: activated.version,
      previousActiveVersion: activated.previousActiveVersion,
      run: latestRun,
      comparison,
      gate
    };
  }

  async rollbackIndexVersion(input?: unknown): Promise<RagIndexVersionActivationResult> {
    const raw = asRecord(input);
    const sourceType = text(raw.sourceType) || 'knowledge';
    const sourceId = text(raw.sourceId) || 'knowledge';
    const result = await this.store.rollbackRagIndexVersion(sourceType, sourceId);
    if (!result) {
      return {
        status: 'rejected',
        gate: { passed: false, reason: 'no_evaluated_rollback_target' },
        message: '没有可回滚的已通过评估索引版本。'
      };
    }
    return {
      status: 'rolled_back',
      version: result.version,
      previousActiveVersion: result.previousActiveVersion,
      gate: { passed: true }
    };
  }

  async listTraces(input?: unknown) {
    const limit = normalizeReindexLimit(asRecord(input).limit) || 20;
    return { traces: await this.store.listRagQueryTraces({ limit }) };
  }

  async getTrace(input?: unknown) {
    const traceId = text(asRecord(input).traceId);
    if (!traceId) throw new Error('traceId is required');
    return { trace: await this.store.getRagQueryTrace(traceId) };
  }

  async createEvalDataset(input?: unknown) {
    const raw = asRecord(input);
    const name = text(raw.name);
    if (!name) throw new Error('name is required');
    return {
      dataset: await new RagEvalService(this.store).createDataset({
        name,
        description: text(raw.description) || undefined,
        cases: Array.isArray(raw.cases) ? raw.cases : [],
        metadata: asRecord(raw.metadata)
      })
    };
  }

  async listEvalDatasets() {
    return { datasets: await new RagEvalService(this.store).listDatasets() };
  }

  async runEvalDataset(input?: unknown) {
    const raw = asRecord(input);
    const datasetId = text(raw.datasetId);
    if (!datasetId) throw new Error('datasetId is required');
    const configService = await ConfigService.getInstance(this.store);
    const settings = configService.getSettings();
    const idOrVersion = text(raw.indexVersion) || undefined;
    const version = idOrVersion ? await this.store.getRagIndexVersion(idOrVersion) : null;
    const evalService = new RagEvalService(this.store);
    const run = await evalService.runDataset({
      datasetId,
      indexVersion: version?.version || idOrVersion,
      getSettings: () => settings,
      limit: normalizeLimit(raw.limit) || 5
    });
    const threshold = normalizeGateThreshold(raw.threshold);
    const maxRegressionRate = normalizeRegressionRate(raw.maxRegressionRate);
    const baselineRunId = text(raw.baselineRunId) || undefined;
    const baselineIndexVersion = text(raw.baselineIndexVersion) || undefined;
    const comparison = baselineRunId || baselineIndexVersion
      ? await evalService.compareRuns({
        datasetId,
        baselineRunId,
        baselineIndexVersion,
        candidateRunId: run.id,
        threshold,
        maxRegressionRate
      })
      : undefined;
    if (version) {
      const passRate = evalPassRate(run);
      const gate = comparison ? comparison.gate : { passed: passRate >= threshold, passRate, threshold };
      await this.store.attachEvalToRagIndexVersion(version.id, {
        passed: gate.passed,
        passRate,
        threshold,
        maxRegressionRate,
        runId: run.id,
        datasetId: run.datasetId,
        comparison: comparison ? {
          baselineRunId: comparison.baselineRun.id,
          candidateRunId: comparison.candidateRun.id,
          metrics: comparison.metrics,
          gate: comparison.gate
        } : undefined,
        evaluatedAt: Date.now()
      });
    }
    return { run, comparison };
  }

  async listEvalRuns(input?: unknown) {
    const raw = asRecord(input);
    const datasetId = text(raw.datasetId) || undefined;
    const idOrVersion = text(raw.indexVersion) || undefined;
    const version = idOrVersion ? await this.store.getRagIndexVersion(idOrVersion) : null;
    return {
      runs: await new RagEvalService(this.store).listRuns(datasetId, {
        indexVersion: version?.version || idOrVersion,
        limit: normalizeReindexLimit(raw.limit)
      })
    };
  }

  async compareEvalRuns(input?: unknown) {
    const raw = asRecord(input);
    const datasetId = text(raw.datasetId) || undefined;
    const baselineIndex = text(raw.baselineIndexVersion) || undefined;
    const candidateIndex = text(raw.candidateIndexVersion) || text(raw.indexVersion) || undefined;
    const baselineVersion = baselineIndex ? await this.store.getRagIndexVersion(baselineIndex) : null;
    const candidateVersion = candidateIndex ? await this.store.getRagIndexVersion(candidateIndex) : null;
    const comparison = await new RagEvalService(this.store).compareRuns({
      datasetId,
      baselineRunId: text(raw.baselineRunId) || undefined,
      candidateRunId: text(raw.candidateRunId) || undefined,
      baselineIndexVersion: baselineVersion?.version || baselineIndex,
      candidateIndexVersion: candidateVersion?.version || candidateIndex,
      threshold: normalizeGateThreshold(raw.threshold),
      maxRegressionRate: normalizeRegressionRate(raw.maxRegressionRate)
    });
    return { comparison };
  }
}
