import type {
  RagEvidence,
  RagRetrievalSource,
  RagRetrievalUnit,
  RagSourceFilter
} from '../../../types/rag.js';
import type { LocalStore } from '../../LocalStore.js';

export const KNOWLEDGE_RAG_SOURCE_ID = 'knowledge';

interface KnowledgeSearchOptions {
  filter?: RagSourceFilter;
  limit?: number;
}

export class KnowledgeRetrievalSource {
  constructor(private readonly store: LocalStore) {}

  describe(): RagRetrievalSource {
    return {
      sourceType: 'knowledge',
      sourceId: KNOWLEDGE_RAG_SOURCE_ID,
      displayName: 'Knowledge Base',
      capabilities: ['fts', 'vector', 'rerank', 'citation'],
      metadata: { adapter: 'KnowledgeRetrievalSource' }
    };
  }

  async searchFts(query: string, options: KnowledgeSearchOptions = {}): Promise<RagRetrievalUnit[]> {
    const rows = await this.store.searchKBChunks(query, {
      categoryIds: this.categoryIds(options.filter),
      documentIds: this.documentIds(options.filter),
      indexVersion: this.indexVersion(options.filter),
      limit: options.limit
    });
    return rows.map((row) => this.normalizeUnit(row));
  }

  async searchPgVector(
    queryVector: number[],
    options: KnowledgeSearchOptions = {}
  ): Promise<RagRetrievalUnit[]> {
    const rows = await this.store.searchKBChunksByPgVector(queryVector, {
      categoryIds: this.categoryIds(options.filter),
      documentIds: this.documentIds(options.filter),
      indexVersion: this.indexVersion(options.filter),
      limit: options.limit
    });
    return rows.map((row) => this.normalizeUnit(row));
  }

  async searchJsonbVector(
    queryVector: number[],
    options: KnowledgeSearchOptions = {}
  ): Promise<RagRetrievalUnit[]> {
    const rows = await this.store.searchKBChunksByEmbedding(queryVector, {
      categoryIds: this.categoryIds(options.filter),
      documentIds: this.documentIds(options.filter),
      indexVersion: this.indexVersion(options.filter),
      limit: options.limit,
      preferPgvector: false
    });
    return rows.map((row) => this.normalizeUnit(row));
  }

  normalizeUnit(row: any): RagRetrievalUnit {
    const metadata = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {};
    const documentId = String(row?.documentId || row?.document_id || '');
    const unitId = String(row?.id || row?.chunkId || row?.chunk_id || '');
    const categoryId = row?.categoryId ? String(row.categoryId) : undefined;
    const docName = String(row?.docName || row?.doc_name || row?.title || '未命名文档');
    const content = String(row?.content || row?.text || '');
    const knowledge = {
      ...metadata,
      chunkId: unitId,
      documentId,
      categoryId,
      docName,
      docSummary: row?.docSummary || row?.doc_summary,
      chunkIndex: typeof row?.index === 'number' ? row.index : row?.chunk_index,
      snippet: row?.snippet,
      rank: row?.rank,
      embedding: parseEmbedding(row?.embedding || metadata.embedding || metadata.embeddingJson || row?.embeddingJson || row?.embedding_json)
    };

    return {
      unitId,
      sourceType: 'knowledge',
      sourceId: KNOWLEDGE_RAG_SOURCE_ID,
      parentId: documentId || undefined,
      text: content,
      title: docName,
      path: this.resolvePath(docName, knowledge),
      timestamp: typeof row?.updatedAt === 'number' ? row.updatedAt : undefined,
      version: typeof metadata.version === 'string' ? metadata.version : metadata.indexVersion,
      score: typeof row?.score === 'number' ? row.score : undefined,
      metadata: {
        knowledge,
        legacyRow: row
      }
    };
  }

  toEvidence(unit: RagRetrievalUnit, index: number): RagEvidence {
    const knowledge = this.knowledgeMetadata(unit);
    const label = `[K${index + 1}]`;
    return {
      evidenceId: `knowledge:${unit.unitId}`,
      sourceType: 'knowledge',
      sourceId: unit.sourceId,
      unitId: unit.unitId,
      parentId: unit.parentId,
      content: unit.text,
      citationLabel: label,
      score: unit.score,
      metadata: {
        ...knowledge,
        citationLabel: label,
        unitTitle: unit.title,
        path: unit.path
      }
    };
  }

  toLegacyRow(unit: RagRetrievalUnit): any {
    const legacy = unit.metadata?.legacyRow;
    if (legacy && typeof legacy === 'object') return legacy;
    const knowledge = this.knowledgeMetadata(unit);
    return {
      id: unit.unitId,
      documentId: unit.parentId,
      content: unit.text,
      index: knowledge.chunkIndex,
      metadata: knowledge,
      docName: unit.title,
      docSummary: knowledge.docSummary,
      categoryId: knowledge.categoryId,
      score: unit.score,
      snippet: knowledge.snippet
    };
  }

  private categoryIds(filter?: RagSourceFilter): string[] | undefined {
    const raw = filter?.metadata?.categoryIds;
    if (!Array.isArray(raw)) return undefined;
    const ids = raw.map((item) => String(item || '').trim()).filter(Boolean);
    return ids.length ? [...new Set(ids)] : undefined;
  }

  private documentIds(filter?: RagSourceFilter): string[] | undefined {
    const ids = [
      ...(filter?.parentIds || []),
      ...(Array.isArray(filter?.metadata?.documentIds)
        ? filter.metadata.documentIds.map((item) => String(item || ''))
        : [])
    ].map((item) => item.trim()).filter(Boolean);
    return ids.length ? [...new Set(ids)] : undefined;
  }

  private indexVersion(filter?: RagSourceFilter): string | undefined {
    const raw = filter?.metadata?.indexVersion;
    return typeof raw === 'string' && raw.trim() ? raw.trim() : undefined;
  }

  private resolvePath(docName: string, metadata: Record<string, unknown>): string {
    const headingPath = Array.isArray(metadata.headingPath)
      ? metadata.headingPath.map((item) => String(item)).filter(Boolean)
      : [];
    return [docName, ...headingPath].filter(Boolean).join(' / ');
  }

  private knowledgeMetadata(unit: RagRetrievalUnit): Record<string, any> {
    const value = unit.metadata?.knowledge;
    return value && typeof value === 'object' ? value as Record<string, any> : {};
  }
}

function parseEmbedding(value: unknown): number[] | undefined {
  if (Array.isArray(value)) {
    const embedding = value.map((item) => Number(item)).filter((item) => Number.isFinite(item));
    return embedding.length ? embedding : undefined;
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      return parseEmbedding(JSON.parse(value));
    } catch {
      return undefined;
    }
  }
  return undefined;
}