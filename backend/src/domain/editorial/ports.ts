/**
 * Editorial 子域的对外 Port。
 *
 * `DailyCoverageOrchestrator` 之前直接 `new SaveKnowledgeTool()` 与
 * `await ServiceContext.getInstance()` 拉 memoryService / knowledgeBaseService，
 * 既绕过了依赖图也阻碍了单测。这里把这些能力抽成 Gateway 接口，
 * orchestrator 通过构造器注入，默认实现 `KnowledgeToolGateway` 仍走旧路径
 * 以保证向下兼容。
 */

export type KnowledgeSaveMode = 'upsert' | 'create';

export interface KnowledgeSaveInput {
  content: string;
  categoryId?: string;
  categoryName?: string;
  documentName: string;
  mode: KnowledgeSaveMode;
}

export interface KnowledgeSaveResult {
  documentId?: string;
  categoryId?: string;
}

export interface KnowledgeQueryInput {
  query: string;
  categoryIds?: string[];
  limit?: number;
}

export interface KnowledgeQueryResult {
  answer?: string;
}

export interface KnowledgeGateway {
  save(input: KnowledgeSaveInput): Promise<KnowledgeSaveResult>;
  query(input: KnowledgeQueryInput): Promise<KnowledgeQueryResult>;
  /** 按分类名查 id，若不存在返回 undefined。 */
  resolveCategoryIdByName(name: string): Promise<string | undefined>;
}

export interface MemoryCleanupGateway {
  cleanupDailyCoverage(): Promise<{ deletedEntries: number; deletedCategories: number }>;
}
