import { BaseRepository } from './BaseRepository.js';

export class ApiKeyRepository extends BaseRepository {
  async list(): Promise<any[]> {
    const rows = await this.db.all('SELECT * FROM api_keys ORDER BY created_at DESC');
    return rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      prefix: row.prefix,
      sourceFingerprint: row.source_fingerprint,
      status: row.status,
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at
    }));
  }

  async save(apiKey: {
    id: string;
    name: string;
    keyHash: string;
    prefix: string;
    sourceFingerprint?: string;
    verificationToken?: string;
    status?: string;
    createdAt?: number;
  }): Promise<void> {
    await this.db.run(
      `INSERT INTO api_keys (
        id, name, key_hash, prefix, source_fingerprint, verification_token, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (id) DO UPDATE SET
        name = excluded.name,
        key_hash = excluded.key_hash,
        prefix = excluded.prefix,
        source_fingerprint = excluded.source_fingerprint,
        verification_token = excluded.verification_token,
        status = excluded.status`,
      apiKey.id,
      apiKey.name,
      apiKey.keyHash,
      apiKey.prefix,
      apiKey.sourceFingerprint || null,
      apiKey.verificationToken || null,
      apiKey.status || 'pending',
      apiKey.createdAt || Date.now()
    );
  }

  async getByVerificationToken(token: string): Promise<any | null> {
    return (
      (await this.db.get('SELECT * FROM api_keys WHERE verification_token = ?', token)) || null
    );
  }

  async updateStatus(id: string, status: string): Promise<void> {
    await this.db.run('UPDATE api_keys SET status = ? WHERE id = ?', status, id);
  }

  async updateName(id: string, name: string): Promise<void> {
    await this.db.run('UPDATE api_keys SET name = ? WHERE id = ?', name, id);
  }

  async getByFingerprint(fingerprint: string): Promise<any | null> {
    return (
      (await this.db.get('SELECT * FROM api_keys WHERE source_fingerprint = ?', fingerprint)) ||
      null
    );
  }

  async delete(id: string): Promise<void> {
    await this.db.run('DELETE FROM api_keys WHERE id = ?', id);
  }

  async getByPrefix(prefix: string): Promise<any[]> {
    return await this.db.all('SELECT * FROM api_keys WHERE prefix = ?', prefix);
  }

  async updateLastUsed(id: string): Promise<void> {
    await this.db.run('UPDATE api_keys SET last_used_at = ? WHERE id = ?', Date.now(), id);
  }
}
