import { Pool, types } from 'pg';
import { resolveDatabaseUrl } from '../../config/runtimeEnv.js';
import { LogService } from '../LogService.js';

/**
 * Type coercion overrides:
 * - INT8 (BIGINT) → JavaScript number to avoid pg returning bigint strings.
 * - JSONB → return parsed objects directly instead of strings.
 */
types.setTypeParser(20, (val) => Number(val));
types.setTypeParser(114, (val) => JSON.parse(val));
types.setTypeParser(3802, (val) => JSON.parse(val));

/**
 * Replace `?` positional placeholders with `$1, $2, ...` for PostgreSQL.
 */
function rewritePlaceholders(sql: string): string {
  let idx = 0;
  return sql.replace(/\?/g, () => `$${++idx}`);
}

/**
 * PostgreSQL adapter that exposes the same `get / all / run / exec` surface
 * so repository layers need minimal changes.
 */
export class PgConnection {
  public readonly pool: Pool;
  public readonly databaseUrl: string;

  constructor(databaseUrl?: string) {
    this.databaseUrl = databaseUrl || resolveDatabaseUrl();
    LogService.info(`Database URL: ${this.databaseUrl.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);

    this.pool = new Pool({
      connectionString: this.databaseUrl,
      max: 20,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000
    });

    this.pool.on('error', (err) => {
      LogService.error(`PostgreSQL pool error: ${err.message}`);
    });
  }

  /**
   * Return a single row (first match) or undefined.
   */
  async get<T = any>(sql: string, ...params: any[]): Promise<T | undefined> {
    const result = await this.pool.query({
      text: rewritePlaceholders(sql),
      values: params.length > 0 ? params : undefined,
      rowMode: 'array'
    });
    if (!result.rows.length) return undefined;
    const fields = result.fields.map((f) => f.name);
    const row: any = {};
    for (let i = 0; i < fields.length; i++) {
      row[fields[i]] = result.rows[0][i];
    }
    return row as T;
  }

  /**
   * Return all matching rows as an array.
   */
  async all<T = any>(sql: string, ...params: any[]): Promise<T[]> {
    const result = await this.pool.query({
      text: rewritePlaceholders(sql),
      values: params.length > 0 ? params : undefined,
      rowMode: 'array'
    });
    const fields = result.fields.map((f) => f.name);
    return result.rows.map((arr: any[]) => {
      const row: any = {};
      for (let i = 0; i < fields.length; i++) {
        row[fields[i]] = arr[i];
      }
      return row as T;
    });
  }

  /**
   * Execute a write statement (INSERT / UPDATE / DELETE) and return metadata:
   *   - `lastID`  : first value of RETURNING clause, or 0
   *   - `changes` : number of affected rows
   */
  async run(sql: string, ...params: any[]): Promise<{ lastID: number; changes: number }> {
    const result = await this.pool.query({
      text: rewritePlaceholders(sql),
      values: params.length > 0 ? params : undefined
    });
    const row = result.rows[0];
    return {
      lastID: row ? Number(Object.values(row)[0]) : 0,
      changes: result.rowCount ?? 0
    };
  }

  /**
   * Execute one or more raw SQL statements separated by `;` (no parameters).
   */
  async exec(sql: string): Promise<void> {
    await this.pool.query(sql);
  }

  /**
   * Release the pool.
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
}
