import type { PublicationItem, PublicationItemInput } from '../../types/dailyCoverage.js';
import { BaseRepository } from './BaseRepository.js';

export class PublicationHistoryRepository extends BaseRepository {
  async deleteItemsByHistoryId(historyId: number): Promise<void> {
    await this.db.run('DELETE FROM publication_items WHERE history_id = ?', historyId);
  }

  async upsertItems(items: PublicationItemInput[]): Promise<void> {
    for (const item of items) {
      await this.db.run(
        `INSERT INTO publication_items (
          history_id, date, topic_id, title, url_norm, section, importance_rank, metadata, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(history_id, topic_id, url_norm) DO UPDATE SET
          date = excluded.date,
          title = excluded.title,
          section = excluded.section,
          importance_rank = excluded.importance_rank,
          metadata = excluded.metadata,
          created_at = excluded.created_at`,
        item.historyId,
        item.date,
        item.topicId,
        item.title,
        item.urlNorm,
        item.section,
        item.importanceRank,
        JSON.stringify(item.metadata || {}),
        item.createdAt || Date.now()
      );
    }
  }

  async listItemsByHistoryId(historyId: number): Promise<PublicationItem[]> {
    const rows = await this.db.all(
      `SELECT * FROM publication_items
       WHERE history_id = ?
       ORDER BY importance_rank ASC, id ASC`,
      historyId
    );
    return rows.map((row: any) => this.mapItem(row));
  }

  async listItemsInDateRange(
    startDate: string,
    endDateExclusive: string
  ): Promise<PublicationItem[]> {
    const rows = await this.db.all(
      `SELECT * FROM publication_items
       WHERE date >= ? AND date < ?
       ORDER BY date DESC, importance_rank ASC, id ASC`,
      startDate,
      endDateExclusive
    );
    return rows.map((row: any) => this.mapItem(row));
  }

  async listDistinctUrlsInRange(startDate: string, endDateExclusive: string): Promise<string[]> {
    const rows = await this.db.all(
      `SELECT DISTINCT url_norm FROM publication_items
       WHERE date >= ? AND date < ? AND url_norm != ''`,
      startDate,
      endDateExclusive
    );
    return rows.map((row: any) => row.url_norm as string);
  }

  private mapItem(row: any): PublicationItem {
    return {
      id: row.id,
      historyId: row.history_id,
      date: row.date,
      topicId: row.topic_id,
      title: row.title || '',
      urlNorm: row.url_norm || '',
      section: row.section || '',
      importanceRank: row.importance_rank ?? 999,
      metadata: this.parseMetadata(row.metadata),
      createdAt: row.created_at
    };
  }

  private parseMetadata(value: string | null | undefined | object): Record<string, unknown> {
    if (!value) return {};
    if (typeof value === 'object') return value as Record<string, unknown>;
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
}
