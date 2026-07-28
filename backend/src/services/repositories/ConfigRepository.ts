import { BaseRepository } from './BaseRepository.js';

export class ConfigRepository extends BaseRepository {
  async get(key: string): Promise<any> {
    const row = await this.db.get('SELECT value, expires_at FROM kv WHERE key = ?', key);
    if (!row) return null;
    if (row.expires_at && row.expires_at < Date.now()) {
      await this.delete(key);
      return null;
    }
    try {
      return JSON.parse(row.value);
    } catch {
      return row.value;
    }
  }

  async put(key: string, value: any, expirationTtl?: number): Promise<void> {
    const valStr = typeof value === 'string' ? value : JSON.stringify(value);
    const expiresAt = expirationTtl ? Date.now() + expirationTtl * 1000 : null;
    await this.db.run(
      `INSERT INTO kv (key, value, expires_at) VALUES (?, ?, ?)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at`,
      key,
      valStr,
      expiresAt
    );
  }

  async delete(key: string): Promise<void> {
    await this.db.run('DELETE FROM kv WHERE key = ?', key);
  }

  async getAllKeys(): Promise<string[]> {
    const rows = await this.db.all('SELECT key FROM kv');
    return rows.map((row: any) => row.key);
  }
}
