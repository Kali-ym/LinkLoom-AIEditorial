import { describe, expect, it, vi } from 'vitest';
import { AgentSandboxIdleReaper } from '../../src/services/agents/sandbox/AgentSandboxIdleReaper.js';
import type { AgentSandboxInstance } from '../../src/services/agents/engine/AgentSandboxTypes.js';
import { InMemoryAgentSandboxInstanceStore } from '../../src/services/repositories/AgentSandboxInstanceRepository.js';

describe('AgentSandboxIdleReaper', () => {
  it('stops running sandboxes that exceeded idle timeout', async () => {
    const store = new InMemoryAgentSandboxInstanceStore();
    const stale: AgentSandboxInstance = {
      agentId: 'agent_idle',
      containerId: 'cid_1',
      workspaceId: 'agent_sandbox_agent_idle',
      hostMountPath: '/tmp/agent_idle',
      status: 'running',
      image: 'linkloom-agent:latest',
      lastUsedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString()
    };
    await store.upsert(stale);

    const pool = {
      stop: vi.fn(async () => {})
    };

    const reaper = new AgentSandboxIdleReaper({
      pool: pool as any,
      store,
      resolveIdleTimeoutMs: () => 30 * 60 * 1000
    });

    const stopped = await reaper.tick();
    expect(stopped).toBe(1);
    expect(pool.stop).toHaveBeenCalledWith('agent_idle');
  });

  it('skips sandboxes still within idle timeout', async () => {
    const store = new InMemoryAgentSandboxInstanceStore();
    await store.upsert({
      agentId: 'agent_active',
      containerId: 'cid_2',
      workspaceId: 'agent_sandbox_agent_active',
      hostMountPath: '/tmp/agent_active',
      status: 'running',
      image: 'linkloom-agent:latest',
      lastUsedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    });

    const pool = { stop: vi.fn(async () => {}) };
    const reaper = new AgentSandboxIdleReaper({
      pool: pool as any,
      store,
      resolveIdleTimeoutMs: () => 30 * 60 * 1000
    });

    const stopped = await reaper.tick();
    expect(stopped).toBe(0);
    expect(pool.stop).not.toHaveBeenCalled();
  });
});
