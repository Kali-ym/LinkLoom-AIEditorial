#!/usr/bin/env node
/**
 * Channel bindings seed/import CLI.
 *
 * Reads a JSON file (default: infra/seeds/channel-bindings.json) and upserts
 * each entry. Useful for first-time setup and for restoring backups in dev.
 *
 * Usage:
 *   pnpm tsx backend/scripts/seed-channel-bindings.ts                       # default path
 *   pnpm tsx backend/scripts/seed-channel-bindings.ts path/to/bindings.json
 *   LINKLOOM_DRY_RUN=1 pnpm tsx backend/scripts/seed-channel-bindings.ts   # print, don't write
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PgConnection } from '../src/services/repositories/DatabaseConnection.js';
import { ChannelBindingStore } from '../src/services/gateway/ChannelBindingStore.js';
import { SchemaMigrator } from '../src/services/repositories/SchemaMigrator.js';
import type { ChannelBindingInput } from '../src/services/gateway/channelBindingTypes.js';

async function main() {
  const argPath = process.argv[2];
  const path = resolve(argPath ?? 'infra/seeds/channel-bindings.json');
  const dryRun = process.env.LINKLOOM_DRY_RUN === '1';

  let raw: string;
  try {
    raw = readFileSync(path, 'utf-8');
  } catch (err) {
    console.error(`✗ cannot read ${path}: ${(err as Error).message}`);
    process.exit(1);
  }

  let entries: ChannelBindingInput[];
  try {
    const parsed = JSON.parse(raw) as { bindings: ChannelBindingInput[] } | ChannelBindingInput[];
    entries = Array.isArray(parsed) ? parsed : parsed.bindings;
    if (!Array.isArray(entries)) {
      throw new Error('JSON must be an array of bindings or { bindings: [...] }');
    }
  } catch (err) {
    console.error(`✗ invalid JSON in ${path}: ${(err as Error).message}`);
    process.exit(1);
  }

  if (dryRun) {
    console.log(`[dry-run] would upsert ${entries.length} bindings:`);
    for (const e of entries) {
      console.log(`  - ${e.channel}/${e.accountId ?? '*'}/${e.peerId ?? '*'} → ${e.agentId} (priority=${e.priority ?? 0})`);
    }
    return;
  }

  const conn = new PgConnection();
  try {
    // Ensure schema is up to date; the seed is idempotent and rerunnable.
    await new SchemaMigrator(conn).migrate();
    const store = new ChannelBindingStore(conn);

    let ok = 0;
    for (const e of entries) {
      if (!e.channel || !e.agentId) {
        console.error(`✗ skip invalid entry: ${JSON.stringify(e)}`);
        continue;
      }
      const b = await store.upsert({
        ...e,
        description: e.description ?? `Seeded from ${path}`,
      });
      console.log(`✓ ${b.id} ${b.channel}/${b.accountId ?? '*'}/${b.peerId ?? '*'} → ${b.agentId}`);
      ok++;
    }
    console.log(`\nDone: ${ok}/${entries.length} bindings upserted.`);
  } finally {
    await conn.close();
  }
}

main().catch((err) => {
  console.error('seed failed:', err);
  process.exit(1);
});
