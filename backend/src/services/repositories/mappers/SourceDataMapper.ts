import type { UnifiedData } from '../../../types/index.js';

/**
 * `source_data` 表 row ↔ `UnifiedData` 实体的转换。
 * 适配 PostgreSQL JSONB 列：`row.metadata` 可能是对象或字符串。
 */

interface SourceDataRow {
  id: string;
  title: string;
  url: string | null;
  description: string | null;
  published_date: string | null;
  source: string | null;
  category: string | null;
  author: string | null;
  ingestion_date: string | null;
  metadata: string | Record<string, unknown> | null;
  status: string | null;
}

function safeMetadata(raw: string | Record<string, unknown> | null): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export const SourceDataMapper = {
  toEntity(row: SourceDataRow | undefined): UnifiedData | null {
    if (!row) return null;
    return {
      id: row.id,
      title: row.title,
      url: row.url ?? undefined,
      description: row.description ?? undefined,
      published_date: row.published_date ?? undefined,
      source: row.source ?? undefined,
      category: row.category ?? undefined,
      author: row.author ?? undefined,
      ingestion_date: row.ingestion_date ?? undefined,
      metadata: safeMetadata(row.metadata),
      status: row.status ?? undefined
    } as UnifiedData;
  },
  toEntityList(rows: SourceDataRow[]): UnifiedData[] {
    return rows.map((row) => SourceDataMapper.toEntity(row)!).filter(Boolean);
  }
};
