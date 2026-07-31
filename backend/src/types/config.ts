export type OpenAIApiEndpointMode =
  | 'auto'
  | 'chat_completions'
  | 'responses'
  | 'messages'
  | 'passthrough';
export type ReasoningEffort = 'none' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export interface ProviderModelCostConfig {
  inputUsdPer1M?: number;
  cachedInputUsdPer1M?: number;
  outputUsdPer1M?: number;
}

export interface ProviderGovernanceRetryConfig {
  maxAttempts?: number;
  backoffMs?: number;
  retryOn?: string[];
}

export interface ProviderGovernanceHealthConfig {
  failureThreshold?: number;
  cooldownMs?: number;
}

export interface ProviderGovernanceQuotaConfig {
  maxModelCalls?: number;
  maxInputTokens?: number;
  maxOutputTokens?: number;
  maxCostUsd?: number;
  timeoutMs?: number;
}

export interface ProviderGovernanceFallbackConfig {
  providerId?: string;
  model?: string;
  requiredCapabilities?: string[];
}

export interface ProviderGovernanceModelConfig {
  capabilities?: string[];
  cost?: ProviderModelCostConfig;
}

export interface ProviderGovernanceConfig {
  enabled?: boolean;
  retry?: ProviderGovernanceRetryConfig;
  health?: ProviderGovernanceHealthConfig;
  quotas?: ProviderGovernanceQuotaConfig;
  fallbacks?: ProviderGovernanceFallbackConfig[];
  models?: Record<string, ProviderGovernanceModelConfig>;
}

export interface AgentRunConfig {
  maxConcurrentRuns?: number;
  queueLeaseStaleMs?: number;
  pendingQueueRecoveryStaleMs?: number;
}

export interface AIProviderConfig {
  id: string;
  name: string;
  type: 'GEMINI' | 'CLAUDE' | 'OPENAI' | 'GLM' | 'OLLAMA';
  apiUrl: string;
  apiKey: string;
  models: string[];
  enabled: boolean;
  useProxy: boolean;
  /** OpenAI-compatible endpoint preference (OPENAI / GLM only) */
  apiEndpoint?: OpenAIApiEndpointMode;
  /** Reasoning / thinking intensity for compatible APIs */
  reasoningEffort?: ReasoningEffort;
  /** Optional model capability hints used by LinkLoom Provider Governance. */
  modelCapabilities?: Record<string, string[]>;
  /** Optional per-model cost hints used by LinkLoom Provider Governance. */
  modelCosts?: Record<string, ProviderModelCostConfig>;
}

export interface AdapterItemConfig {
  id: string;
  name: string;
  enabled: boolean;
  useProxy: boolean;
  category?: string;
  since?: string;
  listId?: string;
  feedId?: string;
  fetchPages?: number;
  enableTranslation?: boolean;
  // RSS fields
  rssUrl?: string;
  limit?: number;
  /** Follow API：单次列表 body.limit，默认 40，最大 500 */
  entryLimit?: number;
  // AI Search fields
  keyword?: string;
  executorId?: string;
}

export interface AdapterConfig {
  id: string;
  name: string;
  category?: string;
  adapterType: 'GitHubTrendingAdapter' | 'FollowApiAdapter' | 'AISearchAdapter' | 'RSSAdapter';
  enabled: boolean;
  apiUrl: string;
  fetchDays?: number;
  foloCookie?: string;
  items: AdapterItemConfig[];
}

export interface PublisherConfig {
  id: string;
  enabled: boolean;
  config: Record<string, any>;
}

export interface StorageConfig {
  id: string;
  enabled: boolean;
  config: Record<string, any>;
}

export interface CategoryConfig {
  id: string;
  label: string;
  icon: string;
}

export type EditorialModeSetting = 'standard' | 'conservative';

export type SourceTierSetting = 'official' | 'mainstream' | 'community' | 'aggregator' | 'unknown';

export type SmallModelRole = 'EMBEDDING' | 'RERANK';

export type SmallModelBackend = 'OPENAI_COMPAT' | 'OLLAMA' | 'JINA' | 'COHERE' | 'LOCAL_HTTP';

export interface SmallModelServiceConfig {
  id: string;
  name: string;
  role: SmallModelRole;
  backend: SmallModelBackend;
  apiUrl: string;
  apiKey?: string;
  model: string;
  dimensions?: number;
  enabled: boolean;
  useProxy: boolean;
}

export type RagChunkStrategy = 'fixed' | 'structure' | 'embedding';

export interface RagConfig {
  hybridEnabled: boolean;
  ftsWeight: number;
  vectorWeight: number;
  retrievalTopK: number;
  rerankEnabled: boolean;
  rerankTopK: number;
  mmrEnabled: boolean;
  mmrLambda: number;
  queryRewriteEnabled: boolean;
  queryExpansionMaxQueries?: number;
  embedOnIngest: boolean;
  reindexOnServiceChange: boolean;
  embeddingBatchSize: number;
  embeddingConcurrency: number;
  embeddingMaxAttempts: number;
  plannerMaxCategories: number;
  plannerMaxDocuments: number;
  minVectorCoverageForHybrid: number;
  jsonbVectorFallbackEnabled: boolean;
  chunkStrategy: RagChunkStrategy;
  chunkSize: number;
  chunkOverlap: number;
  semanticMaxChunkSize: number;
  semanticMinChunkSize: number;
  semanticBreakpointPercentile: number;
  /** 知识库检索汇总、文档摘要使用的智能体 ID */
  synthesisAgentId?: string;
  /** Query Planner 使用的智能体 ID；留空则复用 synthesisAgentId */
  plannerAgentId?: string;
}

export interface EditorialConfig {
  titleDedupThreshold: number;
  defaultEditorialMode: EditorialModeSetting;
  sourceTierOverrides: Record<string, SourceTierSetting>;
  crossDayLookbackDays?: number;
  crossDayUrlHardDrop?: boolean;
  crossDayTitleSimilarityThreshold?: number;
  ingestToMemoryOnPublish?: boolean;
  ingestToKnowledgeOnPublish?: boolean;
  knowledgeCategoryName?: string;
  memoryCategoryName?: string;
  knowledgeCategoryId?: string;
  memoryCategoryId?: string;
}

export type HotMergeMode = 'rules' | 'semantic' | 'hybrid' | 'llm';

export interface HotConfig {
  /** rules = scored soft-merge; semantic = embedding; hybrid = rules then embedding candidates; llm = LLM cluster-fingerprint judge */
  mergeMode: HotMergeMode;
  /** Empty → ACTIVE_EMBEDDING_SERVICE_ID */
  embeddingServiceId: string;
  /** Cosine similarity floor for semantic / hybrid embedding pass */
  similarityMin: number;
  /** LLM mode: dedicated provider id (empty → ACTIVE_AI_PROVIDER_ID) */
  llmProviderId?: string;
  /** LLM mode: dedicated model id (empty → provider default) */
  llmModelId?: string;
  /** LLM mode: max pairwise judgments per merge run (circuit breaker, default 50) */
  llmMaxJudgmentsPerRun?: number;
  /** LLM mode: judgment cache TTL in minutes (default 360 = 6h) */
  llmCacheTtlMinutes?: number;
}

export interface SystemSettings {
  ACTIVE_AI_PROVIDER_ID: string;
  AI_PROVIDERS: AIProviderConfig[];
  ACTIVE_EMBEDDING_SERVICE_ID?: string;
  ACTIVE_RERANK_SERVICE_ID?: string;
  SMALL_MODEL_SERVICES?: SmallModelServiceConfig[];
  RAG_CONFIG?: RagConfig;
  PROVIDER_GOVERNANCE?: ProviderGovernanceConfig;
  AGENT_RUN_CONFIG?: AgentRunConfig;
  PUBLISHERS: PublisherConfig[];
  STORAGES: StorageConfig[];
  SYSTEM_PASSWORD?: string;
  AUTH_EXPIRE_TIME: string;
  API_PROXY: string;
  IMAGE_PROXY: string;
  ADAPTERS: AdapterConfig[];
  CLOSED_PLUGINS?: string[];
  CATEGORIES: CategoryConfig[];
  SELECTION_FETCH_DAYS: number;
  SELECTION_QUERY_FIELD: 'ingestion_date' | 'published_date';
  EDITORIAL_CONFIG?: EditorialConfig;
  HOT_CONFIG?: HotConfig;
  [key: string]: any; // Allow for dynamic extension
}
