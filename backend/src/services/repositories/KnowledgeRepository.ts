import { parseJsonOrFallback } from '../../shared/json.js';
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
} from '../../types/rag.js';
import { BaseRepository } from './BaseRepository.js';
import {
  buildTokenLikeClauses,
  buildTsQuery,
  buildWeightedTokenScoreExpression,
  makeTextSnippet,
  parseJsonObject,
  tokenizeSearchQuery
} from './searchUtils.js';

export interface PgVectorCapability {
  available: boolean;
  dimensions?: number;
  reason?: string;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export class KnowledgeRepository extends BaseRepository {
  private mapSearchRow(row: any, score: number, snippet?: string): any {
    const metadata = parseJsonObject(row.metadata);
    return {
      id: row.id,
      documentId: row.document_id,
      content: row.content,
      index: row.chunk_index,
      metadata: {
        ...metadata,
        indexVersion: row.index_version || metadata.indexVersion,
        embeddingConfigHash: row.embedding_config_hash || metadata.embeddingConfigHash,
        chunkerVersion: row.chunker_version || metadata.chunkerVersion,
        embeddingProviderId: row.embedding_provider_id || metadata.embeddingProviderId,
        embeddingJson: row.embedding_json || metadata.embeddingJson
      },
      docName: row.doc_name,
      docSummary: row.doc_summary,
      categoryId: row.category_id,
      score,
      snippet
    };
  }

  private mapEmbeddingJob(row: any): RagEmbeddingJob {
    return {
      id: row.id,
      chunkId: row.chunk_id,
      documentId: row.document_id,
      sourceType: row.source_type || 'knowledge',
      sourceId: row.source_id || 'knowledge',
      unitId: row.unit_id || row.chunk_id,
      parentId: row.parent_id || row.document_id,
      indexVersion: row.index_version || undefined,
      contentHash: row.content_hash,
      targetStorage: row.target_storage,
      status: row.status,
      attempts: Number(row.attempts || 0),
      lastError: row.last_error || undefined,
      lockedAt: row.locked_at || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      content: row.content
    };
  }

  private mapIndexVersion(row: any): RagIndexVersion {
    return {
      id: row.id,
      sourceType: row.source_type,
      sourceId: row.source_id,
      version: row.version,
      status: row.status,
      chunkerVersion: row.chunker_version || undefined,
      embeddingProviderId: row.embedding_provider_id || undefined,
      embeddingConfigHash: row.embedding_config_hash || undefined,
      evalResult: parseJsonObject(row.eval_result),
      metadata: parseJsonObject(row.metadata),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      activatedAt: row.activated_at || undefined
    };
  }

  private appendChunkFilters(
    sql: string,
    params: any[],
    options: { categoryIds?: string[]; documentIds?: string[]; indexVersion?: string }
  ): string {
    if (options.categoryIds && options.categoryIds.length > 0) {
      const placeholders = options.categoryIds.map(() => '?').join(', ');
      sql += ` AND d.category_id IN (${placeholders})`;
      params.push(...options.categoryIds);
    }
    if (options.documentIds && options.documentIds.length > 0) {
      const placeholders = options.documentIds.map(() => '?').join(', ');
      sql += ` AND c.document_id IN (${placeholders})`;
      params.push(...options.documentIds);
    }
    if (options.indexVersion) {
      sql += ' AND c.index_version = ?';
      params.push(options.indexVersion);
    }
    return sql;
  }

  async listCategories(): Promise<any[]> {
    const rows = await this.db.all('SELECT * FROM kb_categories ORDER BY updated_at DESC');
    return rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      documentCount: row.document_count,
      updatedAt: row.updated_at
    }));
  }

  async getCategory(id: string): Promise<any | null> {
    const row = await this.db.get('SELECT * FROM kb_categories WHERE id = ?', id);
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      documentCount: row.document_count,
      updatedAt: row.updated_at
    };
  }

  async saveCategory(category: any): Promise<void> {
    await this.db.run(
      `INSERT INTO kb_categories (id, name, description, document_count, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET
         name = excluded.name, description = excluded.description,
         document_count = excluded.document_count, updated_at = excluded.updated_at`,
      category.id,
      category.name,
      category.description || '',
      category.documentCount || 0,
      category.updatedAt || Date.now()
    );
  }

  async deleteCategory(id: string): Promise<void> {
    await this.db.run('DELETE FROM kb_categories WHERE id = ?', id);
  }

  async listDocuments(categoryId: string): Promise<any[]> {
    const rows = await this.db.all(
      'SELECT * FROM kb_documents WHERE category_id = ? ORDER BY created_at DESC',
      categoryId
    );
    return rows.map((row: any) => ({
      id: row.id,
      categoryId: row.category_id,
      name: row.name,
      fileName: row.file_name,
      type: row.type,
      summary: row.summary,
      chunkCount: row.chunk_count,
      metadata: this.parseJson(row.metadata, {}),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  async getDocument(id: string): Promise<any | null> {
    const row = await this.db.get('SELECT * FROM kb_documents WHERE id = ?', id);
    if (!row) return null;
    return {
      id: row.id,
      categoryId: row.category_id,
      name: row.name,
      fileName: row.file_name,
      type: row.type,
      summary: row.summary,
      chunkCount: row.chunk_count,
      metadata: this.parseJson(row.metadata, {}),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async saveDocument(doc: any): Promise<void> {
    await this.db.run(
      `INSERT INTO kb_documents (
        id, category_id, name, file_name, type, summary, chunk_count, metadata, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (id) DO UPDATE SET
        category_id = excluded.category_id, name = excluded.name, file_name = excluded.file_name,
        type = excluded.type, summary = excluded.summary, chunk_count = excluded.chunk_count,
        metadata = excluded.metadata, updated_at = excluded.updated_at`,
      doc.id,
      doc.categoryId,
      doc.name,
      doc.fileName,
      doc.type,
      doc.summary,
      doc.chunkCount,
      JSON.stringify(doc.metadata || {}),
      doc.createdAt,
      doc.updatedAt
    );
  }

  async deleteDocument(id: string): Promise<void> {
    await this.db.run('DELETE FROM kb_documents WHERE id = ?', id);
  }

  async saveChunk(chunk: any): Promise<void> {
    const metadata = chunk.metadata || {};
    const contentHash = chunk.contentHash || metadata.contentHash || null;
    await this.db.run(
      `INSERT INTO kb_chunks (
        id, document_id, content, chunk_index, metadata, content_hash,
        index_version, embedding_config_hash, chunker_version, embedding_provider_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET
         document_id = excluded.document_id, content = excluded.content,
         chunk_index = excluded.chunk_index, metadata = excluded.metadata,
         content_hash = excluded.content_hash,
         index_version = excluded.index_version,
         embedding_config_hash = excluded.embedding_config_hash,
         chunker_version = excluded.chunker_version,
         embedding_provider_id = excluded.embedding_provider_id,
         embedding_json = NULL,
         embedding_vector = NULL,
         embedding_model = NULL,
         embedding_dimensions = NULL,
         embedding_updated_at = NULL,
         embedding_error = NULL`,
      chunk.id,
      chunk.documentId,
      chunk.content,
      chunk.index,
      JSON.stringify(metadata),
      contentHash,
      chunk.indexVersion || metadata.indexVersion || null,
      chunk.embeddingConfigHash || metadata.embeddingConfigHash || null,
      chunk.chunkerVersion || metadata.chunkerVersion || null,
      chunk.embeddingProviderId || metadata.embeddingProviderId || null
    );
  }

  async deleteChunksByDocument(documentId: string): Promise<void> {
    await this.db.run('DELETE FROM kb_chunks WHERE document_id = ?', documentId);
  }

  async listChunks(documentId: string): Promise<any[]> {
    const rows = await this.db.all(
      'SELECT id, content, chunk_index, metadata FROM kb_chunks WHERE document_id = ? ORDER BY chunk_index ASC',
      documentId
    );
    return rows.map((row: any) => ({
      id: row.id,
      content: row.content,
      index: row.chunk_index,
      metadata: parseJsonObject(row.metadata)
    }));
  }

  async searchChunks(
    query: string,
    options: { categoryIds?: string[]; documentIds?: string[]; indexVersion?: string; limit?: number } = {}
  ): Promise<any[]> {
    const limit = options.limit || 10;
    const tsQuery = buildTsQuery(query);
    const ftsRows = tsQuery ? await this.searchChunksWithFts(tsQuery, options, limit) : [];
    const fallbackRows = await this.searchChunksWithLike(query, options, limit);
    const merged = new Map<string, any>();
    for (const row of [...ftsRows, ...fallbackRows]) {
      const existing = merged.get(row.id);
      if (!existing || (row.score ?? 0) > (existing.score ?? 0)) {
        merged.set(row.id, row);
      }
    }
    return Array.from(merged.values())
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || (a.index ?? 0) - (b.index ?? 0))
      .slice(0, limit);
  }

  private async searchChunksWithFts(
    tsQuery: string,
    options: { categoryIds?: string[]; documentIds?: string[]; indexVersion?: string },
    limit: number
  ): Promise<any[]> {
    let sql = `
      SELECT
        c.*,
        d.name as doc_name,
        d.summary as doc_summary,
        d.category_id,
        ts_rank(
          setweight(coalesce(c.search_vector, ''::tsvector), 'A') ||
          setweight(to_tsvector('simple', coalesce(d.name,'')), 'B') ||
          setweight(to_tsvector('simple', coalesce(d.summary,'')), 'B'),
          plainto_tsquery('simple', ?)
        ) as search_rank,
        ts_headline('simple', c.content, plainto_tsquery('simple', ?),
          'StartSel=【, StopSel=】, MaxWords=30, MinWords=15') as snippet
      FROM kb_chunks c
      JOIN kb_documents d ON c.document_id = d.id
      WHERE (
        c.search_vector @@ plainto_tsquery('simple', ?) OR
        to_tsvector('simple', coalesce(d.name,'') || ' ' || coalesce(d.summary,'')) @@ plainto_tsquery('simple', ?)
      )
    `;
    const params: any[] = [tsQuery, tsQuery, tsQuery, tsQuery];
    sql = this.appendChunkFilters(sql, params, options);
    sql += ' ORDER BY search_rank DESC, d.updated_at DESC, c.chunk_index ASC LIMIT ?';
    params.push(limit);

    const rows = await this.db.all(sql, ...params);
    return rows.map((row: any) => this.mapSearchRow(row, Number(row.search_rank || 0) * 100, row.snippet));
  }

  private async searchChunksWithLike(
    query: string,
    options: { categoryIds?: string[]; documentIds?: string[]; indexVersion?: string },
    limit: number
  ): Promise<any[]> {
    const tokens = tokenizeSearchQuery(query);
    if (tokens.length === 0) return [];

    const params: any[] = [];
    const normalizedQuery = `%${query.toLowerCase()}%`;
    params.push(normalizedQuery, normalizedQuery, normalizedQuery);
    const tokenScore = buildWeightedTokenScoreExpression(
      [
        { field: 'd.name', weight: 4 },
        { field: 'd.summary', weight: 3 },
        { field: 'c.content', weight: 1 }
      ],
      tokens,
      params
    );

    let sql = `
      SELECT c.*, d.name as doc_name, d.summary as doc_summary, d.category_id,
        d.updated_at as doc_updated_at,
        (
          CASE WHEN LOWER(d.name) LIKE ? THEN 6 ELSE 0 END +
          CASE WHEN LOWER(d.summary) LIKE ? THEN 4 ELSE 0 END +
          CASE WHEN LOWER(c.content) LIKE ? THEN 3 ELSE 0 END
        ) as exact_score,
        (${tokenScore}) as token_score
      FROM kb_chunks c
      JOIN kb_documents d ON c.document_id = d.id
      WHERE 1=1
    `;

    sql = this.appendChunkFilters(sql, params, options);

    const likeClauses = buildTokenLikeClauses(
      ['d.name', 'd.summary', 'c.content'],
      tokens,
      params
    );
    sql += ` AND (${likeClauses.join(' OR ')})`;

    sql += ` ORDER BY exact_score DESC, token_score DESC, d.updated_at DESC, c.chunk_index ASC LIMIT ?`;
    params.push(limit);

    const rows = await this.db.all(sql, ...params);
    return rows.map((row: any) => this.mapSearchRow(
      row,
      Number(row.exact_score || 0) +
        Number(row.token_score || 0) +
        Number(row.doc_updated_at || 0) / 1e12,
      makeTextSnippet(row.content, tokens)
    ));
  }

  async updateChunkEmbedding(
    chunkId: string,
    embedding: number[],
    metadata: {
      model?: string;
      dimensions?: number;
      error?: string | null;
      contentHash?: string;
      indexVersion?: string;
      embeddingConfigHash?: string;
      chunkerVersion?: string;
      embeddingProviderId?: string;
    } = {}
  ): Promise<void> {
    const now = Date.now();
    await this.db.run(
      `UPDATE kb_chunks
       SET embedding_json = ?,
           embedding_model = ?,
           embedding_dimensions = ?,
           embedding_updated_at = ?,
           embedding_error = ?,
           content_hash = COALESCE(?, content_hash),
           index_version = COALESCE(?, index_version),
           embedding_config_hash = COALESCE(?, embedding_config_hash),
           chunker_version = COALESCE(?, chunker_version),
           embedding_provider_id = COALESCE(?, embedding_provider_id),
           indexed_at = ?
       WHERE id = ?`,
      JSON.stringify(embedding),
      metadata.model || null,
      metadata.dimensions || embedding.length,
      now,
      metadata.error || null,
      metadata.contentHash || null,
      metadata.indexVersion || null,
      metadata.embeddingConfigHash || null,
      metadata.chunkerVersion || null,
      metadata.embeddingProviderId || null,
      now,
      chunkId
    );
  }

  async markChunkEmbeddingError(chunkId: string, error: string): Promise<void> {
    await this.db.run(
      `UPDATE kb_chunks SET embedding_error = ?, embedding_updated_at = ? WHERE id = ?`,
      error,
      Date.now(),
      chunkId
    );
  }

  async searchChunksByEmbedding(
    queryVector: number[],
    options: { categoryIds?: string[]; documentIds?: string[]; indexVersion?: string; limit?: number; preferPgvector?: boolean } = {}
  ): Promise<any[]> {
    if (options.preferPgvector !== false) {
      const pgvectorRows = await this.searchChunksByPgVector(queryVector, options);
      if (pgvectorRows.length > 0) return pgvectorRows;
    }

    const limit = Math.max(1, options.limit || 20);
    let sql = `
      SELECT c.*, d.name as doc_name, d.summary as doc_summary, d.category_id, c.embedding_json
      FROM kb_chunks c
      JOIN kb_documents d ON c.document_id = d.id
      WHERE c.embedding_json IS NOT NULL
    `;
    const params: any[] = [];
    sql = this.appendChunkFilters(sql, params, options);
    sql += ' LIMIT ?';
    params.push(Math.min(500, limit * 20));

    const rows = await this.db.all(sql, ...params);
    return rows
      .map((row: any) => {
        const embedding = parseJsonOrFallback<number[]>(row.embedding_json, []);
        const score = cosineSimilarity(queryVector, embedding) * 100;
        return this.mapSearchRow(row, score, row.content?.slice(0, 240));
      })
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, limit);
  }

  async searchChunksByPgVector(
    queryVector: number[],
    options: { categoryIds?: string[]; documentIds?: string[]; indexVersion?: string; limit?: number } = {}
  ): Promise<any[]> {
    if (!queryVector.length) return [];
    const capability = await this.getPgVectorCapability();
    if (!capability.available) return [];
    if (capability.dimensions && capability.dimensions !== queryVector.length) return [];

    const limit = Math.max(1, options.limit || 20);
    let sql = `
      SELECT c.*, d.name as doc_name, d.summary as doc_summary, d.category_id, c.embedding_json,
        (1 - (c.embedding_vector <=> ?::vector)) * 100 as vector_score
      FROM kb_chunks c
      JOIN kb_documents d ON c.document_id = d.id
      WHERE c.embedding_vector IS NOT NULL
    `;
    const params: any[] = [`[${queryVector.join(',')}]`];
    sql = this.appendChunkFilters(sql, params, options);
    sql += ' ORDER BY c.embedding_vector <=> ?::vector LIMIT ?';
    params.push(`[${queryVector.join(',')}]`, limit);

    const rows = await this.db.all(sql, ...params);
    return rows.map((row: any) => this.mapSearchRow(row, Number(row.vector_score || 0), row.content?.slice(0, 240)));
  }

  async getPgVectorCapability(): Promise<PgVectorCapability> {
    try {
      const extension = await this.db.get<{ exists: boolean }>(
        `SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') as exists`
      );
      if (!extension?.exists) {
        return { available: false, reason: 'pgvector_extension_missing' };
      }

      const column = await this.db.get<{ exists: boolean }>(
        `SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'kb_chunks' AND column_name = 'embedding_vector'
        ) as exists`
      );
      if (!column?.exists) {
        return { available: false, reason: 'embedding_vector_column_missing' };
      }

      const dimensionsRow = await this.db.get<{ column_type?: string }>(
        `SELECT format_type(atttypid, atttypmod) as column_type
         FROM pg_attribute
         WHERE attrelid = 'kb_chunks'::regclass
           AND attname = 'embedding_vector'
           AND NOT attisdropped`
      );
      const columnType = typeof dimensionsRow?.column_type === 'string'
        ? dimensionsRow.column_type
        : '';
      if (!columnType.startsWith('vector')) {
        return { available: false, reason: 'embedding_vector_column_not_vector' };
      }
      const dimensionMatch = columnType.match(/^vector\((\d+)\)$/);
      const dimensions = dimensionMatch ? Number(dimensionMatch[1]) : undefined;

      return { available: true, dimensions };
    } catch (err) {
      return { available: false, reason: `pgvector_probe_failed:${String(err)}` };
    }
  }

  async listChunksForEmbedding(options: {
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
    const limit = Math.min(500, Math.max(1, options.limit || 100));
    let sql = `
      SELECT c.id, c.document_id, c.content, c.chunk_index, c.embedding_json,
        c.embedding_vector, c.content_hash, c.embedding_dimensions, c.embedding_error,
        c.index_version, c.embedding_config_hash, c.chunker_version, c.embedding_provider_id,
        d.name as doc_name, d.category_id
      FROM kb_chunks c
      JOIN kb_documents d ON c.document_id = d.id
      WHERE c.content IS NOT NULL AND length(trim(c.content)) > 0
    `;
    const params: any[] = [];
    const categoryIds = [
      ...(options.categoryId ? [options.categoryId] : []),
      ...(options.categoryIds || [])
    ];
    const documentIds = [
      ...(options.documentId ? [options.documentId] : []),
      ...(options.documentIds || [])
    ];
    if (categoryIds.length > 0) {
      const placeholders = categoryIds.map(() => '?').join(', ');
      sql += ` AND d.category_id IN (${placeholders})`;
      params.push(...categoryIds);
    }
    if (documentIds.length > 0) {
      const placeholders = documentIds.map(() => '?').join(', ');
      sql += ` AND c.document_id IN (${placeholders})`;
      params.push(...documentIds);
    }
    if (options.onlyMissing) {
      if (options.indexVersion) {
        sql += ` AND (
          (c.embedding_json IS NULL AND c.embedding_vector IS NULL) OR
          c.index_version IS DISTINCT FROM ?
        )`;
        params.push(options.indexVersion);
      } else {
        sql += ' AND c.embedding_json IS NULL AND c.embedding_vector IS NULL';
      }
    }
    if (options.cursor) {
      sql += ' AND c.id > ?';
      params.push(options.cursor);
    }
    sql += ' ORDER BY c.id ASC, d.updated_at DESC, c.chunk_index ASC LIMIT ?';
    params.push(limit);

    const rows = await this.db.all(sql, ...params);
    return rows.map((row: any) => ({
      id: row.id,
      documentId: row.document_id,
      content: row.content,
      index: row.chunk_index,
      embeddingJson: row.embedding_json,
      contentHash: row.content_hash,
      embeddingDimensions: row.embedding_dimensions,
      embeddingError: row.embedding_error,
      indexVersion: row.index_version,
      embeddingConfigHash: row.embedding_config_hash,
      chunkerVersion: row.chunker_version,
      embeddingProviderId: row.embedding_provider_id,
      docName: row.doc_name,
      categoryId: row.category_id
    }));
  }

  async updateChunkEmbeddingDual(chunkId: string, embedding: number[], options: {
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
    const writeJsonb = options.writeJsonb !== false;
    const writePgvector = options.writePgvector === true;
    const now = Date.now();
    let jsonbUpdated = false;
    let pgvectorUpdated = false;

    if (writeJsonb) {
      await this.updateChunkEmbedding(chunkId, embedding, {
        model: options.model,
        dimensions: options.dimensions || embedding.length,
        error: null,
        contentHash: options.contentHash,
        indexVersion: options.indexVersion,
        embeddingConfigHash: options.embeddingConfigHash,
        chunkerVersion: options.chunkerVersion,
        embeddingProviderId: options.embeddingProviderId
      });
      jsonbUpdated = true;
    }

    if (writePgvector) {
      const literal = `[${embedding.join(',')}]`;
      await this.db.run(
        `UPDATE kb_chunks
         SET embedding_vector = ?::vector,
             embedding_model = ?,
             embedding_dimensions = ?,
             embedding_updated_at = ?,
             embedding_error = NULL,
             content_hash = COALESCE(?, content_hash),
             index_version = COALESCE(?, index_version),
             embedding_config_hash = COALESCE(?, embedding_config_hash),
             chunker_version = COALESCE(?, chunker_version),
             embedding_provider_id = COALESCE(?, embedding_provider_id),
             indexed_at = ?
         WHERE id = ?`,
        literal,
        options.model || null,
        options.dimensions || embedding.length,
        now,
        options.contentHash || null,
        options.indexVersion || null,
        options.embeddingConfigHash || null,
        options.chunkerVersion || null,
        options.embeddingProviderId || null,
        now,
        chunkId
      );
      pgvectorUpdated = true;
    } else if (options.contentHash || options.indexVersion || options.embeddingConfigHash || options.chunkerVersion || options.embeddingProviderId) {
      await this.db.run(
        `UPDATE kb_chunks
         SET content_hash = COALESCE(?, content_hash),
             index_version = COALESCE(?, index_version),
             embedding_config_hash = COALESCE(?, embedding_config_hash),
             chunker_version = COALESCE(?, chunker_version),
             embedding_provider_id = COALESCE(?, embedding_provider_id),
             indexed_at = COALESCE(?, indexed_at)
         WHERE id = ?`,
        options.contentHash || null,
        options.indexVersion || null,
        options.embeddingConfigHash || null,
        options.chunkerVersion || null,
        options.embeddingProviderId || null,
        options.indexVersion ? now : null,
        chunkId
      );
    }

    return { jsonbUpdated, pgvectorUpdated };
  }

  async upsertEmbeddingJob(job: {
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
    const now = Date.now();
    const result = await this.db.run(
      `INSERT INTO rag_embedding_jobs (
        id, chunk_id, document_id, source_type, source_id, unit_id, parent_id, index_version,
        content_hash, target_storage, status, attempts, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?)
      ON CONFLICT (source_type, unit_id, content_hash, target_storage) DO UPDATE SET
        status = CASE
          WHEN rag_embedding_jobs.index_version IS DISTINCT FROM excluded.index_version THEN 'pending'
          WHEN rag_embedding_jobs.status IN ('success', 'failed', 'skipped') THEN 'pending'
          ELSE rag_embedding_jobs.status
        END,
        attempts = CASE
          WHEN rag_embedding_jobs.index_version IS DISTINCT FROM excluded.index_version THEN 0
          WHEN rag_embedding_jobs.status IN ('success', 'failed', 'skipped') THEN 0
          ELSE rag_embedding_jobs.attempts
        END,
        document_id = excluded.document_id,
        chunk_id = excluded.chunk_id,
        source_id = excluded.source_id,
        parent_id = excluded.parent_id,
        index_version = excluded.index_version,
        last_error = NULL,
        updated_at = excluded.updated_at
      WHERE rag_embedding_jobs.status IN ('pending', 'running', 'success', 'failed', 'skipped')`,
      job.id,
      job.chunkId,
      job.documentId,
      job.sourceType || 'knowledge',
      job.sourceId || 'knowledge',
      job.unitId || job.chunkId,
      job.parentId || job.documentId,
      job.indexVersion || null,
      job.contentHash,
      job.targetStorage,
      now,
      now
    );
    const row = await this.db.get<{ id: string }>(
      `SELECT id FROM rag_embedding_jobs
       WHERE source_type = ? AND unit_id = ? AND content_hash = ? AND target_storage = ?`,
      job.sourceType || 'knowledge',
      job.unitId || job.chunkId,
      job.contentHash,
      job.targetStorage
    );
    return { queued: result.changes > 0, id: row?.id || job.id };
  }

  async claimEmbeddingJobs(limit: number, maxAttempts: number): Promise<RagEmbeddingJob[]> {
    const now = Date.now();
    const rows = await this.db.all(
      `WITH picked AS (
        SELECT id
        FROM rag_embedding_jobs
        WHERE status = 'pending' AND attempts < ?
        ORDER BY updated_at ASC
        LIMIT ?
        FOR UPDATE SKIP LOCKED
      )
      UPDATE rag_embedding_jobs j
      SET status = 'running', locked_at = ?, updated_at = ?
      FROM picked
      WHERE j.id = picked.id
      RETURNING j.*`,
      maxAttempts,
      Math.max(1, limit),
      now,
      now
    );
    if (rows.length === 0) return [];
    const ids = rows.map((row: any) => row.id);
    const placeholders = ids.map(() => '?').join(', ');
    const withContent = await this.db.all(
      `SELECT j.*, c.content
       FROM rag_embedding_jobs j
       JOIN kb_chunks c ON c.id = j.chunk_id
       WHERE j.id IN (${placeholders})`,
      ...ids
    );
    return withContent.map((row: any) => this.mapEmbeddingJob(row));
  }

  async completeEmbeddingJob(jobId: string): Promise<void> {
    await this.db.run(
      `UPDATE rag_embedding_jobs SET status = 'success', locked_at = NULL, updated_at = ? WHERE id = ?`,
      Date.now(),
      jobId
    );
  }

  async skipEmbeddingJob(jobId: string, reason: string): Promise<void> {
    await this.db.run(
      `UPDATE rag_embedding_jobs
       SET status = 'skipped', last_error = ?, locked_at = NULL, updated_at = ?
       WHERE id = ?`,
      reason,
      Date.now(),
      jobId
    );
  }

  async failEmbeddingJob(jobId: string, error: string, maxAttempts: number): Promise<void> {
    const row = await this.db.get<{ attempts: number; chunk_id: string }>(
      `SELECT attempts, chunk_id FROM rag_embedding_jobs WHERE id = ?`,
      jobId
    );
    const attempts = Number(row?.attempts || 0) + 1;
    const status: RagEmbeddingJobStatus = attempts >= maxAttempts ? 'failed' : 'pending';
    await this.db.run(
      `UPDATE rag_embedding_jobs
       SET status = ?, attempts = ?, last_error = ?, locked_at = NULL, updated_at = ?
       WHERE id = ?`,
      status,
      attempts,
      error,
      Date.now(),
      jobId
    );
    if (row?.chunk_id) {
      await this.markChunkEmbeddingError(row.chunk_id, error);
    }
  }

  async resetStaleJobs(staleMs: number): Promise<number> {
    const before = Date.now() - Math.max(1, staleMs);
    const result = await this.db.run(
      `UPDATE rag_embedding_jobs
       SET status = 'pending', locked_at = NULL, updated_at = ?
       WHERE status = 'running' AND locked_at IS NOT NULL AND locked_at < ?`,
      Date.now(),
      before
    );
    return result.changes;
  }

  async listEmbeddingJobs(options: {
    status?: RagEmbeddingJobStatus;
    limit?: number;
  } = {}): Promise<RagEmbeddingJob[]> {
    const limit = Math.min(200, Math.max(1, options.limit || 50));
    let sql = `SELECT j.*, c.content FROM rag_embedding_jobs j LEFT JOIN kb_chunks c ON c.id = j.chunk_id WHERE 1=1`;
    const params: any[] = [];
    if (options.status) {
      sql += ' AND j.status = ?';
      params.push(options.status);
    }
    sql += ' ORDER BY j.updated_at DESC LIMIT ?';
    params.push(limit);
    const rows = await this.db.all(sql, ...params);
    return rows.map((row: any) => this.mapEmbeddingJob(row));
  }

  async getEmbeddingCoverageStats(): Promise<RagCoverageStats & { jobStats: RagJobStats }> {
    const chunkStats = await this.db.get<{
      total: number;
      indexed: number;
      failed: number;
      dimension_mismatch: number;
      last_indexed_at?: number;
      last_error?: string;
      actual_dimensions?: number;
    }>(
      `SELECT
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE embedding_json IS NOT NULL OR embedding_vector IS NOT NULL)::int as indexed,
        COUNT(*) FILTER (WHERE embedding_error IS NOT NULL AND embedding_error <> '')::int as failed,
        COUNT(*) FILTER (WHERE embedding_error = 'dimension_mismatch')::int as dimension_mismatch,
        MAX(embedding_updated_at) as last_indexed_at,
        (ARRAY_REMOVE(ARRAY_AGG(embedding_error ORDER BY embedding_updated_at DESC), NULL))[1] as last_error,
        (ARRAY_REMOVE(ARRAY_AGG(embedding_dimensions ORDER BY embedding_updated_at DESC), NULL))[1] as actual_dimensions
       FROM kb_chunks`
    );
    const jobRows = await this.db.all<{ status: string; count: number }>(
      `SELECT status, COUNT(*)::int as count FROM rag_embedding_jobs GROUP BY status`
    );
    const jobStats: RagJobStats = { pending: 0, running: 0, success: 0, skipped: 0, failed: 0 };
    for (const row of jobRows) {
      if (row.status in jobStats) {
        jobStats[row.status as keyof RagJobStats] = Number(row.count || 0);
      }
    }
    const totalChunkCount = Number(chunkStats?.total || 0);
    const indexedChunkCount = Number(chunkStats?.indexed || 0);
    const coverage: RagCoverageStats = {
      totalChunkCount,
      indexedChunkCount,
      failedChunkCount: Number(chunkStats?.failed || 0),
      pendingJobCount: jobStats.pending,
      runningJobCount: jobStats.running,
      dimensionMismatchCount: Number(chunkStats?.dimension_mismatch || 0),
      indexCoveragePercent: totalChunkCount > 0 ? Math.round((indexedChunkCount / totalChunkCount) * 10000) / 100 : 0,
      lastIndexedAt: chunkStats?.last_indexed_at || undefined,
      lastEmbeddingError: chunkStats?.last_error || undefined,
      actualDimensions: chunkStats?.actual_dimensions || undefined
    };
    return { ...coverage, jobStats };
  }

  async saveRagQueryTrace(trace: RagRetrievalTrace): Promise<void> {
    await this.db.run(
      `INSERT INTO rag_query_traces (
        trace_id, request_id, source_type_breakdown, original_query, rewritten_queries, filters,
        retrieved_unit_ids, reranked_unit_ids, selected_evidence_ids, final_context,
        answer, citation_ids, latency_ms, token_usage, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (trace_id) DO UPDATE SET
        source_type_breakdown = excluded.source_type_breakdown,
        rewritten_queries = excluded.rewritten_queries,
        filters = excluded.filters,
        retrieved_unit_ids = excluded.retrieved_unit_ids,
        reranked_unit_ids = excluded.reranked_unit_ids,
        selected_evidence_ids = excluded.selected_evidence_ids,
        final_context = excluded.final_context,
        answer = excluded.answer,
        citation_ids = excluded.citation_ids,
        latency_ms = excluded.latency_ms,
        token_usage = excluded.token_usage,
        metadata = excluded.metadata`,
      trace.traceId,
      trace.requestId || null,
      JSON.stringify(trace.sourceTypeBreakdown || {}),
      trace.originalQuery,
      JSON.stringify(trace.rewrittenQueries || []),
      JSON.stringify(trace.filters || []),
      JSON.stringify(trace.retrievedUnitIds || []),
      JSON.stringify(trace.rerankedUnitIds || []),
      JSON.stringify(trace.selectedEvidenceIds || []),
      trace.finalContext || null,
      trace.answer || null,
      JSON.stringify(trace.citationIds || []),
      trace.latencyMs || null,
      JSON.stringify(trace.tokenUsage || {}),
      JSON.stringify(trace.metadata || {}),
      Date.now()
    );
  }

  async listRagQueryTraces(options: { limit?: number } = {}): Promise<RagRetrievalTrace[]> {
    const rows = await this.db.all(
      `SELECT * FROM rag_query_traces ORDER BY created_at DESC LIMIT ?`,
      Math.min(100, Math.max(1, options.limit || 20))
    );
    return rows.map((row: any) => this.mapTrace(row));
  }

  async getRagQueryTrace(traceId: string): Promise<RagRetrievalTrace | null> {
    const row = await this.db.get(`SELECT * FROM rag_query_traces WHERE trace_id = ?`, traceId);
    return row ? this.mapTrace(row) : null;
  }

  async upsertRagIndexVersion(version: RagIndexVersion): Promise<void> {
    await this.db.run(
      `INSERT INTO rag_index_versions (
        id, source_type, source_id, version, status, chunker_version, embedding_provider_id,
        embedding_config_hash, eval_result, metadata, created_at, updated_at, activated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (id) DO UPDATE SET
        status = excluded.status,
        chunker_version = excluded.chunker_version,
        embedding_provider_id = excluded.embedding_provider_id,
        embedding_config_hash = excluded.embedding_config_hash,
        eval_result = excluded.eval_result,
        metadata = excluded.metadata,
        updated_at = excluded.updated_at,
        activated_at = excluded.activated_at`,
      version.id,
      version.sourceType,
      version.sourceId,
      version.version,
      version.status,
      version.chunkerVersion || null,
      version.embeddingProviderId || null,
      version.embeddingConfigHash || null,
      JSON.stringify(version.evalResult || {}),
      JSON.stringify(version.metadata || {}),
      version.createdAt,
      version.updatedAt,
      version.activatedAt || null
    );
  }

  async listRagIndexVersions(options: {
    sourceType?: string;
    sourceId?: string;
    status?: string;
    limit?: number;
  } = {}): Promise<RagIndexVersion[]> {
    const params: any[] = [];
    let sql = `SELECT * FROM rag_index_versions WHERE 1=1`;
    if (options.sourceType) {
      sql += ' AND source_type = ?';
      params.push(options.sourceType);
    }
    if (options.sourceId) {
      sql += ' AND source_id = ?';
      params.push(options.sourceId);
    }
    if (options.status) {
      sql += ' AND status = ?';
      params.push(options.status);
    }
    sql += ' ORDER BY updated_at DESC LIMIT ?';
    params.push(Math.min(200, Math.max(1, options.limit || 100)));
    const rows = await this.db.all(sql, ...params);
    return rows.map((row: any) => this.mapIndexVersion(row));
  }

  async getRagIndexVersion(idOrVersion: string): Promise<RagIndexVersion | null> {
    const row = await this.db.get(
      `SELECT * FROM rag_index_versions WHERE id = ? OR version = ? ORDER BY updated_at DESC LIMIT 1`,
      idOrVersion,
      idOrVersion
    );
    return row ? this.mapIndexVersion(row) : null;
  }

  async getActiveRagIndexVersion(sourceType = 'knowledge', sourceId = 'knowledge'): Promise<RagIndexVersion | null> {
    const row = await this.db.get(
      `SELECT * FROM rag_index_versions
       WHERE source_type = ? AND source_id = ? AND status = 'active'
       ORDER BY activated_at DESC NULLS LAST, updated_at DESC
       LIMIT 1`,
      sourceType,
      sourceId
    );
    return row ? this.mapIndexVersion(row) : null;
  }

  async markRagIndexVersionBuilding(idOrVersion: string): Promise<RagIndexVersion | null> {
    const current = await this.getRagIndexVersion(idOrVersion);
    if (!current) return null;
    const next: RagIndexVersion = {
      ...current,
      status: 'building',
      updatedAt: Date.now(),
      metadata: {
        ...(current.metadata || {}),
        buildStartedAt: Date.now()
      }
    };
    await this.upsertRagIndexVersion(next);
    return next;
  }

  async activateRagIndexVersion(idOrVersion: string, metadata: Record<string, unknown> = {}): Promise<{
    version: RagIndexVersion;
    previousActiveVersion?: RagIndexVersion;
  } | null> {
    const current = await this.getRagIndexVersion(idOrVersion);
    if (!current) return null;
    const previousActiveVersion = await this.getActiveRagIndexVersion(current.sourceType, current.sourceId);
    const now = Date.now();
    await this.db.run(
      `UPDATE rag_index_versions
       SET status = 'evaluated', updated_at = ?
       WHERE source_type = ? AND source_id = ? AND status = 'active' AND id <> ?`,
      now,
      current.sourceType,
      current.sourceId,
      current.id
    );
    const activated: RagIndexVersion = {
      ...current,
      status: 'active',
      updatedAt: now,
      activatedAt: now,
      metadata: {
        ...(current.metadata || {}),
        ...metadata,
        previousActiveVersion: previousActiveVersion?.version
      }
    };
    await this.upsertRagIndexVersion(activated);
    return { version: activated, previousActiveVersion: previousActiveVersion || undefined };
  }

  async rollbackRagIndexVersion(sourceType = 'knowledge', sourceId = 'knowledge'): Promise<{
    version: RagIndexVersion;
    previousActiveVersion?: RagIndexVersion;
  } | null> {
    const current = await this.getActiveRagIndexVersion(sourceType, sourceId);
    const candidates = await this.listRagIndexVersions({ sourceType, sourceId, limit: 200 });
    const rollbackTarget = candidates
      .filter((item) =>
        item.id !== current?.id &&
        (item.status === 'evaluated' || item.status === 'rolled_back' || item.status === 'active') &&
        Boolean((item.evalResult || {}).passed)
      )
      .sort((a, b) => (b.activatedAt || b.updatedAt || 0) - (a.activatedAt || a.updatedAt || 0))[0];
    if (!rollbackTarget) return null;
    const now = Date.now();
    if (current) {
      await this.upsertRagIndexVersion({
        ...current,
        status: 'rolled_back',
        updatedAt: now,
        metadata: {
          ...(current.metadata || {}),
          rolledBackAt: now,
          rolledBackTo: rollbackTarget.version
        }
      });
    }
    const activated: RagIndexVersion = {
      ...rollbackTarget,
      status: 'active',
      updatedAt: now,
      activatedAt: now,
      metadata: {
        ...(rollbackTarget.metadata || {}),
        rollbackActivatedAt: now,
        rolledBackFrom: current?.version
      }
    };
    await this.upsertRagIndexVersion(activated);
    return { version: activated, previousActiveVersion: current || undefined };
  }

  async attachEvalToRagIndexVersion(idOrVersion: string, evalResult: Record<string, unknown>): Promise<RagIndexVersion | null> {
    const current = await this.getRagIndexVersion(idOrVersion);
    if (!current) return null;
    const nextStatus = evalResult.passed ? 'evaluated' : 'failed';
    const next: RagIndexVersion = {
      ...current,
      status: current.status === 'active' && nextStatus === 'evaluated' ? 'active' : nextStatus,
      evalResult,
      updatedAt: Date.now(),
      metadata: {
        ...(current.metadata || {}),
        evaluatedAt: Date.now(),
        previousStatus: current.status
      }
    };
    await this.upsertRagIndexVersion(next);
    return next;
  }

  async saveRagEvalDataset(dataset: RagEvalDataset): Promise<void> {
    await this.db.run(
      `INSERT INTO rag_eval_datasets (id, name, description, cases, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET
         name = excluded.name,
         description = excluded.description,
         cases = excluded.cases,
         metadata = excluded.metadata,
         updated_at = excluded.updated_at`,
      dataset.id,
      dataset.name,
      dataset.description || '',
      JSON.stringify(dataset.cases || []),
      JSON.stringify(dataset.metadata || {}),
      dataset.createdAt,
      dataset.updatedAt
    );
  }

  async listRagEvalDatasets(): Promise<RagEvalDataset[]> {
    const rows = await this.db.all(`SELECT * FROM rag_eval_datasets ORDER BY updated_at DESC LIMIT 100`);
    return rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description || undefined,
      cases: this.parseJson(row.cases, []),
      metadata: parseJsonObject(row.metadata),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  async saveRagEvalRun(run: RagEvalRun): Promise<void> {
    await this.db.run(
      `INSERT INTO rag_eval_runs (id, dataset_id, index_version, scores, summary, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET
         scores = excluded.scores,
         summary = excluded.summary`,
      run.id,
      run.datasetId,
      run.indexVersion || null,
      JSON.stringify(run.scores || []),
      JSON.stringify(run.summary || {}),
      run.createdAt
    );
  }

  async listRagEvalRuns(datasetId?: string, options: { indexVersion?: string; limit?: number } = {}): Promise<RagEvalRun[]> {
    const params: any[] = [];
    let sql = `SELECT * FROM rag_eval_runs WHERE 1=1`;
    if (datasetId) {
      sql += ' AND dataset_id = ?';
      params.push(datasetId);
    }
    if (options.indexVersion) {
      sql += ' AND index_version = ?';
      params.push(options.indexVersion);
    }
    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(Math.min(200, Math.max(1, options.limit || 100)));
    const rows = await this.db.all(sql, ...params);
    return rows.map((row: any) => ({
      id: row.id,
      datasetId: row.dataset_id,
      indexVersion: row.index_version || undefined,
      scores: this.parseJson(row.scores, []),
      summary: parseJsonObject(row.summary),
      createdAt: row.created_at
    }));
  }

  private mapTrace(row: any): RagRetrievalTrace {
    const metadata = parseJsonObject(row.metadata);
    return {
      traceId: row.trace_id,
      requestId: row.request_id || undefined,
      originalQuery: row.original_query,
      rewrittenQueries: this.parseJson(row.rewritten_queries, []),
      filters: this.parseJson(row.filters, []),
      retrievedUnitIds: this.parseJson(row.retrieved_unit_ids, []),
      rerankedUnitIds: this.parseJson(row.reranked_unit_ids, []),
      selectedEvidenceIds: this.parseJson(row.selected_evidence_ids, []),
      retrievalMode: typeof metadata.retrievalMode === 'string'
        ? metadata.retrievalMode as RagRetrievalTrace['retrievalMode']
        : undefined,
      fallbackReason: typeof metadata.fallbackReason === 'string'
        ? metadata.fallbackReason
        : undefined,
      retrievalStages: Array.isArray(metadata.retrievalStages)
        ? metadata.retrievalStages as RagRetrievalTrace['retrievalStages']
        : undefined,
      finalContext: row.final_context || undefined,
      answer: row.answer || undefined,
      citationIds: this.parseJson(row.citation_ids, []),
      latencyMs: row.latency_ms || undefined,
      tokenUsage: parseJsonObject(row.token_usage),
      sourceTypeBreakdown: parseJsonObject(row.source_type_breakdown) as RagRetrievalTrace['sourceTypeBreakdown'],
      metadata
    };
  }
}
