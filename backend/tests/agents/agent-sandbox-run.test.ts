import { beforeEach, describe, expect, it } from 'vitest';
import { AgentSandboxPool } from '../../src/services/agents/engine/AgentSandboxPool.js';
import { resolveWorkspacePolicyFromExecutionTarget } from '../../src/services/agents/engine/WorkspacePolicyResolver.js';
import { WorkspaceManager } from '../../src/services/agents/engine/WorkspaceManager.js';
import type { AgentRunSpec } from '../../src/services/agents/engine/AgentRunSpec.js';
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
  status: ContainerHandle['status'] = 'running';
  labels: Record<string, string>;
  inspect = async (): Promise<ContainerInspectResult> => ({ status: 'running' });
  stop = async () => {};
  remove = async () => {};

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
      ...(spec.labels ?? {})
    };
    const handle = new FakeHandle(`cid_${spec.workspaceId}`, spec.workspaceId, labels);
    this.handles.set(handle.containerId, handle);
    return handle;
  };
  startExisting = async (containerId: string) => {
    const handle = this.handles.get(containerId);
    if (!handle) throw new ContainerRuntimeError('start-failed', `missing ${containerId}`);
    return handle;
  };
  list = async (filter?: ContainerListFilter) =>
    Array.from(this.handles.values()).filter((handle) => {
      if (filter?.workspaceId && handle.workspaceId !== filter.workspaceId) return false;
      if (filter?.labels) {
        return Object.entries(filter.labels).every(([key, value]) => handle.labels[key] === value);
      }
      return true;
    });
  get = (id: string) => this.handles.get(id);
  shutdown = async () => {};
}

function buildRunSpec(agentId: string, runId: string): AgentRunSpec {
  const workspacePolicy = resolveWorkspacePolicyFromExecutionTarget({
    executionTarget: 'sandbox'
  });
  return {
    runId,
    sessionId: `sess_${runId}`,
    threadId: `sess_${runId}`,
    source: 'agent',
    input: { messages: [] },
    metadata: { agentId },
    agentDef: { id: agentId } as AgentRunSpec['agentDef'],
    workspacePolicy
  } as AgentRunSpec;
}

describe('sandbox run provisioning (P3)', () => {
  let runtime: FakeRuntime;
  let mgr: WorkspaceManager;

  beforeEach(() => {
    runtime = new FakeRuntime();
    const store = new InMemoryAgentSandboxInstanceStore();
    const pool = new AgentSandboxPool({ runtime, store, workspaceRootDir: '/tmp/linkloom-p3-test' });
    mgr = new WorkspaceManager({ runtime, sandboxPool: pool });
  });

  it('reuses the same warm sandbox container across two runs for one agent', async () => {
    const first = await mgr.createWorkspace(buildRunSpec('agent_p3', 'run_1'));
    const second = await mgr.createWorkspace(buildRunSpec('agent_p3', 'run_2'));

    expect(first.workspace?.metadata?.pool).toBe('per-agent');
    expect(first.workspace?.metadata?.containerId).toBe(second.workspace?.metadata?.containerId);
    expect(runtime.startCalls).toBe(1);
  });
});
