import { BaseRepository } from './BaseRepository.js';

export class HistoryRepository extends BaseRepository {
  async save(record: {
    date: string;
    platform: string;
    filePath: string;
    commitMessage?: string;
    fullContent?: string;
  }): Promise<number> {
    const result = await this.db.run(
      `INSERT INTO commit_history (date, platform, file_path, commit_message, commit_time, full_content)
       VALUES (?, ?, ?, ?, ?, ?)
       RETURNING id`,
      record.date,
      record.platform,
      record.filePath,
      record.commitMessage || '',
      Date.now(),
      record.fullContent || ''
    );
    return result.lastID;
  }

  async getById(id: number): Promise<any | null> {
    const row = await this.db.get('SELECT * FROM commit_history WHERE id = ?', id);
    if (!row) return null;
    return {
      id: row.id,
      date: row.date,
      platform: row.platform,
      filePath: row.file_path,
      commitMessage: row.commit_message,
      commitTime: row.commit_time,
      fullContent: row.full_content || ''
    };
  }

  async list(options?: {
    date?: string;
    dates?: string[];
    platform?: string;
    limit?: number;
    offset?: number;
    search?: string;
  }): Promise<{ records: any[]; total: number }> {
    let query = 'SELECT * FROM commit_history WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) as total FROM commit_history WHERE 1=1';
    const params: any[] = [];
    const countParams: any[] = [];

    if (options?.date) {
      query += ' AND date = ?';
      countQuery += ' AND date = ?';
      params.push(options.date);
      countParams.push(options.date);
    }
    if (options?.dates && options.dates.length > 0) {
      const placeholders = options.dates.map(() => '?').join(', ');
      query += ` AND date IN (${placeholders})`;
      countQuery += ` AND date IN (${placeholders})`;
      params.push(...options.dates);
      countParams.push(...options.dates);
    }
    if (options?.platform) {
      query += ' AND platform = ?';
      countQuery += ' AND platform = ?';
      params.push(options.platform);
      countParams.push(options.platform);
    }
    if (options?.search) {
      const searchPattern = `%${options.search}%`;
      query += ' AND (date LIKE ? OR platform LIKE ? OR file_path LIKE ? OR commit_message LIKE ?)';
      countQuery +=
        ' AND (date LIKE ? OR platform LIKE ? OR file_path LIKE ? OR commit_message LIKE ?)';
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
      countParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    query += ' ORDER BY commit_time DESC';
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
      records: rows.map((row: any) => ({
        id: row.id,
        date: row.date,
        platform: row.platform,
        filePath: row.file_path,
        commitMessage: row.commit_message,
        commitTime: row.commit_time,
        fullContent: row.full_content || ''
      })),
      total: countResult?.total || 0
    };
  }

  async getCommittedDates(): Promise<string[]> {
    const rows = await this.db.all('SELECT DISTINCT date FROM commit_history ORDER BY date DESC');
    return rows.map((row: any) => row.date);
  }

  async delete(id: number): Promise<void> {
    await this.db.run('DELETE FROM commit_history WHERE id = ?', id);
  }
}
