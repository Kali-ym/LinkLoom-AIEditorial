import { beforeEach, describe, expect, it } from 'vitest';
import { ChannelBindingStore } from '../../src/services/gateway/ChannelBindingStore.js';
import type { PgConnection } from '../../src/services/repositories/DatabaseConnection.js';

// A small in-memory fake of PgConnection that recognises a few well-known SQL
// keywords and dispatches to per-call handlers. ChannelBindingStore issues a
// small, fixed set of statements (upsert deactivation, upsert insert, select by
// id, list, setEnabled returning, delete, resolve). Anything else falls through.
type Handler = (params: unknown[]) => unknown;

function makeFakeConn() {
  const handlers: Record<string, Handler> = {};
  const conn: Pick<PgConnection, 'get' | 'all' | 'run'> = {
    async get<T = unknown>(sql: string, ...params: unknown[]): Promise<T | undefined> {
      // match SELECT/UPDATE...RETURNING for the upsert trailing SELECT and setEnabled
      if (/SELECT \* FROM channel_bindings WHERE id = \$1/i.test(sql) ||
          /UPDATE channel_bindings\s+SET is_enabled/i.test(sql)) {
        const h = handlers.__selectById;
        if (h) return h(params) as T;
      }
      return undefined;
    },
    async all<T = unknown>(sql: string, ...params: unknown[]): Promise<T[]> {
      if (/FROM channel_bindings[\s\S]*match_level/i.test(sql)) {
        const h = handlers.__resolve;
        if (h) return h(params) as T[];
      }
      if (/FROM channel_bindings/i.test(sql)) {
        const h = handlers.__list;
        if (h) return h(params) as T[];
      }
      return [];
    },
    async run(sql: string, ...params: unknown[]): Promise<{ lastID: number; changes: number }> {
      if (/UPDATE channel_bindings\s+SET is_enabled = FALSE/i.test(sql)) {
        const h = handlers.__deactivate;
        if (h) return h(params) as { lastID: number; changes: number };
      }
      if (/INSERT INTO channel_bindings/i.test(sql) ||
          /ON CONFLICT \(id\) DO UPDATE/i.test(sql)) {
        const h = handlers.__upsert;
        if (h) return h(params) as { lastID: number; changes: number };
      }
      if (/DELETE FROM channel_bindings WHERE id = \$1/i.test(sql)) {
        const h = handlers.__delete;
        if (h) return h(params) as { lastID: number; changes: number };
      }
      return { lastID: 0, changes: 0 };
    },
  };
  return { conn: conn as unknown as PgConnection, handlers };
}

function bindingRow(input: Partial<Record<string, unknown>>) {
  return {
    id: input.id ?? 'b1',
    channel: input.channel ?? 'cli',
    account_id: input.account_id ?? null,
    peer_id: input.peer_id ?? null,
    agent_id: input.agent_id ?? 'a1',
    priority: input.priority ?? 0,
    is_enabled: input.is_enabled ?? true,
    description: input.description ?? null,
    created_at: input.created_at ?? 1,
    updated_at: input.updated_at ?? 1,
    metadata: input.metadata ?? null,
  };
}

describe('ChannelBindingStore', () => {
  let fake: ReturnType<typeof makeFakeConn>;
  let store: ChannelBindingStore;

  beforeEach(() => {
    fake = makeFakeConn();
    store = new ChannelBindingStore(fake.conn);
  });

  it('upsert + get round-trip normalizes "*" to null', async () => {
    let stored: Record<string, unknown> | undefined;
    fake.handlers.__upsert = (params) => {
      stored = {
        id: String(params[0]),
        channel: String(params[1]),
        account_id: params[2] ?? null,
        peer_id: params[3] ?? null,
        agent_id: String(params[4]),
        priority: Number(params[5] ?? 0),
        is_enabled: Boolean(params[6] ?? true),
        description: params[7] ?? null,
        created_at: Number(params[8] ?? Date.now()),
        updated_at: Number(params[8] ?? Date.now()),
        metadata: params[9] ? JSON.parse(String(params[9])) : null,
      };
      return { lastID: 0, changes: 1 };
    };
    fake.handlers.__selectById = (params) => {
      if (stored && stored.id === String(params[0])) return stored;
      return undefined;
    };

    const b = await store.upsert({
      channel: 'telegram',
      accountId: '*', // → null
      peerId: '*',
      agentId: 'a-tg',
      priority: 5,
      description: 'tg default',
    });
    expect(b.accountId).toBeNull();
    expect(b.peerId).toBeNull();
    expect(b.agentId).toBe('a-tg');
    expect(b.priority).toBe(5);
    expect(b.isEnabled).toBe(true);
  });

  it('upsert deactivates prior active rule with same (channel, account, peer)', async () => {
    const rows = new Map<string, Record<string, unknown>>();
    fake.handlers.__deactivate = (params) => {
      // params: [now, channel, accountKey, peerKey, excludeId]
      const channel = String(params[1]);
      const accountKey = String(params[2]);
      const peerKey = String(params[3]);
      const excludeId = String(params[4]);
      let changes = 0;
      for (const [id, r] of rows) {
        if (id === excludeId) continue;
        if (r.channel !== channel) continue;
        const rAccount = r.account_id ?? '*';
        const rPeer = r.peer_id ?? '*';
        if (rAccount === accountKey && rPeer === peerKey && r.is_enabled === true) {
          r.is_enabled = false;
          changes++;
        }
      }
      return { lastID: 0, changes };
    };
    fake.handlers.__upsert = (params) => {
      const id = String(params[0]);
      rows.set(id, {
        id,
        channel: String(params[1]),
        account_id: params[2] ?? null,
        peer_id: params[3] ?? null,
        agent_id: String(params[4]),
        priority: Number(params[5] ?? 0),
        is_enabled: Boolean(params[6] ?? true),
        description: params[7] ?? null,
        created_at: Number(params[8] ?? Date.now()),
        updated_at: Number(params[8] ?? Date.now()),
        metadata: params[9] ? JSON.parse(String(params[9])) : null,
      });
      return { lastID: 0, changes: 1 };
    };
    fake.handlers.__selectById = (params) => rows.get(String(params[0]));

    const a = await store.upsert({ channel: 'cli', agentId: 'a-cli-1' });
    const b = await store.upsert({ channel: 'cli', agentId: 'a-cli-2' });
    expect(b.agentId).toBe('a-cli-2');
    expect(b.isEnabled).toBe(true);
    expect(rows.get(a.id)?.is_enabled).toBe(false);
  });

  it('resolve picks the most specific match (level 1 over level 4)', async () => {
    fake.handlers.__resolve = (params) => {
      // params: [channel, accountId, '*', peerId, '*']
      const channel = String(params[0]);
      const accountId = params[1] ?? null;
      const peerId = params[3] ?? null;
      const all: Record<string, unknown>[] = [
        bindingRow({ id: 'b4', channel, account_id: null, peer_id: null, agent_id: 'a-fallback' }),
        bindingRow({ id: 'b1', channel, account_id: 'alice', peer_id: 'p1', agent_id: 'a-specific', created_at: 2, updated_at: 2 }),
      ];
      const matched = all.filter((r) => {
        if (r.channel !== channel) return false;
        const accountMatch = r.account_id === accountId || r.account_id === null;
        const peerMatch = r.peer_id === peerId || r.peer_id === null;
        return r.is_enabled && accountMatch && peerMatch;
      });
      // Reproduce the store's SQL ORDER BY: match_level ASC, priority DESC, updated_at DESC
      const level = (r: any) =>
        r.account_id && r.peer_id ? 1 : r.account_id ? 2 : r.peer_id ? 3 : 4;
      matched.sort((a, b) => {
        const la = level(a), lb = level(b);
        if (la !== lb) return la - lb;
        if (a.priority !== b.priority) return Number(b.priority) - Number(a.priority);
        return Number(b.updated_at) - Number(a.updated_at);
      });
      // Store reads .match_level off the row; the SQL aliases it as match_level.
      return matched.map((r) => ({ ...r, match_level: level(r) }));
    };
    const r = await store.resolve({ channel: 'tg', accountId: 'alice', peerId: 'p1' });
    expect(r?.agentId).toBe('a-specific');
    expect(r?.matchLevel).toBe(1);
    expect(r?.strategy).toBe('specific');
  });

  it('resolve falls back to account-level when peer does not match', async () => {
    fake.handlers.__resolve = (params) => {
      const channel = String(params[0]);
      const accountId = params[1] ?? null;
      const peerId = params[3] ?? null;
      const all: Record<string, unknown>[] = [
        bindingRow({ id: 'b2', channel, account_id: 'alice', peer_id: null, agent_id: 'a-acct' }),
      ];
      const matched = all.filter((r) => {
        if (r.channel !== channel) return false;
        const accountMatch = r.account_id === accountId || r.account_id === null;
        const peerMatch = r.peer_id === peerId || r.peer_id === null;
        return r.is_enabled && accountMatch && peerMatch;
      });
      const level = (r: any) =>
        r.account_id && r.peer_id ? 1 : r.account_id ? 2 : r.peer_id ? 3 : 4;
      matched.sort((a, b) => level(a) - level(b));
      return matched.map((r) => ({ ...r, match_level: level(r) }));
    };
    const r = await store.resolve({ channel: 'tg', accountId: 'alice', peerId: 'unknown-peer' });
    expect(r?.agentId).toBe('a-acct');
    expect(r?.matchLevel).toBe(2);
    expect(r?.strategy).toBe('account');
  });

  it('resolve returns fallback result when no rule matches and fallbackAgentId is set', async () => {
    fake.handlers.__resolve = () => [];
    const r = await store.resolve(
      { channel: 'no-such-channel' },
      { fallbackAgentId: 'a-default' }
    );
    expect(r).toEqual({
      agentId: 'a-default',
      bindingId: null,
      matchLevel: 4,
      strategy: 'fallback',
    });
  });

  it('resolve returns null when no rule matches and no fallback', async () => {
    fake.handlers.__resolve = () => [];
    const r = await store.resolve({ channel: 'no-such-channel' });
    expect(r).toBeNull();
  });

  it('list filters by channel', async () => {
    const all: Record<string, unknown>[] = [
      bindingRow({ id: 'b1', channel: 'tg', agent_id: 'a1', is_enabled: true }),
      bindingRow({ id: 'b2', channel: 'tg', agent_id: 'a2', is_enabled: false }),
      bindingRow({ id: 'b3', channel: 'cli', agent_id: 'a1', is_enabled: true }),
    ];
    fake.handlers.__list = (params) => {
      const channel = params[0] as string;
      return all.filter((r) => r.channel === channel);
    };
    const tgOnly = await store.list({ channel: 'tg' });
    expect(tgOnly.map((b) => b.id).sort()).toEqual(['b1', 'b2']);
  });

  it('list filters by isEnabled', async () => {
    const all: Record<string, unknown>[] = [
      bindingRow({ id: 'b1', channel: 'tg', agent_id: 'a1', is_enabled: true }),
      bindingRow({ id: 'b2', channel: 'tg', agent_id: 'a2', is_enabled: false }),
      bindingRow({ id: 'b3', channel: 'cli', agent_id: 'a1', is_enabled: true }),
    ];
    fake.handlers.__list = (params) => {
      const isEnabled = params[0] as boolean;
      return all.filter((r) => Boolean(r.is_enabled) === isEnabled);
    };
    const enabledOnly = await store.list({ isEnabled: true });
    expect(enabledOnly.map((b) => b.id).sort()).toEqual(['b1', 'b3']);
  });

  it('list filters by agentId', async () => {
    const all: Record<string, unknown>[] = [
      bindingRow({ id: 'b1', channel: 'tg', agent_id: 'a1', is_enabled: true }),
      bindingRow({ id: 'b2', channel: 'tg', agent_id: 'a2', is_enabled: false }),
      bindingRow({ id: 'b3', channel: 'cli', agent_id: 'a1', is_enabled: true }),
    ];
    fake.handlers.__list = (params) => {
      const agentId = params[0] as string;
      return all.filter((r) => r.agent_id === agentId);
    };
    const a1 = await store.list({ agentId: 'a1' });
    expect(a1.map((b) => b.id).sort()).toEqual(['b1', 'b3']);
  });

  it('delete + setEnabled round-trip', async () => {
    const rows = new Map<string, Record<string, unknown>>();
    rows.set('b1', bindingRow({ id: 'b1' }));
    // __selectById handles both SELECT id and UPDATE...RETURNING queries.
    // Mutate the row in place on UPDATE so subsequent reads see the new state.
    let lastUpdate: { id: string; isEnabled: boolean } | undefined;
    fake.handlers.__selectById = (params) => {
      if (lastUpdate) {
        const r = rows.get(lastUpdate.id);
        if (r) r.is_enabled = lastUpdate.isEnabled;
        lastUpdate = undefined;
      }
      return rows.get(String(params[params.length - 1]));
    };
    // Intercept the run() path for UPDATE...SET is_enabled to capture the
    // intended new state. The store routes this statement to .get() so we
    // also need a run() handler (no-op) and a get() handler that does the work.
    // We simulate by mutating rows then returning the row from get().
    fake.handlers.__delete = (params) => ({
      lastID: 0,
      changes: rows.delete(String(params[0])) ? 1 : 0,
    });
    // Override: when get() sees the setEnabled UPDATE, capture args.
    const origGet = fake.conn.get.bind(fake.conn);
    fake.conn.get = (async (sql: string, ...params: unknown[]) => {
      if (/UPDATE channel_bindings\s+SET is_enabled/i.test(sql)) {
        lastUpdate = {
          id: String(params[2]),
          isEnabled: Boolean(params[0]),
        };
        // Fall through to origGet, which calls __selectById, which applies
        // the captured update before reading.
        return origGet(sql, ...params);
      }
      return origGet(sql, ...params);
    }) as typeof fake.conn.get;

    const off = await store.setEnabled('b1', false);
    expect(off?.isEnabled).toBe(false);

    const del = await store.delete('b1');
    expect(del).toBe(true);
    const del2 = await store.delete('b1');
    expect(del2).toBe(false);
  });
});
