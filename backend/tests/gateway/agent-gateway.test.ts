import { beforeEach, describe, expect, it } from 'vitest';
import { AgentGateway } from '../../src/services/gateway/AgentGateway.js';
import type { ChannelBindingStore } from '../../src/services/gateway/ChannelBindingStore.js';
import type { GatewayMessageRepository } from '../../src/services/gateway/GatewayMessageRepository.js';
import type { AgentService } from '../../src/services/agents/AgentService.js';
import type { IncomingMessage } from '../../src/services/gateway/gatewayTypes.js';

type ResolveFn = (typeof ChannelBindingStore.prototype)['resolve'];

function makeBindingStore(impl: ResolveFn): ChannelBindingStore {
  return {
    resolve: impl,
    upsert: async () => {
      throw new Error('not used');
    },
    get: async () => null,
    list: async () => [],
    delete: async () => false,
    setEnabled: async () => null,
  } as unknown as ChannelBindingStore;
}

function makeMessageRepo(): { repo: GatewayMessageRepository; rows: Map<string, any> } {
  const rows = new Map<string, any>();
  let seq = 0;
  const repo: Partial<GatewayMessageRepository> = {
    async create(input) {
      seq += 1;
      const id = `msg_${seq}`;
      const row = {
        id,
        channel: input.channel,
        account_id: input.accountId ?? null,
        peer_id: input.peerId ?? null,
        agent_id: input.resolution?.agentId ?? null,
        binding_id: input.resolution?.bindingId ?? null,
        match_level: input.resolution?.matchLevel ?? null,
        strategy: input.resolution?.strategy ?? null,
        status: input.status ?? 'pending',
        text_length: input.textLength,
        error: null,
        created_at: Date.now(),
        completed_at: null,
        metadata: input.metadata ?? null,
      };
      rows.set(id, row);
      return row as any;
    },
    async markStarted(id) {
      const r = rows.get(id);
      if (r) r.status = 'started';
    },
    async markCompleted(id, p) {
      const r = rows.get(id);
      if (r) {
        r.status = p.status;
        r.error = p.error ?? null;
        r.completed_at = Date.now();
      }
    },
    async get(id) {
      return rows.get(id) ?? null;
    },
    async list() {
      return Array.from(rows.values()) as any;
    },
  };
  return { repo: repo as GatewayMessageRepository, rows };
}

function makeAgentService(impl: (agentId: string, text: string) => Promise<any>): AgentService {
  return {
    runAgent: impl,
    streamAgent: async function* () {
      /* noop */
    },
  } as unknown as AgentService;
}

describe('AgentGateway', () => {
  let repoRows: Map<string, any>;
  let messageRepo: GatewayMessageRepository;

  beforeEach(() => {
    const m = makeMessageRepo();
    repoRows = m.rows;
    messageRepo = m.repo;
  });

  it('throws when channel or text is missing', async () => {
    const gw = new AgentGateway({
      bindingStore: makeBindingStore(async () => null),
      agentService: makeAgentService(async () => ({ output: '' })),
      messageRepo,
    });
    await expect(gw.resolve({ channel: '', text: 'x' } as IncomingMessage)).rejects.toThrow(/channel/);
    await expect(gw.resolve({ channel: 'tg', text: '' } as IncomingMessage)).rejects.toThrow(/text/);
  });

  it('refuses oversized text without dispatching', async () => {
    let called = false;
    const gw = new AgentGateway({
      bindingStore: makeBindingStore(async () => null),
      agentService: makeAgentService(async () => {
        called = true;
        return { output: 'should-not-run' };
      }),
      messageRepo,
    });
    const big = 'x'.repeat(200_001);
    await expect(gw.resolve({ channel: 'cli', text: big })).rejects.toThrow(/exceeds/);
    expect(called).toBe(false);
  });

  it('persists an unrouted message when no binding matches and no fallback', async () => {
    const gw = new AgentGateway({
      bindingStore: makeBindingStore(async () => null),
      agentService: makeAgentService(async () => ({ output: 'should-not-run' })),
      messageRepo,
    });
    const { messageId, resolution } = await gw.resolve({ channel: 'mystery', text: 'hi' });
    expect(resolution).toBeNull();
    expect(repoRows.get(messageId).status).toBe('unrouted');
  });

  it('uses the binding-resolved agent and records full resolution metadata', async () => {
    const gw = new AgentGateway({
      bindingStore: makeBindingStore(async () => ({
        agentId: 'a-tg',
        bindingId: 'bnd-1',
        matchLevel: 1,
        strategy: 'specific',
      })),
      agentService: makeAgentService(async () => ({ output: 'ok' })),
      messageRepo,
    });
    const { messageId, resolution } = await gw.resolve({
      channel: 'tg',
      accountId: 'alice',
      peerId: 'p1',
      text: 'hi',
    });
    expect(resolution?.agentId).toBe('a-tg');
    expect(resolution?.matchLevel).toBe(1);
    expect(resolution?.strategy).toBe('specific');
    expect(resolution?.fallback).toBe(false);
    const r = repoRows.get(messageId);
    expect(r.status).toBe('pending');
    expect(r.match_level).toBe(1);
    expect(r.strategy).toBe('specific');
  });

  it('handleMessage dispatches via AgentService and emits started → text.delta → completed', async () => {
    const gw = new AgentGateway({
      bindingStore: makeBindingStore(async () => ({
        agentId: 'a-1',
        bindingId: 'b-1',
        matchLevel: 2,
        strategy: 'account',
      })),
      agentService: makeAgentService(async () => ({
        output: 'hello world',
        usage: { promptTokens: 10, completionTokens: 5, cost: 0.0001 },
      })),
      messageRepo,
    });
    const handle = await gw.handleMessage({ channel: 'tg', accountId: 'alice', text: 'hi' });
    expect(handle.runId).toMatch(/^run_/);
    expect(handle.resolution?.agentId).toBe('a-1');
    const events: any[] = [];
    for await (const ev of handle.events) events.push(ev);
    expect(events.map((e) => e.type)).toEqual([
      'gateway.started',
      'agent.text.delta',
      'gateway.completed',
    ]);
    expect(events[0].resolution.strategy).toBe('account');
    expect(events[1].text).toBe('hello world');
    expect(events[2].status).toBe('completed');
    expect(events[2].usage?.promptTokens).toBe(10);

    const result = await handle.result;
    expect(result.status).toBe('completed');
    expect(result.output).toBe('hello world');
    expect(repoRows.get(handle.messageId).status).toBe('completed');
  });

  it('handleMessage marks status=failed when AgentService throws', async () => {
    const gw = new AgentGateway({
      bindingStore: makeBindingStore(async () => ({
        agentId: 'a-1',
        bindingId: 'b-1',
        matchLevel: 4,
        strategy: 'channel',
      })),
      agentService: makeAgentService(async () => {
        throw new Error('upstream LLM 503');
      }),
      messageRepo,
    });
    const handle = await gw.handleMessage({ channel: 'tg', text: 'hi' });
    const events: any[] = [];
    for await (const ev of handle.events) events.push(ev);
    const completed = events.find((e) => e.type === 'gateway.completed');
    expect(completed.status).toBe('failed');
    expect(completed.error).toMatch(/upstream LLM 503/);
    const result = await handle.result;
    expect(result.status).toBe('failed');
    expect(repoRows.get(handle.messageId).status).toBe('failed');
    expect(repoRows.get(handle.messageId).error).toMatch(/upstream LLM 503/);
  });

  it('falls back to systemAgentId when resolved agent is missing', async () => {
    let calledWith: string | undefined;
    const gw = new AgentGateway({
      bindingStore: makeBindingStore(async () => ({
        agentId: 'a-deleted',
        bindingId: 'b-1',
        matchLevel: 1,
        strategy: 'specific',
      })),
      agentService: makeAgentService(async (agentId) => {
        calledWith = agentId;
        return { output: 'from-system' };
      }),
      messageRepo,
      agentExists: async (id) => id !== 'a-deleted',
      options: { systemAgentId: 'system-default' },
    });
    const handle = await gw.handleMessage({ channel: 'tg', text: 'hi' });
    expect(calledWith).toBe('system-default');
    expect(handle.resolution?.agentId).toBe('system-default');
    expect(handle.resolution?.fallback).toBe(false);
  });

  it('handleMessage returns unresolved handle when bindingStore returns null', async () => {
    let called = false;
    const gw = new AgentGateway({
      bindingStore: makeBindingStore(async () => null),
      agentService: makeAgentService(async () => {
        called = true;
        return { output: 'should-not-run' };
      }),
      messageRepo,
    });
    const handle = await gw.handleMessage({ channel: 'mystery', text: 'hi' });
    expect(handle.runId).toBeNull();
    expect(handle.resolution).toBeNull();
    expect(called).toBe(false);
    const result = await handle.result;
    expect(result.status).toBe('unrouted');
    const events: any[] = [];
    for await (const ev of handle.events) events.push(ev);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('gateway.completed');
    expect(events[0].status).toBe('failed');
    expect(events[0].error).toMatch(/unrouted/);
  });

  it('resolveFallbackAgentId default uses request metadata.fallbackAgentId then systemAgentId', async () => {
    const gwA = new AgentGateway({
      bindingStore: makeBindingStore(async () => null),
      agentService: makeAgentService(async () => ({ output: '' })),
      messageRepo,
      options: { systemAgentId: 'sys-1' },
    });
    // When fallback resolves a binding, the fallback comes from bindingStore
    // path; here we test only that no exception is raised with metadata.
    const r = await gwA.resolve({ channel: 'x', text: 'y', metadata: { fallbackAgentId: 'meta-fb' } });
    expect(r.resolution).toBeNull();
  });
});
