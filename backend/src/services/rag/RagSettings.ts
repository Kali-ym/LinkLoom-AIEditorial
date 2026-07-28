import type {
  RagChunkStrategy,
  RagConfig,
  SmallModelServiceConfig,
  SystemSettings
} from '../../types/config.js';

export const DEFAULT_RAG_CONFIG: RagConfig = {
  hybridEnabled: false,
  ftsWeight: 0.5,
  vectorWeight: 0.5,
  retrievalTopK: 20,
  rerankEnabled: false,
  rerankTopK: 5,
  mmrEnabled: true,
  mmrLambda: 0.7,
  queryRewriteEnabled: false,
  queryExpansionMaxQueries: 5,
  embedOnIngest: true,
  reindexOnServiceChange: false,
  embeddingBatchSize: 16,
  embeddingConcurrency: 1,
  embeddingMaxAttempts: 3,
  plannerMaxCategories: 3,
  plannerMaxDocuments: 8,
  minVectorCoverageForHybrid: 0.8,
  jsonbVectorFallbackEnabled: true,
  chunkStrategy: 'structure',
  chunkSize: 3000,
  chunkOverlap: 400,
  semanticMaxChunkSize: 3000,
  semanticMinChunkSize: 200,
  semanticBreakpointPercentile: 85,
  synthesisAgentId: '',
  plannerAgentId: ''
};

export interface ChunkOptions {
  chunkStrategy: RagChunkStrategy;
  chunkSize: number;
  chunkOverlap: number;
  semanticMaxChunkSize: number;
  semanticMinChunkSize: number;
  semanticBreakpointPercentile: number;
  embeddingBatchSize: number;
}

function normalizeChunkStrategy(value: unknown): RagChunkStrategy {
  if (value === 'embedding' || value === 'structure' || value === 'fixed') {
    return value;
  }
  // 兼容旧配置：semantic 曾指标题/段落切分
  if (value === 'semantic') return 'structure';
  return 'fixed';
}

export function resolveChunkOptions(rag?: Partial<RagConfig> | null): ChunkOptions {
  const resolved = { ...DEFAULT_RAG_CONFIG, ...(rag || {}) };
  const chunkSize = Math.max(200, resolved.chunkSize || DEFAULT_RAG_CONFIG.chunkSize);
  return {
    chunkStrategy: normalizeChunkStrategy(resolved.chunkStrategy),
    chunkSize,
    chunkOverlap: Math.max(
      0,
      Math.min(resolved.chunkOverlap ?? DEFAULT_RAG_CONFIG.chunkOverlap, chunkSize - 1)
    ),
    semanticMaxChunkSize: Math.max(
      200,
      resolved.semanticMaxChunkSize || DEFAULT_RAG_CONFIG.semanticMaxChunkSize
    ),
    semanticMinChunkSize: Math.max(
      0,
      resolved.semanticMinChunkSize ?? DEFAULT_RAG_CONFIG.semanticMinChunkSize
    ),
    semanticBreakpointPercentile: Math.max(
      0,
      Math.min(100, resolved.semanticBreakpointPercentile ?? DEFAULT_RAG_CONFIG.semanticBreakpointPercentile)
    ),
    embeddingBatchSize: Math.max(1, resolved.embeddingBatchSize || DEFAULT_RAG_CONFIG.embeddingBatchSize)
  };
}

export function resolveRagConfig(settings?: SystemSettings | null): RagConfig {
  return { ...DEFAULT_RAG_CONFIG, ...(settings?.RAG_CONFIG || {}) };
}

export function resolveEmbeddingService(
  settings?: SystemSettings | null
): SmallModelServiceConfig | null {
  const id = settings?.ACTIVE_EMBEDDING_SERVICE_ID?.trim();
  if (!id) return null;
  return resolveEmbeddingServiceById(settings, id);
}

/** Resolve embedding service by explicit id (HOT_CONFIG.embeddingServiceId). */
export function resolveEmbeddingServiceById(
  settings: SystemSettings | null | undefined,
  serviceId: string
): SmallModelServiceConfig | null {
  const id = serviceId?.trim();
  if (!id) return null;
  const svc = (settings?.SMALL_MODEL_SERVICES || []).find((item) => item.id === id);
  if (!svc || !svc.enabled || svc.role !== 'EMBEDDING') return null;
  return svc;
}

export function resolveRerankService(settings?: SystemSettings | null): SmallModelServiceConfig | null {
  const id = settings?.ACTIVE_RERANK_SERVICE_ID?.trim();
  if (!id) return null;
  const svc = (settings?.SMALL_MODEL_SERVICES || []).find((item) => item.id === id);
  if (!svc || !svc.enabled || svc.role !== 'RERANK') return null;
  return svc;
}

export function isHybridSearchEnabled(settings?: SystemSettings | null): boolean {
  return resolveRagConfig(settings).hybridEnabled === true;
}

export function resolveRagSynthesisAgentId(rag?: Partial<RagConfig> | null): string {
  return String(rag?.synthesisAgentId || '').trim();
}

export function resolveRagPlannerAgentId(rag?: Partial<RagConfig> | null): string {
  const planner = String(rag?.plannerAgentId || '').trim();
  return planner || resolveRagSynthesisAgentId(rag);
}
