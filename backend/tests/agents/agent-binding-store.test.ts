import { beforeEach, describe, expect, it } from 'vitest';
import { AgentBindingStore } from '../../src/services/agents/AgentBindingStore.js';
import type { PgConnection } from '../../src/services/repositories/DatabaseConnection.js';

type Handler = (params: unknown[]) => unknown;

function makeFakeConn() {
  const handlers: Record<string, Handler> = {};
  const conn: Pick<PgConnection, 'get' | 'all' | 'run'> = {
    async get<T = unknown>(sql: string, ...params: unknown[]): Promise<T | undefined> {
      if (/SELECT \* FROM agent_resource_bindings WHERE id = \$1/i.test(sql)) {
        const h = handlers.__getById;
        if (h) return h(params) as T;
      }
      if (
        /SELECT \* FROM agent_resource_bindings[\s\S]*agent_id = \$1 AND resource_type = \$2 AND resource_id = \$3/i.test(
          sql,
        )
      ) {
        const h = handlers.__getByResource;
        if (h) return h(params) as T;
      }
      return undefined;
    },
    async all<T = unknown>(sql: string, ...params: unknown[]): Promise<T[]> {
      if (/SELECT resource_id FROM agent_resource_bindings/i.test(sql)) {
        const h = handlers.__listResourceIds;
        if (h) return h(params) as T[];
      }
      if (/SELECT \* FROM agent_resource_bindings[\s\S]*WHERE agent_id = \$1/i.test(sql)) {
        const h = handlers.__list;
        if (h) return h(params) as T[];
      }
      return [];
    },
    async run(sql: string, ...params: unknown[]): Promise<{ lastID: number; changes: number }> {
      if (/INSERT INTO agent_resource_bindings/i.test(sql)) {
        const h = handlers.__insert;
        if (h) return h(params) as { lastID: number; changes: number };
      }
      if (/DELETE FROM agent_resource_bindings WHERE id = \$1 AND agent_id = \$2/i.test(sql)) {
        const h = handlers.__deleteById;
        if (h) return h(params) as { lastID: number; changes: number };
      }
      if (
        /DELETE FROM agent_resource_bindings[\s\S]*resource_type = \$2 AND resource_id = \$3/i.test(
          sql,
        )
      ) {
        const h = handlers.__deleteByResource;
        if (h) return h(params) as { lastID: number; changes: number };
      }
      return { lastID: 0, changes: 0 };
    },
  };
  return { conn: conn as unknown as PgConnection, handlers };
}

function bindingRow(input: Partial<Record<string, unknown>>) {
  return {
    id: input.id ?? 'arb_1',
    agent_id: input.agent_id ?? 'agent-1',
    resource_type: input.resource_type ?? 'kb_category',
    resource_id: input.resource_id ?? 'cat-a',
    created_at: input.created_at ?? 1,
    metadata: input.metadata ?? null,
  };
}

describe('AgentBindingStore', () => {
  let fake: ReturnType<typeof makeFakeConn>;
  let store: AgentBindingStore;

  beforeEach(() => {
    fake = makeFakeConn();
    store = new AgentBindingStore(fake.conn);
  });

  it('upsert inserts a new binding and returns it', async () => {
    const rows = new Map<string, Record<string, unknown>>();
    fake.handlers.__getByResource = () => undefined;
    fake.handlers.__insert = (params) => {
      const row = bindingRow({
        id: String(params[0]),
        agent_id: String(params[1]),
        resource_type: String(params[2]),
        resource_id: String(params[3]),
        created_at: Number(params[4]),
        metadata: params[5],
      });
      rows.set(row.id, row);
      return { lastID: 0, changes: 1 };
    };
    fake.handlers.__getById = (params) => rows.get(String(params[0]));

    const binding = await store.upsert('agent-1', {
      resourceType: 'kb_category',
      resourceId: 'cat-a',
    });

    expect(binding.agentId).toBe('agent-1');
    expect(binding.resourceType).toBe('kb_category');
    expect(binding.resourceId).toBe('cat-a');
    expect(rows.size).toBe(1);
  });

  it('upsert is idempotent for the same agent/resource pair', async () => {
    const existing = bindingRow({ id: 'arb_existing' });
    fake.handlers.__getByResource = (params) => {
      if (
        params[0] === 'agent-1' &&
        params[1] === 'kb_category' &&
        params[2] === 'cat-a'
      ) {
        return existing;
      }
      return undefined;
    };

    const binding = await store.upsert('agent-1', {
      resourceType: 'kb_category',
      resourceId: 'cat-a',
    });

    expect(binding.id).toBe('arb_existing');
  });

  it('list returns bindings for an agent ordered by type and id', async () => {
    fake.handlers.__list = (params) => {
      if (params[0] !== 'agent-1') return [];
      return [
        bindingRow({ id: 'b2', resource_type: 'file', resource_id: 'file-1' }),
        bindingRow({ id: 'b1', resource_type: 'kb_category', resource_id: 'cat-a' }),
      ];
    };

    const bindings = await store.list('agent-1');
    expect(bindings).toHaveLength(2);
    expect(bindings[0]?.resourceType).toBe('file');
    expect(bindings[1]?.resourceType).toBe('kb_category');
  });

  it('deleteById and deleteByResource report changes', async () => {
    const rows = new Map<string, Record<string, unknown>>([
      ['arb_1', bindingRow({ id: 'arb_1' })],
    ]);
    fake.handlers.__deleteById = (params) => ({
      lastID: 0,
      changes: rows.delete(String(params[0])) ? 1 : 0,
    });
    fake.handlers.__deleteByResource = (params) => {
      let changes = 0;
      for (const [id, row] of rows) {
        if (
          row.agent_id === params[0] &&
          row.resource_type === params[1] &&
          row.resource_id === params[2]
        ) {
          rows.delete(id);
          changes = 1;
        }
      }
      return { lastID: 0, changes };
    };

    expect(await store.deleteById('agent-1', 'arb_1')).toBe(true);
    expect(await store.deleteById('agent-1', 'arb_1')).toBe(false);

    rows.set('arb_2', bindingRow({ id: 'arb_2', resource_type: 'file', resource_id: 'f1' }));
    expect(await store.deleteByResource('agent-1', 'file', 'f1')).toBe(true);
    expect(await store.deleteByResource('agent-1', 'file', 'f1')).toBe(false);
  });

  it('listResourceIds returns ids for a resource type', async () => {
    fake.handlers.__listResourceIds = (params) => {
      if (params[0] === 'agent-1' && params[1] === 'kb_category') {
        return [{ resource_id: 'cat-a' }, { resource_id: 'cat-b' }];
      }
      return [];
    };

    const ids = await store.listResourceIds('agent-1', 'kb_category');
    expect(ids).toEqual(['cat-a', 'cat-b']);
  });
});
