import { BaseRepository } from './BaseRepository.js';
import {
  buildTokenLikeClauses,
  buildTsQuery,
  buildWeightedTokenScoreExpression,
  makeTextSnippet,
  parseJsonArray,
  parseJsonObject,
  tokenizeSearchQuery
} from './searchUtils.js';

export class MemoryRepository extends BaseRepository {
  async listCategories(): Promise<any[]> {
    const rows = await this.db.all('SELECT * FROM memory_categories ORDER BY updated_at DESC');
    return rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      entryCount: row.entry_count,
      updatedAt: row.updated_at
    }));
  }

  async getCategory(id: string): Promise<any | null> {
    const row = await this.db.get('SELECT * FROM memory_categories WHERE id = ?', id);
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      entryCount: row.entry_count,
      updatedAt: row.updated_at
    };
  }

  async saveCategory(category: any): Promise<void> {
    await this.db.run(
      `INSERT INTO memory_categories (id, name, description, entry_count, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET
         name = excluded.name, description = excluded.description,
         entry_count = excluded.entry_count, updated_at = excluded.updated_at`,
      category.id,
      category.name,
      category.description || '',
      category.entryCount || 0,
      category.updatedAt || Date.now()
    );
  }

  async deleteCategory(id: string): Promise<void> {
    await this.db.run('DELETE FROM memory_categories WHERE id = ?', id);
  }

  async listByCategory(categoryId: string): Promise<any[]> {
    const rows = await this.db.all(
      'SELECT * FROM agent_memories WHERE category_id = ? ORDER BY created_at DESC',
      categoryId
    );
    return rows.map((row: any) => this.mapMemory(row));
  }

  async get(id: string): Promise<any | null> {
    const row = await this.db.get('SELECT * FROM agent_memories WHERE id = ?', id);
    return row ? this.mapMemory(row) : null;
  }

  async save(memory: any): Promise<void> {
    await this.db.run(
      `INSERT INTO agent_memories (id, agent_id, category_id, content, importance, tags, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET
         agent_id = excluded.agent_id, category_id = excluded.category_id,
         content = excluded.content, importance = excluded.importance,
         tags = excluded.tags, metadata = excluded.metadata`,
      memory.id,
      memory.agentId || null,
      memory.categoryId || null,
      memory.content,
      memory.importance || 1,
      memory.tags ? JSON.stringify(memory.tags) : null,
      memory.metadata ? JSON.stringify(memory.metadata) : null,
      memory.createdAt || Date.now()
    );
  }

  async findDuplicateHash(hash: string): Promise<any | null> {
    const row = await this.db.get(
      `SELECT * FROM agent_memories
       WHERE metadata->>'hash' = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      hash
    );
    return row ? this.mapMemory(row) : null;
  }

  async search(
    query: string,
    options: {
      agentId?: string;
      tags?: string[];
      categoryIds?: string[];
      limit?: number;
      minImportance?: number;
    } = {}
  ): Promise<any[]> {
    const limit = options.limit || 20;
    const tsQuery = buildTsQuery(query);
    const ftsRows = tsQuery ? await this.searchWithFts(tsQuery, options, limit) : [];
    const fallbackRows = await this.searchWithLike(query, options, limit);
    const merged = new Map<string, any>();
    for (const row of [...ftsRows, ...fallbackRows]) {
      const existing = merged.get(row.id);
      if (!existing || (row.score ?? 0) > (existing.score ?? 0)) {
        merged.set(row.id, row);
      }
    }
    return this.filterByTags(
      Array.from(merged.values())
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || b.createdAt - a.createdAt)
        .slice(0, limit),
      options.tags
    );
  }

  private async searchWithFts(
    tsQuery: string,
    options: {
      agentId?: string;
      tags?: string[];
      categoryIds?: string[];
      minImportance?: number;
    },
    limit: number
  ): Promise<any[]> {
    let sql = `
      SELECT
        m.*,
        ts_rank(
          setweight(coalesce(m.search_vector, ''::tsvector), 'A') ||
          setweight(to_tsvector('simple', coalesce(m.metadata->>'summary','')), 'B'),
          plainto_tsquery('simple', ?)
        ) as search_rank,
        ts_headline('simple', m.content, plainto_tsquery('simple', ?),
          'StartSel=【, StopSel=】, MaxWords=20, MinWords=10') as snippet
      FROM agent_memories m
      WHERE (
        m.search_vector @@ plainto_tsquery('simple', ?) OR
        to_tsvector('simple', coalesce(m.metadata->>'summary','')) @@ plainto_tsquery('simple', ?)
      )
    `;
    const params: any[] = [tsQuery, tsQuery, tsQuery, tsQuery];
    sql += this.buildSearchFilters(options, params);
    sql += ` ORDER BY (
      (ts_rank(
        setweight(coalesce(m.search_vector, ''::tsvector), 'A') ||
        setweight(to_tsvector('simple', coalesce(m.metadata->>'summary','')), 'B'),
        plainto_tsquery('simple', ?)
      ) * 100.0) +
      (m.importance * 2.0) +
      (m.created_at / 1e12)
    ) DESC`;
    params.push(tsQuery);
    sql += ' LIMIT ?';
    params.push(limit);

    const rows = await this.db.all(sql, ...params);
    return rows.map((row: any) => ({
      ...this.mapMemory(row),
      rank: row.search_rank,
      score: Number(row.search_rank || 0) * 100 + Number(row.importance || 0) * 2,
      snippet: row.snippet
    }));
  }

  private async searchWithLike(
    query: string,
    options: {
      agentId?: string;
      tags?: string[];
      categoryIds?: string[];
      minImportance?: number;
    },
    limit: number
  ): Promise<any[]> {
    const tokens = tokenizeSearchQuery(query);
    if (tokens.length === 0) return [];

    const params: any[] = [];
    const normalizedQuery = `%${query.toLowerCase()}%`;
    params.push(normalizedQuery, normalizedQuery, normalizedQuery);
    const tokenScore = buildWeightedTokenScoreExpression(
      [
        { field: 'm.content', weight: 4 },
        { field: "coalesce(m.metadata->>'summary','')", weight: 3 },
        { field: "coalesce(m.tags::text,'')", weight: 2 }
      ],
      tokens,
      params
    );

    let sql = `
      SELECT m.*,
        (
          CASE WHEN LOWER(m.content) LIKE ? THEN 6 ELSE 0 END +
          CASE WHEN LOWER(coalesce(m.metadata->>'summary','')) LIKE ? THEN 4 ELSE 0 END +
          CASE WHEN LOWER(coalesce(m.tags::text,'')) LIKE ? THEN 3 ELSE 0 END
        ) as exact_score,
        (${tokenScore}) as token_score
      FROM agent_memories m
      WHERE 1=1
    `;
    sql += this.buildSearchFilters(options, params);

    const likeClauses = buildTokenLikeClauses(
      ['m.content', "coalesce(m.metadata->>'summary','')", "coalesce(m.tags::text,'')"],
      tokens,
      params
    );
    sql += ` AND (${likeClauses.join(' OR ')})`;

    sql += ` ORDER BY exact_score DESC, token_score DESC, m.importance DESC, m.created_at DESC LIMIT ?`;
    params.push(limit);

    const rows = await this.db.all(sql, ...params);
    return this.filterByTags(
      rows.map((row: any) => {
        const memory = this.mapMemory(row);
        return {
          ...memory,
          rank: 999,
          score:
            Number(row.exact_score || 0) +
            Number(row.token_score || 0) +
            Number(row.importance || 0) * 2 +
            Number(row.created_at || 0) / 1e12,
          snippet: makeTextSnippet(
            [memory.content, memory.metadata?.summary, memory.tags.join(' ')]
              .filter(Boolean)
              .join('\n'),
            tokens
          )
        };
      }),
      options.tags
    );
  }

  private buildSearchFilters(
    options: {
      agentId?: string;
      categoryIds?: string[];
      minImportance?: number;
    },
    params: any[]
  ): string {
    let sql = '';
    if (options.agentId) {
      sql += ' AND m.agent_id = ?';
      params.push(options.agentId);
    }
    if (options.minImportance) {
      sql += ' AND m.importance >= ?';
      params.push(options.minImportance);
    }
    if (options.categoryIds && options.categoryIds.length > 0) {
      sql += ` AND m.category_id IN (${options.categoryIds.map(() => '?').join(', ')})`;
      params.push(...options.categoryIds);
    }
    return sql;
  }

  private filterByTags(rows: any[], tags?: string[]): any[] {
    if (!tags || tags.length === 0) return rows;
    const wanted = new Set(tags.map((tag) => tag.toLowerCase()));
    return rows.filter((row) => {
      const rowTags = Array.isArray(row.tags) ? row.tags : [];
      return rowTags.some((tag: string) => wanted.has(tag.toLowerCase()));
    });
  }

  async delete(id: string): Promise<void> {
    await this.db.run('DELETE FROM agent_memories WHERE id = ?', id);
  }

  async listAll(): Promise<any[]> {
    const rows = await this.db.all('SELECT * FROM agent_memories ORDER BY created_at DESC');
    return rows.map((row: any) => this.mapMemory(row));
  }

  private mapMemory(row: any) {
    return {
      id: row.id,
      agentId: row.agent_id,
      categoryId: row.category_id,
      content: row.content,
      importance: row.importance,
      tags: parseJsonArray(row.tags),
      metadata: parseJsonObject(row.metadata),
      createdAt: row.created_at
    };
  }
}
