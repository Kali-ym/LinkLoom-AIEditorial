import { parseJsonOrFallback } from '../../shared/json.js';
import type { PgConnection } from './DatabaseConnection.js';

export class BaseRepository {
  constructor(protected readonly conn: PgConnection) {}

  protected get db() {
    return this.conn;
  }

  protected parseJson<T>(value: string | T | null | undefined, fallback: T): T {
    if (value == null) return fallback;
    if (typeof value === 'string') return parseJsonOrFallback<T>(value, fallback);
    return value;
  }
}
