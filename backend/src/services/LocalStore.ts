import path from 'path';
import { resolveDatabaseUrl } from '../config/runtimeEnv.js';
import type { IStorePorts, MetadataFilter } from '../domain/ports/store.js';
import type { UnifiedData } from '../types/index.js';
import type {
  RagCoverageStats,
  RagEmbeddingJob,
  RagEmbeddingJobStatus,
  RagEvalDataset,
  RagEvalRun,
  RagIndexVersion,
  RagJobStats,
  RagReindexTargetStorage,
  RagRetrievalTrace
} from '../types/rag.js';
import { LogService } from './LogService.js';
import type { PgConnection } from './repositories/DatabaseConnection.js';
import { PgConnection as PgConnectionClass } from './repositories/DatabaseConnection.js';
import type { PgVectorCapability } from './repositories/KnowledgeRepository.js';
import { SchemaMigrator } from './repositories/SchemaMigrator.js';
import {
  createStoreRepositories,
  type StoreRepositories
} from './repositories/StoreRepositories.js';

/**
 * 持久化外观（facade）。
 *
 * - 内部委托给 `repositories/` 下按 bounded context 切分的 Repository。
 * - 实现 `IStorePorts` 联合 Port 接口（见 `domain/ports/store.ts`），消费方可以
 *   按 `IAgentStore` / `IFeedStore` 等更小契约声明依赖，从而减少与本类的耦合。
 * - 后端存储已切换为 PostgreSQL。
 */
export class LocalStore implements IStorePorts {
  private conn: PgConnection | null = null;
  private readonly databaseUrl: string;
  private readonly dataDir: string;
  public repositories!: StoreRepositories;

  constructor(databaseUrl?: string, dataDir?: string) {
    this.databaseUrl = databaseUrl || resolveDatabaseUrl();
    this.dataDir = dataDir || process.env.DATA_DIR || path.join(process.cwd(), 'data');
  }

  public getDbPath(): string {
    return this.databaseUrl;
  }

  public getDataDir(): string {
    return this.dataDir;
  }

  /** Underlying PostgreSQL connection, or null before init. Used for LISTEN/NOTIFY. */
  public getConnection(): PgConnection | null {
    return this.conn;
  }

  async init() {
    try {
      this.conn = new PgConnectionClass(this.databaseUrl || undefined);
      await new SchemaMigrator(this.conn).migrate();
      this.repositories = createStoreRepositories(this.conn, this.dataDir);
      LogService.info('Database initialized successfully');
    } catch (err: any) {
      LogService.error(`Failed to initialize database: ${err?.message || err}`);
      throw err;
    }
  }

  private get repos() {
    if (!this.repositories) {
      throw new Error('LocalStore has not been initialized');
    }
    return this.repositories;
  }

  async close(): Promise<void> {
    if (this.conn) {
      await this.conn.close();
      this.conn = null;
    }
  }

  async get(key: string): Promise<any> {
    return this.repos.config.get(key);
  }

  async put(key: string, value: any, expirationTtl?: number): Promise<void> {
    return this.repos.config.put(key, value, expirationTtl);
  }

  async delete(key: string): Promise<void> {
    return this.repos.config.delete(key);
  }

  async getAllKeys(): Promise<string[]> {
    return this.repos.config.getAllKeys();
  }

  async saveCommitHistory(record: {
    date: string;
    platform: string;
    filePath: string;
    commitMessage?: string;
    fullContent?: string;
  }): Promise<number> {
    return this.repos.history.save(record);
  }

  async getCommitHistoryById(id: number): Promise<any | null> {
    return this.repos.history.getById(id);
  }

  async getCommitHistory(options?: {
    date?: string;
    dates?: string[];
    platform?: string;
    limit?: number;
    offset?: number;
    search?: string;
  }): Promise<{ records: any[]; total: number }> {
    return this.repos.history.list(options);
  }

  async getCommittedDates(): Promise<string[]> {
    return this.repos.history.getCommittedDates();
  }

  async deleteCommitHistory(id: number): Promise<void> {
    return this.repos.history.delete(id);
  }

  getSkillsDir(): string {
    return this.repos.agents.getSkillsDir();
  }

  async saveAgent(agent: any): Promise<void> {
    return this.repos.agents.saveAgent(agent);
  }

  async getAgent(id: string): Promise<any> {
    return this.repos.agents.getAgent(id);
  }

  async listAgents(): Promise<any[]> {
    return this.repos.agents.listAgents();
  }

  async deleteAgent(id: string): Promise<void> {
    return this.repos.agents.deleteAgent(id);
  }

  async saveSkill(skill: any): Promise<void> {
    return this.repos.agents.saveSkill(skill);
  }

  async getSkill(id: string): Promise<any> {
    return this.repos.agents.getSkill(id);
  }

  async listSkills(): Promise<any[]> {
    return this.repos.agents.listSkills();
  }

  async deleteSkill(id: string): Promise<void> {
    return this.repos.agents.deleteSkill(id);
  }

  async saveWorkflow(workflow: any): Promise<void> {
    return this.repos.agents.saveWorkflow(workflow);
  }

  async getWorkflow(id: string): Promise<any> {
    return this.repos.agents.getWorkflow(id);
  }

  async listWorkflows(): Promise<any[]> {
    return this.repos.agents.listWorkflows();
  }

  async deleteWorkflow(id: string): Promise<void> {
    return this.repos.agents.deleteWorkflow(id);
  }

  async saveMCPConfig(config: any): Promise<void> {
    return this.repos.agents.saveMCPConfig(config);
  }

  async getMCPConfig(id: string): Promise<any> {
    return this.repos.agents.getMCPConfig(id);
  }

  async listMCPConfigs(): Promise<any[]> {
    return this.repos.agents.listMCPConfigs();
  }

  async deleteMCPConfig(id: string): Promise<void> {
    return this.repos.agents.deleteMCPConfig(id);
  }

  async saveSchedule(schedule: any): Promise<void> {
    return this.repos.schedules.saveSchedule(schedule);
  }

  async getSchedule(id: string): Promise<any> {
    return this.repos.schedules.getSchedule(id);
  }

  async listSchedules(): Promise<any[]> {
    return this.repos.schedules.listSchedules();
  }

  async deleteSchedule(id: string): Promise<void> {
    return this.repos.schedules.deleteSchedule(id);
  }

  async saveTaskLog(log: any): Promise<number> {
    return this.repos.schedules.saveTaskLog(log);
  }

  async updateTaskLog(log: any): Promise<void> {
    return this.repos.schedules.updateTaskLog(log);
  }

  async listTaskLogs(options?: {
    limit?: number;
    offset?: number;
    taskId?: string;
  }): Promise<any[]> {
    return this.repos.schedules.listTaskLogs(options);
  }

  async finalizeRunningTaskLogs(params: {
    status: 'interrupted' | 'error';
    message: string;
    olderThanIso?: string;
  }): Promise<number> {
    return this.repos.schedules.finalizeRunningTaskLogs(params);
  }

  async reconcileStuckRunningTaskLogs(): Promise<number> {
    return this.repos.schedules.reconcileStuckRunningTaskLogs();
  }

  async saveSourceData(
    item: UnifiedData,
    ingestionDate?: string,
    adapterName?: string,
    overwrite = false
  ): Promise<boolean> {
    return this.repos.sourceData.save(item, ingestionDate, adapterName, overwrite);
  }

  async saveSourceDataBatch(
    items: UnifiedData[],
    ingestionDate?: string,
    adapterName?: string,
    overwrite = false
  ): Promise<number> {
    return this.repos.sourceData.saveBatch(items, ingestionDate, adapterName, overwrite);
  }

  async listSourceData(options?: {
    source?: string;
    category?: string;
    status?: string;
    ingestionDate?: string;
    ingestionDates?: string[];
    dailyCandidate?: string;
    hasAiScored?: boolean;
    aiPicked?: boolean;
    aiSourceTypes?: string[];
    aiTopic?: string;
    minScore?: number;
    metadataFilters?: MetadataFilter[];
    publishedDates?: string[];
    publishedFrom?: string;
    publishedTo?: string;
    adapterName?: string;
    limit?: number;
    offset?: number;
    search?: string;
    orderByPublishedDesc?: boolean;
  }): Promise<{ items: UnifiedData[]; total: number }> {
    return this.repos.sourceData.list(options);
  }

  async getSourceData(id: string): Promise<UnifiedData | null> {
    return this.repos.sourceData.get(id);
  }

  async updateSourceDataStatus(id: string, status: string): Promise<void> {
    return this.repos.sourceData.updateStatus(id, status);
  }

  async updateSourceDataMetadata(id: string, metadata: any): Promise<void> {
    return this.repos.sourceData.updateMetadata(id, metadata);
  }

  async saveHotEventSnapshot(input: {
    generatedAt: Date;
    boards: import('../types/feed.js').HotBoards;
    events?: import('../types/feed.js').HotEvent[];
    meta?: Record<string, unknown>;
  }): Promise<void> {
    return this.repos.hotEventSnapshot.save(input);
  }

  async loadLatestHotEventSnapshot(): Promise<{
    generatedAt: string;
    events: import('../types/feed.js').HotEvent[];
    boards: import('../types/feed.js').HotBoards;
    schemaVersion: number;
  } | null> {
    return this.repos.hotEventSnapshot.loadLatest();
  }

  async getHotEmbedCache(
    modelKey: string,
    contentHashes: string[]
  ): Promise<Map<string, number[]>> {
    return this.repos.hotEmbedCache.getMany(modelKey, contentHashes);
  }

  async upsertHotEmbedCache(
    modelKey: string,
    rows: Array<{ contentHash: string; dimensions: number; embedding: number[] }>
  ): Promise<void> {
    return this.repos.hotEmbedCache.upsertMany(modelKey, rows);
  }

  async deleteSourceData(id: string): Promise<void> {
    return this.repos.sourceData.delete(id);
  }

  async deleteSourceDataByFilter(options: {
    source?: string;
    category?: string;
    ingestionDate?: string;
    adapterName?: string;
  }): Promise<void> {
    return this.repos.sourceData.deleteByFilter(options);
  }

  async getSourceDataStats(): Promise<any> {
    return this.repos.sourceData.getStats();
  }

  async optimizeSourceData(): Promise<void> {
    return this.repos.sourceData.optimize();
  }

  async archiveSourceDataBefore(beforeDate: string, limit?: number): Promise<number> {
    return this.repos.sourceData.archiveBefore(beforeDate, limit);
  }

  async vacuum(): Promise<void> {
    if (!this.conn) throw new Error('LocalStore has not been initialized');
    await this.conn.exec('VACUUM ANALYZE');
  }

  async listKBCategories(): Promise<any[]> {
    return this.repos.knowledge.listCategories();
  }

  async getKBCategory(id: string): Promise<any | null> {
    return this.repos.knowledge.getCategory(id);
  }

  async saveKBCategory(category: any): Promise<void> {
    return this.repos.knowledge.saveCategory(category);
  }

  async deleteKBCategory(id: string): Promise<void> {
    return this.repos.knowledge.deleteCategory(id);
  }

  async listKBDocuments(categoryId: string): Promise<any[]> {
    return this.repos.knowledge.listDocuments(categoryId);
  }

  async getKBDocument(id: string): Promise<any | null> {
    return this.repos.knowledge.getDocument(id);
  }

  async saveKBDocument(doc: any): Promise<void> {
    return this.repos.knowledge.saveDocument(doc);
  }

  async deleteKBDocument(id: string): Promise<void> {
    return this.repos.knowledge.deleteDocument(id);
  }

  async deleteKBChunksByDocument(documentId: string): Promise<void> {
    return this.repos.knowledge.deleteChunksByDocument(documentId);
  }

  async saveKBChunk(chunk: any): Promise<void> {
    return this.repos.knowledge.saveChunk(chunk);
  }

  async listKBChunks(documentId: string): Promise<any[]> {
    return this.repos.knowledge.listChunks(documentId);
  }

  async searchKBChunks(
    query: string,
    options: { categoryIds?: string[]; documentIds?: string[]; indexVersion?: string; limit?: number } = {}
  ): Promise<any[]> {
    return this.repos.knowledge.searchChunks(query, options);
  }

  async searchKBChunksByEmbedding(
    queryVector: number[],
    options: { categoryIds?: string[]; documentIds?: string[]; indexVersion?: string; limit?: number; preferPgvector?: boolean } = {}
  ): Promise<any[]> {
    return this.repos.knowledge.searchChunksByEmbedding(queryVector, options);
  }

  async searchKBChunksByPgVector(
    queryVector: number[],
    options: { categoryIds?: string[]; documentIds?: string[]; indexVersion?: string; limit?: number } = {}
  ): Promise<any[]> {
    return this.repos.knowledge.searchChunksByPgVector(queryVector, options);
  }

  async getKBVectorCapability(): Promise<PgVectorCapability> {
    return this.repos.knowledge.getPgVectorCapability();
  }

  async listKBChunksForEmbedding(options: {
    categoryId?: string;
    categoryIds?: string[];
    documentId?: string;
    documentIds?: string[];
    indexVersion?: string;
    onlyMissing?: boolean;
    staleHash?: boolean;
    limit?: number;
    cursor?: string;
  } = {}): Promise<any[]> {
    return this.repos.knowledge.listChunksForEmbedding(options);
  }

  async updateKBChunkEmbeddingDual(chunkId: string, embedding: number[], options: {
    writeJsonb?: boolean;
    writePgvector?: boolean;
    model?: string;
    dimensions?: number;
    contentHash?: string;
    indexVersion?: string;
    embeddingConfigHash?: string;
    chunkerVersion?: string;
    embeddingProviderId?: string;
  } = {}): Promise<{ jsonbUpdated: boolean; pgvectorUpdated: boolean }> {
    return this.repos.knowledge.updateChunkEmbeddingDual(chunkId, embedding, options);
  }

  async updateKBChunkEmbedding(chunkId: string, embedding: number[]): Promise<void> {
    return this.repos.knowledge.updateChunkEmbedding(chunkId, embedding);
  }

  async markKBChunkEmbeddingError(chunkId: string, error: string): Promise<void> {
    return this.repos.knowledge.markChunkEmbeddingError(chunkId, error);
  }

  async upsertRagEmbeddingJob(job: {
    id: string;
    chunkId: string;
    documentId: string;
    sourceType?: string;
    sourceId?: string;
    unitId?: string;
    parentId?: string;
    indexVersion?: string;
    contentHash: string;
    targetStorage: RagReindexTargetStorage;
  }): Promise<{ queued: boolean; id: string }> {
    return this.repos.knowledge.upsertEmbeddingJob(job);
  }

  async claimRagEmbeddingJobs(limit: number, maxAttempts: number): Promise<RagEmbeddingJob[]> {
    return this.repos.knowledge.claimEmbeddingJobs(limit, maxAttempts);
  }

  async completeRagEmbeddingJob(jobId: string): Promise<void> {
    return this.repos.knowledge.completeEmbeddingJob(jobId);
  }

  async skipRagEmbeddingJob(jobId: string, reason: string): Promise<void> {
    return this.repos.knowledge.skipEmbeddingJob(jobId, reason);
  }

  async failRagEmbeddingJob(jobId: string, error: string, maxAttempts: number): Promise<void> {
    return this.repos.knowledge.failEmbeddingJob(jobId, error, maxAttempts);
  }

  async resetStaleRagEmbeddingJobs(staleMs: number): Promise<number> {
    return this.repos.knowledge.resetStaleJobs(staleMs);
  }

  async listRagEmbeddingJobs(options: {
    status?: RagEmbeddingJobStatus;
    limit?: number;
  } = {}): Promise<RagEmbeddingJob[]> {
    return this.repos.knowledge.listEmbeddingJobs(options);
  }

  async getRagEmbeddingCoverageStats(): Promise<RagCoverageStats & { jobStats: RagJobStats }> {
    return this.repos.knowledge.getEmbeddingCoverageStats();
  }

  async saveRagQueryTrace(trace: RagRetrievalTrace): Promise<void> {
    return this.repos.knowledge.saveRagQueryTrace(trace);
  }

  async listRagQueryTraces(options: { limit?: number } = {}): Promise<RagRetrievalTrace[]> {
    return this.repos.knowledge.listRagQueryTraces(options);
  }

  async getRagQueryTrace(traceId: string): Promise<RagRetrievalTrace | null> {
    return this.repos.knowledge.getRagQueryTrace(traceId);
  }

  async upsertRagIndexVersion(version: RagIndexVersion): Promise<void> {
    return this.repos.knowledge.upsertRagIndexVersion(version);
  }

  async listRagIndexVersions(options: {
    sourceType?: string;
    sourceId?: string;
    status?: string;
    limit?: number;
  } = {}): Promise<RagIndexVersion[]> {
    return this.repos.knowledge.listRagIndexVersions(options);
  }

  async getRagIndexVersion(idOrVersion: string): Promise<RagIndexVersion | null> {
    return this.repos.knowledge.getRagIndexVersion(idOrVersion);
  }

  async getActiveRagIndexVersion(sourceType = 'knowledge', sourceId = 'knowledge'): Promise<RagIndexVersion | null> {
    return this.repos.knowledge.getActiveRagIndexVersion(sourceType, sourceId);
  }

  async markRagIndexVersionBuilding(idOrVersion: string): Promise<RagIndexVersion | null> {
    return this.repos.knowledge.markRagIndexVersionBuilding(idOrVersion);
  }

  async activateRagIndexVersion(idOrVersion: string, metadata: Record<string, unknown> = {}): Promise<{
    version: RagIndexVersion;
    previousActiveVersion?: RagIndexVersion;
  } | null> {
    return this.repos.knowledge.activateRagIndexVersion(idOrVersion, metadata);
  }

  async rollbackRagIndexVersion(sourceType = 'knowledge', sourceId = 'knowledge'): Promise<{
    version: RagIndexVersion;
    previousActiveVersion?: RagIndexVersion;
  } | null> {
    return this.repos.knowledge.rollbackRagIndexVersion(sourceType, sourceId);
  }

  async attachEvalToRagIndexVersion(idOrVersion: string, evalResult: Record<string, unknown>): Promise<RagIndexVersion | null> {
    return this.repos.knowledge.attachEvalToRagIndexVersion(idOrVersion, evalResult);
  }

  async saveRagEvalDataset(dataset: RagEvalDataset): Promise<void> {
    return this.repos.knowledge.saveRagEvalDataset(dataset);
  }

  async listRagEvalDatasets(): Promise<RagEvalDataset[]> {
    return this.repos.knowledge.listRagEvalDatasets();
  }

  async saveRagEvalRun(run: RagEvalRun): Promise<void> {
    return this.repos.knowledge.saveRagEvalRun(run);
  }

  async listRagEvalRuns(datasetId?: string, options: { indexVersion?: string; limit?: number } = {}): Promise<RagEvalRun[]> {
    return this.repos.knowledge.listRagEvalRuns(datasetId, options);
  }

  async listMemoryCategories(): Promise<any[]> {
    return this.repos.memory.listCategories();
  }

  async getMemoryCategory(id: string): Promise<any | null> {
    return this.repos.memory.getCategory(id);
  }

  async saveMemoryCategory(category: any): Promise<void> {
    return this.repos.memory.saveCategory(category);
  }

  async deleteMemoryCategory(id: string): Promise<void> {
    return this.repos.memory.deleteCategory(id);
  }

  async listMemoriesByCategory(categoryId: string): Promise<any[]> {
    return this.repos.memory.listByCategory(categoryId);
  }

  async getMemory(id: string): Promise<any | null> {
    return this.repos.memory.get(id);
  }

  async saveMemory(memory: any): Promise<void> {
    return this.repos.memory.save(memory);
  }

  async findDuplicateMemoryHash(hash: string): Promise<any | null> {
    return this.repos.memory.findDuplicateHash(hash);
  }

  async searchMemories(
    query: string,
    options: {
      agentId?: string;
      tags?: string[];
      categoryIds?: string[];
      limit?: number;
      minImportance?: number;
    } = {}
  ): Promise<any[]> {
    return this.repos.memory.search(query, options);
  }

  async deleteMemory(id: string): Promise<void> {
    return this.repos.memory.delete(id);
  }

  async listAllMemories(): Promise<any[]> {
    return this.repos.memory.listAll();
  }

  async listApiKeys(): Promise<any[]> {
    return this.repos.apiKeys.list();
  }

  async saveApiKey(apiKey: any): Promise<void> {
    return this.repos.apiKeys.save(apiKey);
  }

  async getApiKeyByVerificationToken(token: string): Promise<any | null> {
    return this.repos.apiKeys.getByVerificationToken(token);
  }

  async updateApiKeyStatus(id: string, status: string): Promise<void> {
    return this.repos.apiKeys.updateStatus(id, status);
  }

  async updateApiKeyName(id: string, name: string): Promise<void> {
    return this.repos.apiKeys.updateName(id, name);
  }

  async getApiKeyByFingerprint(fingerprint: string): Promise<any | null> {
    return this.repos.apiKeys.getByFingerprint(fingerprint);
  }

  async deleteApiKey(id: string): Promise<void> {
    return this.repos.apiKeys.delete(id);
  }

  async getApiKeysByPrefix(prefix: string): Promise<any[]> {
    return this.repos.apiKeys.getByPrefix(prefix);
  }

  async updateApiKeyLastUsed(id: string): Promise<void> {
    return this.repos.apiKeys.updateLastUsed(id);
  }

  async deleteDailyCoverageByDate(date: string): Promise<void> {
    return this.repos.dailyCoverage.deleteByDate(date);
  }

  async insertDailyCoverageRows(rows: any[]): Promise<void> {
    return this.repos.dailyCoverage.insertRows(rows);
  }

  async listDailyCoverageInRange(startDate: string, endDateExclusive: string): Promise<any[]> {
    return this.repos.dailyCoverage.listInDateRange(startDate, endDateExclusive);
  }

  async listDailyCoverageUrlsInRange(
    startDate: string,
    endDateExclusive: string
  ): Promise<string[]> {
    return this.repos.dailyCoverage.listDistinctUrlsInRange(startDate, endDateExclusive);
  }

  async deletePublicationItemsByHistoryId(historyId: number): Promise<void> {
    return this.repos.publicationHistory.deleteItemsByHistoryId(historyId);
  }

  async upsertPublicationItems(rows: any[]): Promise<void> {
    return this.repos.publicationHistory.upsertItems(rows);
  }

  async listPublicationItemsByHistoryId(historyId: number): Promise<any[]> {
    return this.repos.publicationHistory.listItemsByHistoryId(historyId);
  }

  async listPublicationItemsInRange(startDate: string, endDateExclusive: string): Promise<any[]> {
    return this.repos.publicationHistory.listItemsInDateRange(startDate, endDateExclusive);
  }

  async listPublicationUrlsInRange(startDate: string, endDateExclusive: string): Promise<string[]> {
    return this.repos.publicationHistory.listDistinctUrlsInRange(startDate, endDateExclusive);
  }
}
