import type { DailyCoverageIndexRow } from '../../types/dailyCoverage.js';
import { BaseRepository } from './BaseRepository.js';

export class DailyCoverageRepository extends BaseRepository {
  async deleteByDate(date: string): Promise<void> {
    await this.db.run('DELETE FROM daily_coverage_index WHERE date = ?', date);
  }

  async insertRows(rows: DailyCoverageIndexRow[]): Promise<void> {
    for (const row of rows) {
      await this.db.run(
        `INSERT INTO daily_coverage_index (date, topic_id, url_norm, headline, section, importance_rank, ingested_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        row.date,
        row.topic_id,
        row.url_norm,
        row.headline,
        row.section,
        row.importance_rank,
        row.ingested_at
      );
    }
  }

  async listInDateRange(
    startDate: string,
    endDateExclusive: string
  ): Promise<DailyCoverageIndexRow[]> {
    const rows = await this.db.all(
      `SELECT date, topic_id, url_norm, headline, section, importance_rank, ingested_at
       FROM daily_coverage_index
       WHERE date >= ? AND date < ?
       ORDER BY date DESC, importance_rank ASC`,
      startDate,
      endDateExclusive
    );
    return rows.map((row: any) => ({
      date: row.date,
      topic_id: row.topic_id,
      url_norm: row.url_norm,
      headline: row.headline || '',
      section: row.section || '',
      importance_rank: row.importance_rank ?? 999,
      ingested_at: row.ingested_at
    }));
  }

  async listDistinctUrlsInRange(startDate: string, endDateExclusive: string): Promise<string[]> {
    const rows = await this.db.all(
      `SELECT DISTINCT url_norm FROM daily_coverage_index WHERE date >= ? AND date < ? AND url_norm != ''`,
      startDate,
      endDateExclusive
    );
    return rows.map((r: any) => r.url_norm as string);
  }
}
