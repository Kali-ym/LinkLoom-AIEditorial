/**
 * LocalStore 的领域 Port 接口。
 *
 * 设计目标：
 * - 把 `LocalStore` 这个上帝类的方法按 bounded context 切成「能力契约」。
 * - 消费方（services / domain）可按需声明 `IAgentStore` / `IFeedStore` 等更小的依赖类型，
 *   而不是吞下整个 `LocalStore`，从而降低耦合并方便测试时 mock。
 * - 现阶段 `LocalStore` 仍是实现这些接口的统一类，不强制拆分构造。后续 P3 阶段
 *   可以平滑切换到 per-context 的 Repository 实例。
 *
 * 注意：方法签名与 LocalStore 上对应方法保持一致。新增方法时两边同步。
 */

import type { DailyCoverageIndexRow, PublicationItemInput } from '../../types/dailyCoverage.js';
import type { UnifiedData } from '../../types/index.js';

export type MetadataFilterOp =
  | 'exists'
  | 'notExists'
  | 'eq'
  | 'ne'
  | 'in'
  | 'notIn'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte';

export interface MetadataFilter {
  path: string;
  op?: MetadataFilterOp;
  value?: unknown;
}

export interface IKVStore {
  get(key: string): Promise<any>;
  put(key: string, value: any, expirationTtl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  getAllKeys(): Promise<string[]>;
}

export interface IConfigStore extends IKVStore {}

export interface IAgentStore {
  getSkillsDir(): string;
  saveAgent(agent: any): Promise<void>;
  getAgent(id: string): Promise<any>;
  listAgents(): Promise<any[]>;
  deleteAgent(id: string): Promise<void>;
  saveSkill(skill: any): Promise<void>;
  getSkill(id: string): Promise<any>;
  listSkills(): Promise<any[]>;
  deleteSkill(id: string): Promise<void>;
  saveWorkflow(workflow: any): Promise<void>;
  getWorkflow(id: string): Promise<any>;
  listWorkflows(): Promise<any[]>;
  deleteWorkflow(id: string): Promise<void>;
  saveMCPConfig(config: any): Promise<void>;
  getMCPConfig(id: string): Promise<any>;
  listMCPConfigs(): Promise<any[]>;
  deleteMCPConfig(id: string): Promise<void>;
}

export interface IScheduleStore {
  saveSchedule(schedule: any): Promise<void>;
  getSchedule(id: string): Promise<any>;
  listSchedules(): Promise<any[]>;
  deleteSchedule(id: string): Promise<void>;
  saveTaskLog(log: any): Promise<number>;
  updateTaskLog(log: any): Promise<void>;
  listTaskLogs(options?: { limit?: number; offset?: number; taskId?: string }): Promise<any[]>;
  finalizeRunningTaskLogs(params: {
    status: 'interrupted' | 'error';
    message: string;
    olderThanIso?: string;
  }): Promise<number>;
  reconcileStuckRunningTaskLogs(): Promise<number>;
}

export interface IFeedStore {
  saveSourceData(
    item: UnifiedData,
    ingestionDate?: string,
    adapterName?: string,
    overwrite?: boolean
  ): Promise<boolean>;
  saveSourceDataBatch(
    items: UnifiedData[],
    ingestionDate?: string,
    adapterName?: string,
    overwrite?: boolean
  ): Promise<number>;
  listSourceData(options?: {
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
  }): Promise<{ items: UnifiedData[]; total: number }>;
  getSourceData(id: string): Promise<UnifiedData | null>;
  updateSourceDataStatus(id: string, status: string): Promise<void>;
  updateSourceDataMetadata(id: string, metadata: any): Promise<void>;
  deleteSourceData(id: string): Promise<void>;
  deleteSourceDataByFilter(options: {
    source?: string;
    category?: string;
    ingestionDate?: string;
    adapterName?: string;
  }): Promise<void>;
  saveHotEventSnapshot(input: {
    generatedAt: Date;
    boards: import('../../types/feed.js').HotBoards;
    events?: import('../../types/feed.js').HotEvent[];
    meta?: Record<string, unknown>;
  }): Promise<void>;
  loadLatestHotEventSnapshot(): Promise<{
    generatedAt: string;
    events: import('../../types/feed.js').HotEvent[];
    boards: import('../../types/feed.js').HotBoards;
    schemaVersion: number;
  } | null>;
  getHotEmbedCache(
    modelKey: string,
    contentHashes: string[]
  ): Promise<Map<string, number[]>>;
  upsertHotEmbedCache(
    modelKey: string,
    rows: Array<{ contentHash: string; dimensions: number; embedding: number[] }>
  ): Promise<void>;
}

export interface ICoverageStore {
  deleteDailyCoverageByDate(date: string): Promise<void>;
  insertDailyCoverageRows(rows: DailyCoverageIndexRow[]): Promise<void>;
  listDailyCoverageInRange(startDate: string, endDateExclusive: string): Promise<any>;
  listDailyCoverageUrlsInRange(startDate: string, endDateExclusive: string): Promise<string[]>;
  deletePublicationItemsByHistoryId(historyId: number): Promise<void>;
  upsertPublicationItems(rows: PublicationItemInput[]): Promise<void>;
  listPublicationItemsByHistoryId(historyId: number): Promise<any>;
  listPublicationItemsInRange(startDate: string, endDateExclusive: string): Promise<any>;
  listPublicationUrlsInRange(startDate: string, endDateExclusive: string): Promise<string[]>;
}

export interface IApiKeyStore {
  listApiKeys(): Promise<any[]>;
  saveApiKey(apiKey: {
    id: string;
    name: string;
    keyHash: string;
    prefix: string;
    sourceFingerprint?: string;
    verificationToken?: string;
    status?: string;
    createdAt?: number;
  }): Promise<void>;
  getApiKeyByVerificationToken(token: string): Promise<any | null>;
  updateApiKeyStatus(id: string, status: string): Promise<void>;
  updateApiKeyName(id: string, name: string): Promise<void>;
  getApiKeyByFingerprint(fingerprint: string): Promise<any | null>;
  deleteApiKey(id: string): Promise<void>;
  getApiKeysByPrefix(prefix: string): Promise<any[]>;
  updateApiKeyLastUsed(id: string): Promise<void>;
}

export interface IHistoryStore {
  saveCommitHistory(record: {
    date: string;
    platform: string;
    filePath: string;
    commitMessage?: string;
    fullContent?: string;
  }): Promise<number>;
  getCommitHistoryById(id: number): Promise<any | null>;
  getCommitHistory(options?: {
    date?: string;
    dates?: string[];
    platform?: string;
    limit?: number;
    offset?: number;
    search?: string;
  }): Promise<{ records: any[]; total: number }>;
  getCommittedDates(): Promise<string[]>;
  deleteCommitHistory(id: number): Promise<void>;
}

/**
 * 聚合所有 Port 的便利类型 —— `LocalStore` 当前实现此类型。
 * 消费方推荐声明更小的 Port 子集（如 `IAgentStore`）而不是 `IStorePorts`。
 */
export type IStorePorts = IKVStore &
  IConfigStore &
  IAgentStore &
  IScheduleStore &
  IFeedStore &
  ICoverageStore &
  IApiKeyStore &
  IHistoryStore;
