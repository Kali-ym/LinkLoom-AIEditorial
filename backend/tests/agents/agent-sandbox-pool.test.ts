import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentSandboxPool } from '../../src/services/agents/engine/AgentSandboxPool.js';
import type { AgentRunSpec } from '../../src/services/agents/engine/AgentRunSpec.js';
import { WorkspaceManager } from '../../src/services/agents/engine/WorkspaceManager.js';
import {
  ContainerRuntimeError,
  type ContainerHandle,
  type ContainerInspectResult,
  type ContainerListFilter,
  type ContainerRuntime,
  type ContainerRunSpec
} from '../../src/services/agents/engine/workspaceTypes.js';
import { InMemoryAgentSandboxInstanceStore } from '../../src/services/repositories/AgentSandboxInstanceRepository.js';

class FakeHandle implements ContainerHandle {
  containerId: string;
  workspaceId: string;
  startedAt = new Date().toISOString();
  status: ContainerHandle['status'] = 'starting';
  labels: Record<string, string>;
  stopped = false;
  removed = false;
  inspect = async (): Promise<ContainerInspectResult> => ({
    status: this.removed ? 'errored' : this.stopped ? 'exited' : this.status
  });
  stop = async () => {
    this.stopped = true;
    this.status = 'exited';
  };
  remove = async () => {
    this.removed = true;
    this.status = 'exited';
  };

  constructor(containerId: string, workspaceId: string, labels: Record<string, string> = {}) {
    this.containerId = containerId;
    this.workspaceId = workspaceId;
    this.labels = labels;
  }
}

class FakeRuntime implements ContainerRuntime {
  handles = new Map<string, FakeHandle>();
  startCalls = 0;

  isAvailable = async () => ({ ok: true as const });
  start = async (spec: ContainerRunSpec): Promise<ContainerHandle> => {
    this.startCalls += 1;
    const labels = {
      'linkloom.workspaceId': spec.workspaceId,
      ...(spec.runId ? { 'linkloom.runId': spec.runId } : {}),
      ...(spec.labels ?? {})
    };
    const h = new FakeHandle(`cid_${spec.workspaceId}`, spec.workspaceId, labels);
    h.status = 'running';
    this.handles.set(h.containerId, h);
    return h;
  };
  startExisting = async (containerId: string): Promise<ContainerHandle> => {
    const handle = this.handles.get(containerId);
    if (!handle) {
      throw new ContainerRuntimeError('start-failed', `missing container ${containerId}`);
    }
    handle.stopped = false;
    handle.status = 'running';
    return handle;
  };
  list = async (filter?: ContainerListFilter): Promise<ContainerHandle[]> => {
    return Array.from(this.handles.values()).filter((handle) => {
      if (filter?.workspaceId && handle.workspaceId !== filter.workspaceId) return false;
      if (filter?.labels) {
        return Object.entries(filter.labels).every(([key, value]) => handle.labels[key] === value);
      }
      return true;
    });
  };
  get = (id: string) => this.handles.get(id);
  shutdown = async () => {};
}

function buildRunSpec(overrides: Partial<AgentRunSpec> = {}): AgentRunSpec {
  return {
    runId: 'run_test_1',
    sessionId: 'sess_1',
    threadId: 'sess_1',
    source: 'agent',
    input: { messages: [] },
    metadata: {},
    agentDef: { id: 'agent_alpha' } as AgentRunSpec['agentDef'],
    workspacePolicy: {
      mode: 'docker',
      pool: 'per-agent',
      cleanup: 'manual'
    },
    ...overrides
  } as AgentRunSpec;
}

describe('AgentSandboxPool', () => {
  let runtime: FakeRuntime;
  let store: InMemoryAgentSandboxInstanceStore;
  let pool: AgentSandboxPool;

  beforeEach(() => {
    runtime = new FakeRuntime();
    store = new InMemoryAgentSandboxInstanceStore();
    pool = new AgentSandboxPool({ runtime, store, workspaceRootDir: '/tmp/linkloom-test-workspaces' });
  });

  it('reuses the same containerId when the same agent acquires twice', async () => {
    const policy = { mode: 'docker' as const, pool: 'per-agent' as const, cleanup: 'manual' as const };
    const spec = buildRunSpec();

    const first = await pool.acquire('agent_alpha', policy, spec);
    const second = await pool.acquire('agent_alpha', policy, {
      ...spec,
      runId: 'run_test_2'
    });

    expect(first.containerId).toBe(second.containerId);
    expect(runtime.startCalls).toBe(1);
    expect(first.workspaceId).toBe('agent_sandbox_agent_alpha');
  });

  it('restarts an exited sandbox on acquire', async () => {
    const policy = { mode: 'docker' as const, pool: 'per-agent' as const, cleanup: 'manual' as const };
    const spec = buildRunSpec();
    const first = await pool.acquire('agent_alpha', policy, spec);
    await pool.stop('agent_alpha');

    const second = await pool.acquire('agent_alpha', policy, {
      ...spec,
      runId: 'run_test_2'
    });

    expect(second.containerId).toBe(first.containerId);
    expect(runtime.startCalls).toBe(1);
    expect(second.status).toBe('running');
  });

  it('reconcile updates DB status from runtime inspect', async () => {
    const policy = { mode: 'docker' as const, pool: 'per-agent' as const, cleanup: 'manual' as const };
    await pool.acquire('agent_alpha', policy, buildRunSpec());
    const handle = runtime.get('cid_agent_sandbox_agent_alpha')!;
    handle.status = 'exited';

    await pool.reconcile();

    const status = await pool.getStatus('agent_alpha');
    expect(status?.status).toBe('stopped');
  });

  describe('LINKLOOM_MAX_SANDBOX_CONTAINERS', () => {
    const previousLimit = process.env.LINKLOOM_MAX_SANDBOX_CONTAINERS;

    afterEach(() => {
      if (previousLimit === undefined) {
        delete process.env.LINKLOOM_MAX_SANDBOX_CONTAINERS;
      } else {
        process.env.LINKLOOM_MAX_SANDBOX_CONTAINERS = previousLimit;
      }
    });

    it('rejects a new container when the active sandbox limit is reached', async () => {
      process.env.LINKLOOM_MAX_SANDBOX_CONTAINERS = '1';
      const policy = { mode: 'docker' as const, pool: 'per-agent' as const, cleanup: 'manual' as const };

      await pool.acquire('agent_alpha', policy, buildRunSpec());

      await expect(
        pool.acquire(
          'agent_beta',
          policy,
          buildRunSpec({
            agentDef: { id: 'agent_beta' } as AgentRunSpec['agentDef'],
            runId: 'run_beta'
          })
        )
      ).rejects.toMatchObject({ code: 'sandbox-capacity-exceeded' });

      expect(runtime.startCalls).toBe(1);
    });

    it('resumes an existing sandbox without consuming a new capacity slot', async () => {
      process.env.LINKLOOM_MAX_SANDBOX_CONTAINERS = '1';
      const policy = { mode: 'docker' as const, pool: 'per-agent' as const, cleanup: 'manual' as const };
      const spec = buildRunSpec();

      await pool.acquire('agent_alpha', policy, spec);
      await pool.acquire('agent_alpha', policy, { ...spec, runId: 'run_test_2' });

      expect(runtime.startCalls).toBe(1);
    });
  });
});

describe('WorkspaceManager per-agent sandbox', () => {
  let runtime: FakeRuntime;
  let mgr: WorkspaceManager;

  beforeEach(() => {
    runtime = new FakeRuntime();
    const store = new InMemoryAgentSandboxInstanceStore();
    const pool = new AgentSandboxPool({ runtime, store, workspaceRootDir: '/tmp/linkloom-test-workspaces' });
    mgr = new WorkspaceManager({ runtime, sandboxPool: pool });
  });

  it('returns the same containerId for two runs of the same agent', async () => {
    const first = await mgr.createWorkspace(buildRunSpec());
    const second = await mgr.createWorkspace(
      buildRunSpec({
        runId: 'run_test_2',
        sessionId: 'sess_2'
      })
    );

    expect(first.workspace?.metadata?.pool).toBe('per-agent');
    expect(first.workspace?.metadata?.containerId).toBe(second.workspace?.metadata?.containerId);
    expect(runtime.startCalls).toBe(1);
  });

  it('does not cleanup per-agent docker workspaces', async () => {
    const result = await mgr.createWorkspace(buildRunSpec());
    const stop = vi.fn();
    const remove = vi.fn();
    const containerId = result.workspace?.metadata?.containerId as string;
    const looked = runtime.get(containerId) as FakeHandle | undefined;
    looked!.stop = stop;
    looked!.remove = remove;

    await mgr.cleanupWorkspace(result.workspace!);

    expect(stop).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it('shouldCleanup returns false for per-agent policy', () => {
    expect(
      mgr.shouldCleanup({ mode: 'docker', pool: 'per-agent', cleanup: 'always' }, 'success')
    ).toBe(false);
  });

  it('falls back to local when sandbox pool is not configured', async () => {
    const bareMgr = new WorkspaceManager({ runtime });
    const result = await bareMgr.createWorkspace(buildRunSpec());
    expect(result.workspace?.mode).toBe('local');
    expect(result.workspace?.metadata?.fallback).toBe('sandbox-pool-unconfigured');
  });
});
