#!/usr/bin/env node
/**
 * One-time migration: SQLite (data/database.sqlite) → PostgreSQL (DATABASE_URL).
 *
 * Usage:
 *   DATABASE_URL=postgres://linkloom:linkloom@127.0.0.1:5432/linkloom \
 *     node backend/scripts/migrate-sqlite-to-postgres.mjs
 *
 * Options:
 *   --sqlite-path=PATH   default: data/database.sqlite
 *   --dry-run            print counts only, no writes
 */

import { execFileSync } from 'child_process';
import path from 'path';
import pg from 'pg';

const { Pool } = pg;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const sqlitePathArg = args.find((a) => a.startsWith('--sqlite-path='));
const sqlitePath = path.resolve(
  sqlitePathArg?.split('=')[1] ?? path.join(process.cwd(), 'data/database.sqlite')
);
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

/** Tables in FK-safe insert order (FTS / sqlite internal tables excluded). */
const TABLE_SPECS = [
  { name: 'kv', hasSerial: false },
  { name: 'schema_migrations', hasSerial: false },
  { name: 'memory_categories', hasSerial: false },
  { name: 'agent_memories', hasSerial: false },
  { name: 'kb_categories', hasSerial: false },
  { name: 'kb_documents', hasSerial: false },
  { name: 'kb_chunks', hasSerial: false },
  { name: 'agents', hasSerial: false },
  { name: 'skills', hasSerial: false },
  { name: 'workflows', hasSerial: false },
  { name: 'mcp_configs', hasSerial: false },
  { name: 'schedules', hasSerial: false },
  { name: 'source_data', hasSerial: false },
  { name: 'source_data_archive', hasSerial: false },
  { name: 'api_keys', hasSerial: false },
  { name: 'commit_history', hasSerial: true, serial: 'commit_history_id_seq' },
  { name: 'daily_coverage_index', hasSerial: true, serial: 'daily_coverage_index_id_seq' },
  { name: 'publication_items', hasSerial: true, serial: 'publication_items_id_seq' },
  { name: 'task_logs', hasSerial: true, serial: 'task_logs_id_seq' }
];

const JSONB_COLUMNS = new Set(['metadata', 'tags', 'data']);

function readSqliteTable(table) {
  const script = `
import json, sqlite3, sys
conn = sqlite3.connect(sys.argv[1])
conn.row_factory = sqlite3.Row
rows = [dict(r) for r in conn.execute('SELECT * FROM ${table}')]
print(json.dumps(rows, ensure_ascii=False))
conn.close()
`;
  const out = execFileSync('python3', ['-c', script, sqlitePath], {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024
  });
  return JSON.parse(out || '[]');
}

function synthesizeCommitHistoryRows(commitHistoryRows, publicationItemRows) {
  const byId = new Map(commitHistoryRows.map((row) => [row.id, row]));
  const missingIds = new Set(
    publicationItemRows.map((row) => row.history_id).filter((id) => !byId.has(id))
  );

  const stubs = [...missingIds].map((id) => {
    const items = publicationItemRows.filter((row) => row.history_id === id);
    const dates = items
      .map((row) => row.date)
      .filter(Boolean)
      .sort();
    const createdAt = items
      .map((row) => row.created_at)
      .filter((value) => typeof value === 'number')
      .sort((a, b) => a - b)[0];
    return {
      id,
      date: dates[0] ?? '1970-01-01',
      platform: 'migrated',
      file_path: `migrated:history:${id}`,
      commit_message: 'Recovered stub for orphaned publication_items during SQLite migration',
      commit_time: createdAt ?? Date.now(),
      full_content: null
    };
  });

  if (stubs.length > 0) {
    console.warn(
      `Synthesizing ${stubs.length} commit_history stub(s) for orphaned publication_items`
    );
  }

  return [...commitHistoryRows, ...stubs].sort((a, b) => a.id - b.id);
}

function filterRows(table, rows, context) {
  if (table === 'kb_chunks') {
    const docIds = new Set((context.kb_documents ?? []).map((r) => r.id));
    const kept = rows.filter((r) => docIds.has(r.document_id));
    const skipped = rows.length - kept.length;
    if (skipped > 0) {
      console.warn(`Skipping ${skipped} orphaned kb_chunks (document missing in kb_documents)`);
    }
    return kept;
  }
  if (table === 'agent_memories') {
    const catIds = new Set((context.memory_categories ?? []).map((r) => r.id));
    return rows.filter((r) => !r.category_id || catIds.has(r.category_id));
  }
  if (table === 'kb_documents') {
    const catIds = new Set((context.kb_categories ?? []).map((r) => r.id));
    return rows.filter((r) => catIds.has(r.category_id));
  }
  if (table === 'publication_items') {
    const historyIds = new Set((context.commit_history ?? []).map((r) => r.id));
    return rows.filter((r) => historyIds.has(r.history_id));
  }
  return rows;
}

function normalizeValue(column, value) {
  if (value === undefined) return null;
  if (JSONB_COLUMNS.has(column)) {
    if (value === null || value === '') return null;
    if (typeof value === 'object') return JSON.stringify(value);
    return value;
  }
  return value;
}

async function truncateTarget(client) {
  const tables = TABLE_SPECS.map((t) => t.name).join(', ');
  await client.query(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);
}

async function insertRows(client, table, rows) {
  if (!rows.length) return 0;

  const columns = Object.keys(rows[0]);
  const colList = columns.map((c) => `"${c}"`).join(', ');
  const placeholders = columns
    .map((col, i) => (JSONB_COLUMNS.has(col) ? `$${i + 1}::jsonb` : `$${i + 1}`))
    .join(', ');

  let inserted = 0;
  for (const row of rows) {
    const values = columns.map((col) => normalizeValue(col, row[col]));
    await client.query(`INSERT INTO ${table} (${colList}) VALUES (${placeholders})`, values);
    inserted += 1;
  }
  return inserted;
}

async function resetSerial(client, spec) {
  if (!spec.hasSerial || !spec.serial) return;
  await client.query(
    `SELECT setval('${spec.serial}', COALESCE((SELECT MAX(id) FROM ${spec.name}), 1), true)`
  );
}

async function main() {
  console.log(`SQLite source: ${sqlitePath}`);
  console.log(`PostgreSQL target: ${databaseUrl.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);
  if (dryRun) console.log('DRY RUN — no writes');

  const counts = {};
  for (const spec of TABLE_SPECS) {
    const rows = readSqliteTable(spec.name);
    counts[spec.name] = rows.length;
  }
  console.log('Source row counts:', counts);

  if (dryRun) return;

  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await truncateTarget(client);

    const imported = {};
    const context = {};
    for (const spec of TABLE_SPECS) {
      const rawRows = readSqliteTable(spec.name);
      if (spec.name === 'commit_history') {
        context.publication_items = readSqliteTable('publication_items');
        context[spec.name] = synthesizeCommitHistoryRows(rawRows, context.publication_items);
      } else {
        context[spec.name] = rawRows;
      }
      const rows = filterRows(spec.name, context[spec.name], context);
      imported[spec.name] = await insertRows(client, spec.name, rows);
      await resetSerial(client, spec);
    }

    await client.query('COMMIT');
    console.log(
      JSON.stringify(
        {
          status: 'ok',
          imported,
          hint: 'Restart LinkLoom (docker compose restart linkloom) before serving traffic.'
        },
        null,
        2
      )
    );
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

await main();
