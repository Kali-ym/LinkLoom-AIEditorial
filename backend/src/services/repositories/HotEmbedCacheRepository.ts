import { BaseRepository } from './BaseRepository.js';

export class HotEmbedCacheRepository extends BaseRepository {
  async getMany(
    modelKey: string,
    contentHashes: string[]
  ): Promise<Map<string, number[]>> {
    const out = new Map<string, number[]>();
    const hashes = [...new Set(contentHashes.filter(Boolean))];
    if (!modelKey || hashes.length === 0) return out;

    const placeholders = hashes.map(() => '?').join(',');
    const rows = await this.db.all<{
      content_hash: string;
      embedding: number[] | string;
      dimensions: number;
    }>(
      `SELECT content_hash, embedding, dimensions
       FROM hot_embed_cache
       WHERE model_key = ? AND content_hash IN (${placeholders})`,
      modelKey,
      ...hashes
    );

    for (const row of rows) {
      const vec =
        typeof row.embedding === 'string' ? (JSON.parse(row.embedding) as number[]) : row.embedding;
      if (Array.isArray(vec) && vec.length > 0) {
        out.set(row.content_hash, vec);
      }
    }

    if (out.size > 0) {
      const hitHashes = [...out.keys()];
      const hitPh = hitHashes.map(() => '?').join(',');
      await this.db.run(
        `UPDATE hot_embed_cache SET last_used_at = NOW()
         WHERE model_key = ? AND content_hash IN (${hitPh})`,
        modelKey,
        ...hitHashes
      );
    }

    return out;
  }

  async upsertMany(
    modelKey: string,
    rows: Array<{ contentHash: string; dimensions: number; embedding: number[] }>
  ): Promise<void> {
    if (!modelKey || rows.length === 0) return;
    for (const row of rows) {
      if (!row.contentHash || !row.embedding?.length) continue;
      await this.db.run(
        `INSERT INTO hot_embed_cache (content_hash, model_key, dimensions, embedding, created_at, last_used_at)
         VALUES (?, ?, ?, ?, NOW(), NOW())
         ON CONFLICT (content_hash, model_key) DO UPDATE SET
           dimensions = EXCLUDED.dimensions,
           embedding = EXCLUDED.embedding,
           last_used_at = NOW()`,
        row.contentHash,
        modelKey,
        row.dimensions,
        JSON.stringify(row.embedding)
      );
    }
  }
}
