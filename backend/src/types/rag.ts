export type RagMainPathMode = 'fts' | 'hybrid' | 'hybrid+rerank' | 'degraded';

export type RagSourceType = 'knowledge';

export type RagSourceCapability = 'fts' | 'vector' | 'rerank' | 'citation';

export interface RagRetrievalSource {
  sourceType: RagSourceType;
  sourceId: string;
  displayName: string;
  capabilities: RagSourceCapability[];
  metadata?: Record<string, unknown>;
}

export interface RagSourceFilter {
  sourceType?: RagSourceType;
  sourceIds?: string[];
  parentIds?: string[];
  unitIds?: string[];
  metadata?: Record<string, unknown>;
}

export interface RagRetrievalUnit {
  unitId: string;
  sourceType: RagSourceType;
  sourceId: string;
  parentId?: string;
  text: string;
  title?: string;
  path?: string;
  timestamp?: number;
  version?: string;
  score?: number;
  metadata?: Record<string, unknown>;
}

export interface RagEvidence {
  evidenceId: string;
  sourceType: RagSourceType;
  sourceId: string;
  unitId: string;
  parentId?: string;
  content: string;
  citationLabel: string;
  score?: number;
  metadata?: Record<string, unknown>;
}

export interface RagContextBlock {
  evidenceId: string;
  citationLabel: string;
  content: string;
  sourceType: RagSourceType;
  unitId: string;
  parentId?: string;
}

export interface RagContextBuildResult {
  context: string;
  blocks: RagContextBlock[];
  usedEvidenceIds: string[];
  droppedEvidenceIds: string[];
  tokenEstimate: number;
}

export type RagCitationFailureReason = 'no_evidence' | 'missing_citation' | 'citation_not_found';

export interface RagCitationCheckResult {
  ok: boolean;
  citationIds: string[];
  missingCitationIds: string[];
  coverage: number;
  reason?: RagCitationFailureReason;
}

export type RagCitationDecisionAction = 'accept' | 'retry' | 'refuse';

export type RagCitationDecisionReason = RagCitationFailureReason | 'citation_retry_succeeded';

export interface RagCitationDecision {
  action: RagCitationDecisionAction;
  retryCount: number;
  citationCheck: RagCitationCheckResult;
  reason?: RagCitationDecisionReason;
  previousChecks?: RagCitationCheckResult[];
  message?: string;
}

export interface RagRetrievalTrace {
  traceId: string;
  requestId?: string;
  agentRunId?: string;
  runId?: string;
  workflowRunId?: string;
  stepId?: string;
  toolCallId?: string;
  originalQuery: string;
  rewrittenQueries: string[];
  filters: RagSourceFilter[];
  retrievedUnitIds: string[];
  rerankedUnitIds: string[];
  selectedEvidenceIds: string[];
  retrievalMode?: RagExplicitRetrievalMode;
  fallbackReason?: string;
  retrievalStages?: RagRetrievalStage[];
  finalContext?: string;
  answer?: string;
  citationIds: string[];
  latencyMs?: number;
  tokenUsage?: Record<string, unknown>;
  sourceTypeBreakdown: Record<RagSourceType, number>;
  metadata?: Record<string, unknown>;
}

export type RagIndexVersionStatus = 'candidate' | 'building' | 'evaluated' | 'active' | 'rolled_back' | 'failed';

export interface RagIndexVersion {
  id: string;
  sourceType: RagSourceType;
  sourceId: string;
  version: string;
  status: RagIndexVersionStatus;
  chunkerVersion?: string;
  embeddingProviderId?: string;
  embeddingConfigHash?: string;
  evalResult?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  activatedAt?: number;
}

export interface RagEvalCase {
  id: string;
  datasetId: string;
  question: string;
  expectedAnswer?: string;
  expectedEvidenceIds?: string[];
  allowedSourceTypes?: RagSourceType[];
  allowedSourceIds?: string[];
  allowedParentIds?: string[];
  allowedUnitIds?: string[];
  difficulty?: string;
  category?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface RagEvalDataset {
  id: string;
  name: string;
  description?: string;
  cases: RagEvalCase[];
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface RagEvalScore {
  caseId: string;
  recallAtK?: number;
  precisionAtK?: number;
  mrr?: number;
  hitRate?: number;
  citationAccuracy?: number;
  refusalAccuracy?: number;
  answerContains?: boolean;
  passed?: boolean;
  metadata?: Record<string, unknown>;
}

export interface RagEvalRun {
  id: string;
  datasetId: string;
  indexVersion?: string;
  scores: RagEvalScore[];
  summary: Record<string, unknown>;
  createdAt: number;
}

export type RagEvalCaseComparisonStatus =
  | 'improved'
  | 'regressed'
  | 'unchanged'
  | 'new_case'
  | 'missing_candidate';

export interface RagEvalCaseComparison {
  caseId: string;
  status: RagEvalCaseComparisonStatus;
  baselinePassed?: boolean;
  candidatePassed?: boolean;
  delta?: Record<string, number>;
}

export interface RagEvalComparison {
  datasetId: string;
  baselineRun: RagEvalRun;
  candidateRun: RagEvalRun;
  metrics: {
    baseline: Record<string, number>;
    candidate: Record<string, number>;
    delta: Record<string, number>;
  };
  cases: RagEvalCaseComparison[];
  gate: {
    passed: boolean;
    threshold: number;
    passRate: number;
    baselinePassRate: number;
    passRateDelta: number;
    maxRegressionRate: number;
    regressionRate: number;
    reason?: string;
  };
}

export type RagKnowledgeScopeSource = 'agent' | 'workflow' | 'step' | 'explicit';

export interface RagKnowledgeScope {
  allowedCategoryIds?: string[];
  allowedDocumentIds?: string[];
  scopeSource?: RagKnowledgeScopeSource;
  emptyScopePolicy?: 'allow_all' | 'deny_all';
}

export type RagExplicitRetrievalMode = 'fts' | 'hybrid' | 'hybrid+rerank';

export type RagRuntimeMode = 'fts' | 'hybrid' | 'hybrid+rerank' | 'degraded';

export type RagReadiness =
  | 'disabled'
  | 'fts_only'
  | 'indexing'
  | 'hybrid_ready'
  | 'degraded'
  | 'rebuild_required';

export type RagVectorStorageMode =
  | 'jsonb_embedding'
  | 'pgvector_available'
  | 'pgvector_active'
  | 'unavailable';

export type RagReindexTargetStorage = 'jsonb_embedding' | 'pgvector' | 'dual';

export type RagEmbeddingJobStatus = 'pending' | 'running' | 'success' | 'skipped' | 'failed';

export type RagRebuildStatus = 'isolated' | 'explicit_entry_ready' | 'productized';

export type RagInputIssueCode =
  | 'missing_required_field'
  | 'invalid_type'
  | 'empty_array'
  | 'invalid_item';

export interface RagInputIssue {
  code: RagInputIssueCode;
  path: string;
  message: string;
  value?: unknown;
}

export interface RagExplicitSearchInput {
  query: string;
  categoryIds?: string[];
  documentIds?: string[];
  indexVersion?: string;
  limit?: number;
}

export interface RagIndexVersionActivationResult {
  status: 'active' | 'rejected' | 'rolled_back';
  version?: RagIndexVersion;
  previousActiveVersion?: RagIndexVersion;
  run?: RagEvalRun;
  comparison?: RagEvalComparison;
  gate?: {
    passed: boolean;
    force?: boolean;
    passRate?: number;
    threshold?: number;
    baselinePassRate?: number;
    passRateDelta?: number;
    maxRegressionRate?: number;
    regressionRate?: number;
    reason?: string;
  };
  message?: string;
}

export interface RagIndexVersionEvaluateResult {
  version: RagIndexVersion;
  run: RagEvalRun;
  comparison?: RagEvalComparison;
  gate: {
    passed: boolean;
    passRate: number;
    threshold: number;
    baselinePassRate?: number;
    passRateDelta?: number;
    maxRegressionRate?: number;
    regressionRate?: number;
    reason?: string;
  };
}

export interface RagReindexInput {
  categoryId?: string;
  categoryIds?: string[];
  documentId?: string;
  documentIds?: string[];
  indexVersion?: string;
  limit?: number;
  targetStorage?: RagReindexTargetStorage;
  dryRun?: boolean;
  onlyMissing?: boolean;
}

export interface RagReindexSkippedItem {
  chunkId: string;
  reason: string;
}

export interface RagReindexFailedItem {
  chunkId: string;
  error: string;
}

export interface RagRetrievalStage {
  name: string;
  status: 'success' | 'skipped' | 'failed';
  durationMs?: number;
  resultCount?: number;
  reason?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface RagPlannerStage {
  name: string;
  status: 'success' | 'skipped' | 'failed';
  durationMs?: number;
  reason?: string;
  outputCount?: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface RagCoverageStats {
  totalChunkCount: number;
  indexedChunkCount: number;
  failedChunkCount: number;
  pendingJobCount: number;
  runningJobCount: number;
  dimensionMismatchCount: number;
  indexCoveragePercent: number;
  lastIndexedAt?: number;
  lastEmbeddingError?: string;
  actualDimensions?: number;
}

export interface RagJobStats {
  pending: number;
  running: number;
  success: number;
  skipped: number;
  failed: number;
}

export interface RagEmbeddingJob {
  id: string;
  chunkId: string;
  documentId: string;
  sourceType: RagSourceType;
  sourceId: string;
  unitId: string;
  parentId?: string;
  indexVersion?: string;
  contentHash: string;
  targetStorage: RagReindexTargetStorage;
  status: RagEmbeddingJobStatus;
  attempts: number;
  lastError?: string;
  lockedAt?: number;
  createdAt: number;
  updatedAt: number;
  content?: string;
}

export interface RagReindexResult {
  status: 'queued' | 'success' | 'partial' | 'disabled' | 'invalid_input';
  mode: 'explicit';
  mainPathMode: RagMainPathMode;
  defaultRouteEnabled: boolean;
  scheduleEnabled: boolean;
  productized: boolean;
  rebuildStatus: RagRebuildStatus;
  targetStorage: RagReindexTargetStorage;
  pgvectorEnabled: boolean;
  documentsScanned: number;
  chunksScanned: number;
  chunksUpdated: number;
  chunksSkipped: number;
  chunksFailed: number;
  queued: number;
  skipped: RagReindexSkippedItem[];
  failed: RagReindexFailedItem[];
  alreadyIndexed?: number;
  dryRun?: boolean;
  message?: string;
  issues?: RagInputIssue[];
}

export interface RagExplicitSearchSuccess {
  status: 'success';
  mode: 'explicit';
  mainPathMode: RagMainPathMode;
  defaultRouteEnabled: boolean;
  scheduleEnabled: boolean;
  productized: boolean;
  rebuildStatus: RagRebuildStatus;
  retrievalMode: RagExplicitRetrievalMode;
  fallbackReason?: string;
  resultCount: number;
  rows: unknown[];
  evidence?: RagEvidence[];
  traceId?: string;
  trace?: RagRetrievalTrace;
  stages?: RagRetrievalStage[];
  durationMs?: number;
}

export interface RagExplicitSearchInvalidInput {
  status: 'invalid_input';
  mode: 'explicit';
  mainPathMode: RagMainPathMode;
  defaultRouteEnabled: boolean;
  scheduleEnabled: boolean;
  productized: boolean;
  rebuildStatus: RagRebuildStatus;
  issues: RagInputIssue[];
}

export type RagExplicitSearchResult =
  | RagExplicitSearchSuccess
  | RagExplicitSearchInvalidInput;

export interface RagStatusContract {
  mainPathMode: RagMainPathMode;
  runtimeMode: RagRuntimeMode;
  readiness: RagReadiness;
  defaultRouteEnabled: boolean;
  explicitSearchEntryReady: boolean;
  configuredHybridEnabled: boolean;
  productized: boolean;
  rebuildRequired: boolean;
  rebuildStatus: RagRebuildStatus;
  vectorStorageMode: RagVectorStorageMode;
  pgvectorEnabled: boolean;
  pgvectorAvailable: boolean;
  pgvectorDimensions?: number;
  fallbackReason?: string;
  coverage: RagCoverageStats;
  dimensions: {
    configured?: number;
    actual?: number;
    database?: number;
  };
  lastReindexAt?: number;
  lastEmbeddingError?: string;
  jobStats: RagJobStats;
  inputContract: {
    required: string[];
    optional: string[];
    notes: string;
  };
  outputContract: {
    fields: string[];
    notes: string;
  };
}
