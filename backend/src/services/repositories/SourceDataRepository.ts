import { createHash } from 'crypto';
import type { MetadataFilter } from '../../domain/ports/store.js';
import type { UnifiedData } from '../../types/index.js';
import { normalizeUrlForStorage } from '../../utils/editorialUtils.js';
import { BaseRepository } from './BaseRepository.js';
import { SourceDataMapper } from './mappers/SourceDataMapper.js';

export class SourceDataRepository extends BaseRepository {
  private deriveStorageKey(item: UnifiedData): { id: string; urlNorm: string | null } {
    const norm = normalizeUrlForStorage(item.url || '');
    if (norm) {
      const hash = createHash('sha256').update(norm).digest('hex').slice(0, 32);
      return { id: `url-${hash}`, urlNorm: norm };
    }
    return { id: item.id, urlNorm: null };
  }

  async save(
    item: UnifiedData,
    ingestionDate?: string,
    adapterName?: string,
    overwrite = false
  ): Promise<boolean> {
    const { id: storageId, urlNorm } = this.deriveStorageKey(item);

    if (!overwrite) {
      if (urlNorm) {
        const existingByUrl = await this.db.get<{ id: string }>(
          'SELECT id FROM source_data WHERE url_norm = ?',
          urlNorm
        );
        if (existingByUrl) return false;
      } else {
        const existingById = await this.db.get<{ id: string }>(
          'SELECT id FROM source_data WHERE id = ?',
          storageId
        );
        if (existingById) return false;
      }
    } else if (urlNorm) {
      await this.db.run(
        'DELETE FROM source_data WHERE url_norm = ? AND id != ?',
        urlNorm,
        storageId
      );
    }

    const sourceEntryId = item.id !== storageId ? item.id : undefined;
    const metadata = sourceEntryId
      ? { ...(item.metadata || {}), source_entry_id: sourceEntryId }
      : item.metadata;

    const sql = overwrite
      ? `INSERT INTO source_data (
          id, title, url, url_norm, description, published_date, source, category,
          author, metadata, fetched_at, ingestion_date, adapter_name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (id) DO UPDATE SET
          title = excluded.title, url = excluded.url, url_norm = excluded.url_norm,
          description = excluded.description, published_date = excluded.published_date,
          source = excluded.source, category = excluded.category, author = excluded.author,
          metadata = excluded.metadata, fetched_at = excluded.fetched_at,
          ingestion_date = excluded.ingestion_date, adapter_name = excluded.adapter_name`
      : `INSERT INTO source_data (
          id, title, url, url_norm, description, published_date, source, category,
          author, metadata, fetched_at, ingestion_date, adapter_name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (id) DO NOTHING`;

    const result = await this.db.run(
      sql,
      storageId,
      item.title,
      item.url,
      urlNorm,
      item.description,
      item.published_date,
      item.source,
      item.category,
      item.author || null,
      metadata ? JSON.stringify(metadata) : null,
      Date.now(),
      ingestionDate || null,
      adapterName || null
    );
    return result.changes > 0;
  }

  async saveBatch(
    items: UnifiedData[],
    ingestionDate?: string,
    adapterName?: string,
    overwrite = false
  ): Promise<number> {
    if (!items.length) return 0;

    let addedCount = 0;
    await this.db.run('BEGIN');
    try {
      for (const item of items) {
        const inserted = await this.save(item, ingestionDate, adapterName, overwrite);
        if (inserted) addedCount++;
      }
      await this.db.run('COMMIT');
      return addedCount;
    } catch (error) {
      await this.db.run('ROLLBACK');
      throw error;
    }
  }

  async list(options?: {
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
    let query = 'SELECT s.* FROM source_data s';
    let countQuery = 'SELECT COUNT(*) as total FROM source_data s';
    const params: any[] = [];
    const countParams: any[] = [];

    if (options?.search) {
      query += " WHERE s.search_vector @@ plainto_tsquery('simple', ?)";
      countQuery += " WHERE s.search_vector @@ plainto_tsquery('simple', ?)";
      params.push(options.search);
      countParams.push(options.search);
    } else {
      query += ' WHERE 1=1';
      countQuery += ' WHERE 1=1';
    }

    if (options?.source) {
      query += ' AND s.source = ?';
      countQuery += ' AND s.source = ?';
      params.push(options.source);
      countParams.push(options.source);
    }
    if (options?.category) {
      query += ' AND s.category = ?';
      countQuery += ' AND s.category = ?';
      params.push(options.category);
      countParams.push(options.category);
    }
    if (options?.status) {
      query += ' AND s.status = ?';
      countQuery += ' AND s.status = ?';
      params.push(options.status);
      countParams.push(options.status);
    }
    if (options?.ingestionDate) {
      query += ' AND s.ingestion_date = ?';
      countQuery += ' AND s.ingestion_date = ?';
      params.push(options.ingestionDate);
      countParams.push(options.ingestionDate);
    }
    if (options?.ingestionDates && options.ingestionDates.length > 0) {
      const placeholders = options.ingestionDates.map(() => '?').join(', ');
      query += ` AND s.ingestion_date IN (${placeholders})`;
      countQuery += ` AND s.ingestion_date IN (${placeholders})`;
      params.push(...options.ingestionDates);
      countParams.push(...options.ingestionDates);
    }
    if (options?.dailyCandidate) {
      query += " AND s.metadata->>'daily_candidate' = ?";
      countQuery += " AND s.metadata->>'daily_candidate' = ?";
      params.push(options.dailyCandidate);
      countParams.push(options.dailyCandidate);
    }
    if (options?.hasAiScored !== undefined) {
      if (options.hasAiScored) {
        query +=
          " AND s.metadata->>'ai_scored_at' IS NOT NULL AND s.metadata->>'ai_scored_at' != ''";
        countQuery +=
          " AND s.metadata->>'ai_scored_at' IS NOT NULL AND s.metadata->>'ai_scored_at' != ''";
      } else {
        query += " AND (s.metadata->>'ai_scored_at' IS NULL OR s.metadata->>'ai_scored_at' = '')";
        countQuery +=
          " AND (s.metadata->>'ai_scored_at' IS NULL OR s.metadata->>'ai_scored_at' = '')";
      }
    }
    if (options?.aiPicked !== undefined) {
      // metadata.ai_picked 由评分 JSON 写入，为 boolean（text 为 'true'/'false'），勿用 '1'/'0'
      if (options.aiPicked) {
        query += " AND (s.metadata->>'ai_picked' IN ('true', '1'))";
        countQuery += " AND (s.metadata->>'ai_picked' IN ('true', '1'))";
      } else {
        query +=
          " AND (s.metadata->>'ai_picked' IN ('false', '0') OR s.metadata->>'ai_picked' IS NULL)";
        countQuery +=
          " AND (s.metadata->>'ai_picked' IN ('false', '0') OR s.metadata->>'ai_picked' IS NULL)";
      }
    }
    if (options?.aiSourceTypes && options.aiSourceTypes.length > 0) {
      const placeholders = options.aiSourceTypes.map(() => '?').join(', ');
      query += ` AND s.metadata->>'ai_source_type' IN (${placeholders})`;
      countQuery += ` AND s.metadata->>'ai_source_type' IN (${placeholders})`;
      params.push(...options.aiSourceTypes);
      countParams.push(...options.aiSourceTypes);
    }
    if (options?.aiTopic) {
      query += " AND s.metadata->>'ai_topic' = ?";
      countQuery += " AND s.metadata->>'ai_topic' = ?";
      params.push(options.aiTopic);
      countParams.push(options.aiTopic);
    }
    if (options?.minScore !== undefined) {
      query += " AND (s.metadata->>'ai_score')::numeric >= ?";
      countQuery += " AND (s.metadata->>'ai_score')::numeric >= ?";
      params.push(options.minScore);
      countParams.push(options.minScore);
    }
    for (const filter of normalizeMetadataFilters(options?.metadataFilters)) {
      const clause = buildMetadataFilterClause(filter);
      query += ` AND ${clause.sql}`;
      countQuery += ` AND ${clause.sql}`;
      params.push(...clause.params);
      countParams.push(...clause.params);
    }
    if (options?.publishedDates && options.publishedDates.length > 0) {
      const clauses = options.publishedDates.map(() => 's.published_date LIKE ?').join(' OR ');
      query += ` AND (${clauses})`;
      countQuery += ` AND (${clauses})`;
      params.push(...options.publishedDates.map((date) => `${date}%`));
      countParams.push(...options.publishedDates.map((date) => `${date}%`));
    }
    if (options?.publishedFrom) {
      query += ' AND s.published_date >= ?';
      countQuery += ' AND s.published_date >= ?';
      params.push(options.publishedFrom);
      countParams.push(options.publishedFrom);
    }
    if (options?.publishedTo) {
      query += ' AND s.published_date <= ?';
      countQuery += ' AND s.published_date <= ?';
      params.push(options.publishedTo);
      countParams.push(options.publishedTo);
    }
    if (options?.adapterName) {
      query += ' AND s.adapter_name = ?';
      countQuery += ' AND s.adapter_name = ?';
      params.push(options.adapterName);
      countParams.push(options.adapterName);
    }

    query += options?.orderByPublishedDesc
      ? ' ORDER BY s.published_date DESC'
      : ' ORDER BY s.fetched_at DESC';
    if (options?.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }
    if (options?.offset) {
      query += ' OFFSET ?';
      params.push(options.offset);
    }

    const [rows, countResult] = await Promise.all([
      this.db.all(query, ...params),
      this.db.get(countQuery, ...countParams)
    ]);

    return {
      items: SourceDataMapper.toEntityList(rows),
      total: countResult?.total || 0
    };
  }

  async get(id: string): Promise<UnifiedData | null> {
    const row = await this.db.get('SELECT * FROM source_data WHERE id = ?', id);
    return SourceDataMapper.toEntity(row);
  }

  async updateStatus(id: string, status: string): Promise<void> {
    await this.db.run('UPDATE source_data SET status = ? WHERE id = ?', status, id);
  }

  async updateMetadata(id: string, metadata: any): Promise<void> {
    await this.db.run(
      'UPDATE source_data SET metadata = ? WHERE id = ?',
      JSON.stringify(metadata),
      id
    );
  }

  async delete(id: string): Promise<void> {
    await this.db.run('DELETE FROM source_data WHERE id = ?', id);
  }

  async deleteByFilter(options: {
    source?: string;
    category?: string;
    ingestionDate?: string;
    adapterName?: string;
  }): Promise<void> {
    let query = 'DELETE FROM source_data WHERE 1=1';
    const params: any[] = [];
    if (options.source) {
      query += ' AND source = ?';
      params.push(options.source);
    }
    if (options.category) {
      query += ' AND category = ?';
      params.push(options.category);
    }
    if (options.ingestionDate) {
      query += ' AND ingestion_date = ?';
      params.push(options.ingestionDate);
    }
    if (options.adapterName) {
      query += ' AND adapter_name = ?';
      params.push(options.adapterName);
    }
    if (params.length === 0) {
      throw new Error('Must provide at least one filter to delete source data');
    }
    await this.db.run(query, ...params);
  }

  async getStats(): Promise<any> {
    const [total, dateRange, bySource, byAdapter, archiveTotal] = await Promise.all([
      this.db.get('SELECT COUNT(*) as count FROM source_data'),
      this.db.get(`
          SELECT
            MIN(COALESCE(ingestion_date, SUBSTRING(published_date, 1, 10))) as oldest_date,
            MAX(COALESCE(ingestion_date, SUBSTRING(published_date, 1, 10))) as newest_date
          FROM source_data
        `),
      this.db.all(`
          SELECT source, COUNT(*) as count
          FROM source_data
          GROUP BY source
          ORDER BY count DESC
          LIMIT 20
        `),
      this.db.all(`
          SELECT adapter_name, COUNT(*) as count
          FROM source_data
          GROUP BY adapter_name
          ORDER BY count DESC
          LIMIT 20
        `),
      this.db.get('SELECT COUNT(*) as count FROM source_data_archive')
    ]);

    return {
      total: total?.count || 0,
      ftsTotal: total?.count || 0,
      archiveTotal: archiveTotal?.count || 0,
      estimatedBytes: 0,
      oldestDate: dateRange?.oldest_date || null,
      newestDate: dateRange?.newest_date || null,
      bySource,
      byAdapter
    };
  }

  async optimize(): Promise<void> {
    await this.db.exec('ANALYZE source_data');
  }

  async archiveBefore(beforeDate: string, limit = 5000): Promise<number> {
    const rows = await this.db.all(
      `SELECT *
       FROM source_data
       WHERE COALESCE(ingestion_date, SUBSTRING(published_date, 1, 10)) < ?
       ORDER BY COALESCE(ingestion_date, SUBSTRING(published_date, 1, 10)) ASC
       LIMIT ?`,
      beforeDate,
      limit
    );
    if (!rows.length) return 0;

    await this.db.run('BEGIN');
    try {
      const archivedAt = Date.now();
      for (const row of rows) {
        await this.db.run(
          `INSERT INTO source_data_archive(id, archived_at, archive_reason, data)
           VALUES (?, ?, ?, ?)
           ON CONFLICT (id) DO UPDATE SET
             archived_at = excluded.archived_at,
             archive_reason = excluded.archive_reason,
             data = excluded.data`,
          row.id,
          archivedAt,
          `before:${beforeDate}`,
          JSON.stringify(row)
        );
        await this.db.run('DELETE FROM source_data WHERE id = ?', row.id);
      }
      await this.db.run('COMMIT');
      return rows.length;
    } catch (error) {
      await this.db.run('ROLLBACK');
      throw error;
    }
  }
}

function normalizeMetadataFilters(value: unknown): MetadataFilter[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is MetadataFilter => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    const path = (item as MetadataFilter).path;
    return typeof path === 'string' && /^[a-zA-Z0-9_.-]+$/.test(path);
  });
}

function buildMetadataFilterClause(filter: MetadataFilter): { sql: string; params: unknown[] } {
  const op = filter.op || 'exists';
  const jsonPath = `{${filter.path
    .split('.')
    .map((part) => part.replace(/"/g, '\\"'))
    .join(',')}}`;
  const textExpr = `s.metadata#>>'${jsonPath}'`;

  if (op === 'exists')
    return { sql: `(${textExpr} IS NOT NULL AND ${textExpr} != '')`, params: [] };
  if (op === 'notExists') return { sql: `(${textExpr} IS NULL OR ${textExpr} = '')`, params: [] };
  if (op === 'eq') return { sql: `${textExpr} = ?`, params: [String(filter.value)] };
  if (op === 'ne')
    return { sql: `(${textExpr} IS NULL OR ${textExpr} != ?)`, params: [String(filter.value)] };
  if (op === 'in') {
    const values = Array.isArray(filter.value) ? filter.value.map(String) : [];
    if (values.length === 0) return { sql: '1=0', params: [] };
    return { sql: `${textExpr} IN (${values.map(() => '?').join(', ')})`, params: values };
  }
  if (op === 'notIn') {
    const values = Array.isArray(filter.value) ? filter.value.map(String) : [];
    if (values.length === 0) return { sql: '1=1', params: [] };
    return {
      sql: `(${textExpr} IS NULL OR ${textExpr} NOT IN (${values.map(() => '?').join(', ')}))`,
      params: values
    };
  }
  if (['gt', 'gte', 'lt', 'lte'].includes(op)) {
    const sign = op === 'gt' ? '>' : op === 'gte' ? '>=' : op === 'lt' ? '<' : '<=';
    return { sql: `(${textExpr})::numeric ${sign} ?`, params: [Number(filter.value)] };
  }
  return { sql: '1=1', params: [] };
}
