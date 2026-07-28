import { request } from './api';

export interface RagSearchExplicitRequest {
  query: string;
  categoryIds?: string[];
  documentIds?: string[];
  indexVersion?: string;
  limit?: number;
}

export interface RagEvidenceItem {
  id?: string;
  documentId?: string;
  chunkId?: string;
  title?: string;
  content?: string;
  score?: number;
  citation?: string;
  metadata?: Record<string, unknown>;
}

export interface RagSearchExplicitResult {
  status: string;
  retrievalMode?: string;
  fallbackReason?: string;
  resultCount?: number;
  rows?: unknown[];
  evidence?: RagEvidenceItem[];
  stages?: unknown[];
  durationMs?: number;
  traceId?: string;
  trace?: Record<string, unknown>;
  issues?: Array<{ code?: string; message?: string; path?: string }>;
}

export interface RagIndexVersion {
  id: string;
  version: string;
  status: string;
  sourceType?: string;
  sourceId?: string;
  chunkerVersion?: string;
  embeddingProviderId?: string;
  evalResult?: {
    passed?: boolean;
    passRate?: number;
    threshold?: number;
    runId?: string;
    datasetId?: string;
  };
  updatedAt?: number | string;
  metadata?: Record<string, unknown>;
}

export interface RagEvalDataset {
  id: string;
  name: string;
  description?: string;
  cases?: unknown[];
}

export interface RagEvalRun {
  id: string;
  datasetId: string;
  indexVersion?: string;
  summary?: {
    passRate?: number;
    hitRate?: number;
    recallAtK?: number;
    citationAccuracy?: number;
    mrr?: number;
    total?: number;
  };
  scores?: unknown[];
  createdAt?: number | string;
}

export interface RagReindexOptions {
  categoryId?: string;
  categoryIds?: string[];
  documentId?: string;
  documentIds?: string[];
  indexVersion?: string;
  limit?: number;
  targetStorage?: 'jsonb_embedding' | 'pgvector' | 'dual';
  dryRun?: boolean;
  onlyMissing?: boolean;
}

export const getRagStatus = () => request('/api/rag/status');

export const testRagService = (input: { serviceId?: string; service?: Record<string, unknown> }) =>
  request('/api/rag/test-service', { method: 'POST', body: JSON.stringify(input) });

export const searchRagExplicit = (body: RagSearchExplicitRequest): Promise<RagSearchExplicitResult> =>
  request('/api/rag/search-explicit', { method: 'POST', body: JSON.stringify(body) });

export const reindexRagEmbeddings = (body?: RagReindexOptions) =>
  request('/api/rag/reindex', { method: 'POST', body: JSON.stringify(body ?? {}) });

export const runRagEmbeddingJobsOnce = (body?: { limit?: number }) =>
  request('/api/rag/jobs/run-once', { method: 'POST', body: JSON.stringify(body ?? {}) });

export const getRagJobs = (params?: { status?: string; limit?: number }) => {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.limit) query.set('limit', String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return request(`/api/rag/jobs${suffix}`);
};

export const getRagTraces = (params?: { limit?: number }) => {
  const query = new URLSearchParams();
  if (params?.limit) query.set('limit', String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return request(`/api/rag/traces${suffix}`);
};

export const getRagTrace = (traceId: string) =>
  request(`/api/rag/traces/${encodeURIComponent(traceId)}`);

export const getRagIndexVersions = (params?: {
  sourceType?: string;
  sourceId?: string;
  status?: string;
  limit?: number;
}) => {
  const query = new URLSearchParams();
  if (params?.sourceType) query.set('sourceType', params.sourceType);
  if (params?.sourceId) query.set('sourceId', params.sourceId);
  if (params?.status) query.set('status', params.status);
  if (params?.limit) query.set('limit', String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return request(`/api/rag/index-versions${suffix}`);
};

export const createRagIndexVersion = (body?: { sourceId?: string; metadata?: Record<string, unknown> }) =>
  request('/api/rag/index-versions', { method: 'POST', body: JSON.stringify(body ?? {}) });

export const evaluateRagIndexVersion = (body: {
  indexVersion: string;
  datasetId: string;
  limit?: number;
  threshold?: number;
  maxRegressionRate?: number;
  baselineRunId?: string;
  baselineIndexVersion?: string;
}) =>
  request('/api/rag/index-versions/evaluate', { method: 'POST', body: JSON.stringify(body) });

export const activateRagIndexVersion = (body: {
  indexVersion: string;
  force?: boolean;
  threshold?: number;
  maxRegressionRate?: number;
  baselineRunId?: string;
  baselineIndexVersion?: string;
}) =>
  request('/api/rag/index-versions/activate', { method: 'POST', body: JSON.stringify(body) });

export const rollbackRagIndexVersion = (body?: { sourceType?: string; sourceId?: string }) =>
  request('/api/rag/index-versions/rollback', { method: 'POST', body: JSON.stringify(body ?? {}) });

export const getRagEvalDatasets = () => request('/api/rag/eval/datasets');

export const createRagEvalDataset = (body: {
  name: string;
  description?: string;
  cases?: unknown[];
  metadata?: Record<string, unknown>;
}) =>
  request('/api/rag/eval/datasets', { method: 'POST', body: JSON.stringify(body) });

export const runRagEval = (body: {
  datasetId: string;
  indexVersion?: string;
  limit?: number;
  threshold?: number;
  maxRegressionRate?: number;
  baselineRunId?: string;
  baselineIndexVersion?: string;
}) =>
  request('/api/rag/eval/run', { method: 'POST', body: JSON.stringify(body) });

export const compareRagEval = (body: {
  datasetId?: string;
  baselineRunId?: string;
  baselineIndexVersion?: string;
  candidateRunId?: string;
  candidateIndexVersion?: string;
  indexVersion?: string;
  threshold?: number;
  maxRegressionRate?: number;
}) =>
  request('/api/rag/eval/compare', { method: 'POST', body: JSON.stringify(body) });

export const getRagEvalRuns = (params?: { datasetId?: string; indexVersion?: string; limit?: number }) => {
  const query = new URLSearchParams();
  if (params?.datasetId) query.set('datasetId', params.datasetId);
  if (params?.indexVersion) query.set('indexVersion', params.indexVersion);
  if (params?.limit) query.set('limit', String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return request(`/api/rag/eval/runs${suffix}`);
};
