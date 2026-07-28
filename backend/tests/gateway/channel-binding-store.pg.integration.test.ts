import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ChannelBindingStore } from '../../src/services/gateway/ChannelBindingStore.js';
import { PgConnection } from '../../src/services/repositories/DatabaseConnection.js';
import { SchemaMigrator } from '../../src/services/repositories/SchemaMigrator.js';
import { resolveDatabaseUrl } from '../../src/config/runtimeEnv.js';

/**
 * Real PG integration test for ChannelBindingStore. Runs only when:
 *   1. LINKLOOM_TEST_PG=1 is set, AND
 *   2. resolveDatabaseUrl() yields a reachable Postgres instance.
 *
 * The test creates a temp schema, runs all migrations into it, and exercises
 * the real SQL the store emits — including the partial unique index that
 * no in-memory fake can model.
 *
 * Run locally with:
 *   LINKLOOM_TEST_PG=1 \
 *   LINKLOOM_DATABASE_URL=postgres://postgres:postgres@localhost:5432/linkloom_test \
 *   pnpm vitest run backend/tests/gateway/channel-binding-store.pg.integration.test.ts
 */

const REQUIRES_PG = !!process.env.LINKLOOM_TEST_PG;

async function pgReachable(): Promise<boolean> {
  if (!REQUIRES_PG) return false;
  try {
    const conn = new PgConnection(resolveDatabaseUrl());
    await conn.get('SELECT 1 AS ok');
    await conn.close();
    return true;
  } catch {
    return false;
  }
}

describe.skipIf(!REQUIRES_PG)('ChannelBindingStore PG integration', () => {
  let conn: PgConnection;
  let store: ChannelBindingStore;
  let schema: string;

  beforeAll(async () => {
    if (!(await pgReachable())) {
      throw new Error(
        'LINKLOOM_TEST_PG=1 but Postgres is not reachable at LINKLOOM_DATABASE_URL. ' +
          'Start one (docker run -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16) ' +
          'or unset LINKLOOM_TEST_PG to skip this suite.'
      );
    }
    conn = new PgConnection(resolveDatabaseUrl());
    schema = `linkloom_cb_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await conn.exec(`CREATE SCHEMA "${schema}"`);
    await conn.exec(`SET search_path TO "${schema}"`);
    await new SchemaMigrator(conn).migrate();
    store = new ChannelBindingStore(conn);
  }, 30_000);

  afterAll(async () => {
    if (conn) {
      try {
        await conn.exec(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      } finally {
        await conn.close();
      }
    }
  });

  it('upsert + resolve 4-level priority: specific > account > peer > channel', async () => {
    const a1 = await store.upsert({ channel: 'tg', accountId: 'alice', peerId: 'p1', agentId: 'a-specific' });
    const a2 = await store.upsert({ channel: 'tg', accountId: 'alice', agentId: 'a-acct' });
    const a3 = await store.upsert({ channel: 'tg', peerId: 'p2', agentId: 'a-peer' });
    const a4 = await store.upsert({ channel: 'tg', agentId: 'a-tg-default' });
    expect([a1, a2, a3, a4].map((b) => b.agentId)).toEqual([
      'a-specific',
      'a-acct',
      'a-peer',
      'a-tg-default',
    ]);

    // exact (channel, account, peer) → specific
    const r1 = await store.resolve({ channel: 'tg', accountId: 'alice', peerId: 'p1' });
    expect(r1?.agentId).toBe('a-specific');
    expect(r1?.matchLevel).toBe(1);
    expect(r1?.strategy).toBe('specific');

    // (channel, account, different peer) → account
    const r2 = await store.resolve({ channel: 'tg', accountId: 'alice', peerId: 'p-other' });
    expect(r2?.agentId).toBe('a-acct');
    expect(r2?.matchLevel).toBe(2);

    // (channel, different account, peer that has peer-level) → peer
    const r3 = await store.resolve({ channel: 'tg', accountId: 'bob', peerId: 'p2' });
    expect(r3?.agentId).toBe('a-peer');
    expect(r3?.matchLevel).toBe(3);

    // (channel, any account, any peer) → channel default
    const r4 = await store.resolve({ channel: 'tg', accountId: 'bob', peerId: 'p-other' });
    expect(r4?.agentId).toBe('a-tg-default');
    expect(r4?.matchLevel).toBe(4);
  });

  it('partial unique index forbids two active rules with same (channel, account, peer)', async () => {
    await store.upsert({ channel: 'cli', agentId: 'a-1' });
    // Second upsert with same (channel='cli', account=null, peer=null) must
    // deactivate the first one (not throw). Both active rules are forbidden
    // by idx_channel_bindings_unique.
    const b = await store.upsert({ channel: 'cli', agentId: 'a-2' });
    expect(b.isEnabled).toBe(true);

    // After upsert, only one rule should be active for (cli, *, *).
    const all = await store.list({ channel: 'cli' });
    const active = all.filter((x) => x.isEnabled);
    expect(active).toHaveLength(1);
    expect(active[0].agentId).toBe('a-2');
  });

  it('priority field wins over match level ordering when priority is set', async () => {
    // Two channel-default rules; higher priority should win.
    await store.upsert({ channel: 'p', agentId: 'a-low', priority: 1 });
    const hi = await store.upsert({ channel: 'p', agentId: 'a-high', priority: 10 });
    expect(hi.priority).toBe(10);

    const r = await store.resolve({ channel: 'p' });
    expect(r?.agentId).toBe('a-high');
  });

  it('setEnabled flips and resolve skips disabled rules', async () => {
    const b = await store.upsert({ channel: 'd', agentId: 'a-on' });
    const off = await store.setEnabled(b.id, false);
    expect(off?.isEnabled).toBe(false);
    const r = await store.resolve({ channel: 'd' });
    expect(r).toBeNull();
  });

  it('list filter by agentId and isEnabled', async () => {
    const a = await store.upsert({ channel: 'l1', agentId: 'shared' });
    const c = await store.upsert({ channel: 'l2', agentId: 'shared' });
    const d = await store.upsert({ channel: 'l3', agentId: 'other' });

    const sharedActive = await store.list({ agentId: 'shared', isEnabled: true });
    expect(sharedActive.map((b) => b.id).sort()).toEqual([a.id, c.id].sort());

    // Disable one shared rule.
    await store.setEnabled(a.id, false);
    const enabledShared = await store.list({ agentId: 'shared', isEnabled: true });
    expect(enabledShared.map((b) => b.id)).toEqual([c.id]);
    expect(d.isEnabled).toBe(true);
  });

  it('delete removes the row and resolve no longer sees it', async () => {
    const b = await store.upsert({ channel: 'x', agentId: 'a-x' });
    expect(await store.delete(b.id)).toBe(true);
    expect(await store.delete(b.id)).toBe(false);
    expect(await store.resolve({ channel: 'x' })).toBeNull();
  });
});
