import type {
  RagCitationCheckResult,
  RagCitationDecision,
  RagEvidence,
  RagExplicitRetrievalMode,
  RagPlannerStage,
  RagRetrievalStage,
  RagRetrievalTrace,
  RagSourceFilter,
  RagSourceType
} from './rag.js';

export interface KBCategory {
  id: string;
  name: string;
  description: string;
  documentCount: number;
  lastUpdatedAt: number;
}

export interface KBDocument {
  id: string;
  categoryId: string;
  name: string;
  fileName: string;
  type: string; // 'pdf' | 'md' | 'txt' | 'docx'
  summary: string;
  chunkCount: number;
  metadata: {
    originalPath?: string;
    sourceUrl?: string;
    fileSize?: number;
    [key: string]: any;
  };
  createdAt: number;
  updatedAt: number;
}

export interface KBChunk {
  id: string;
  documentId: string;
  content: string;
  index: number;
  metadata?: any;
}

export interface KBIndex {
  version: string;
  categories: KBCategory[];
  updatedAt: number;
}

export interface KBCategoryIndex {
  id: string;
  name: string;
  description: string;
  documents: KBDocumentSummary[];
  updatedAt: number;
}

export interface KBDocumentSummary {
  id: string;
  name: string;
  type: string;
  summary: string;
  chunkCount: number;
  createdAt: number;
}

export type KnowledgeQueryFallbackFormat = 'readable' | 'context';

export interface KnowledgeQueryMeta {
  retrievalMode: RagExplicitRetrievalMode;
  fallbackReason?: string;
  plannerStages: RagPlannerStage[];
  retrievalStages: RagRetrievalStage[];
  durationMs: number;
  sourceCount: number;
  traceId?: string;
  evidenceCount?: number;
  scope?: Record<string, unknown>;
  sourceFilter?: RagSourceFilter;
  citationCheck?: RagCitationCheckResult;
  citationDecision?: RagCitationDecision;
  traceStages?: RagRetrievalStage[];
}

export interface KnowledgeQuerySource {
  chunkId: string;
  documentId: string;
  docName: string;
  categoryId?: string;
  snippet?: string;
  score?: number;
  evidenceId?: string;
  sourceType?: RagSourceType;
  unitId?: string;
  parentId?: string;
  citationLabel?: string;
}

export interface KnowledgeQueryDetailedResult {
  answer: string;
  meta: KnowledgeQueryMeta;
  sources: KnowledgeQuerySource[];
  evidence?: RagEvidence[];
  traceId?: string;
  trace?: RagRetrievalTrace;
}

export interface KnowledgeDocumentWriteResult {
  id: string;
  embeddingQueuedCount?: number;
  embeddingSkippedCount?: number;
}

export interface IKnowledgeBaseService {
  getCategories(): Promise<KBCategory[]>;
  addCategory(name: string, description?: string): Promise<string>;
  deleteCategory(id: string): Promise<void>;
  updateCategory(id: string, name: string, description?: string): Promise<void>;
  mergeCategories(ids: string[], targetName: string, targetDescription?: string): Promise<string>;
  getDocuments(categoryId: string): Promise<KBDocument[]>;
  addDocument(
    categoryId: string,
    file: { name: string; path: string; buffer: Buffer }
  ): Promise<string>;
  addDocumentDetailed?(
    categoryId: string,
    file: { name: string; path: string; buffer: Buffer }
  ): Promise<KnowledgeDocumentWriteResult>;
  deleteDocument(id: string): Promise<void>;
  updateDocumentContent(id: string, content: string): Promise<void>;
  updateDocumentContentDetailed?(id: string, content: string): Promise<KnowledgeDocumentWriteResult>;
  getDocumentFullText(id: string): Promise<string>;
  queryKnowledge(
    query: string,
    options?: {
      categoryIds?: string[];
      documentIds?: string[];
      limit?: number;
      fallbackFormat?: KnowledgeQueryFallbackFormat;
      sourceFilter?: RagSourceFilter;
    }
  ): Promise<string>;
  queryKnowledgeDetailed(
    query: string,
    options?: {
      categoryIds?: string[];
      documentIds?: string[];
      limit?: number;
      fallbackFormat?: KnowledgeQueryFallbackFormat;
      sourceFilter?: RagSourceFilter;
    }
  ): Promise<KnowledgeQueryDetailedResult>;
}
