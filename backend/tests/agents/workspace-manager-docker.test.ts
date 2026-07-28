import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceManager } from '../../src/services/agents/engine/WorkspaceManager.js';
import {
  ContainerRuntimeError,
  type ContainerHandle,
  type ContainerRuntime
} from '../../src/services/agents/engine/workspaceTypes.js';
import type { AgentRunSpec } from '../../src/services/agents/engine/AgentRunSpec.js';

function buildRunSpec(workspacePolicy: any): AgentRunSpec {
  return {
    runId: 'run_test_1',
    sessionId: 'sess_1',
    threadId: 'sess_1',
    source: 'agent',
    input: { messages: [] },
    metadata: {},
    workspacePolicy
  } as unknown as AgentRunSpec;
}

class FakeHandle implements ContainerHandle {
  containerId: string;
  workspaceId: string;
  startedAt = new Date().toISOString();
  status: ContainerHandle['status'] = 'starting';
  inspect = async () => ({ status: 'starting' as const });
  stop = async () => {};
  remove = async () => {};
  constructor(containerId: string, workspaceId: string) {
    this.containerId = containerId;
    this.workspaceId = workspaceId;
  }
}

class FakeRuntime implements ContainerRuntime {
  isAvailableImpl = async () => ({ ok: true });
  startImpl = async (spec: any): Promise<ContainerHandle> => {
    const h = new FakeHandle(`cid_${spec.workspaceId}`, spec.workspaceId);
    this.handles.set(h.containerId, h);
    return h;
  };
  listImpl = async () => [] as ContainerHandle[];
  startExistingImpl = async (containerId: string): Promise<ContainerHandle> => {
    const handle = this.handles.get(containerId);
    if (!handle) throw new ContainerRuntimeError('start-failed', `missing ${containerId}`);
    return handle;
  };
  getImpl = (id: string) => this.handles.get(id);
  shutdownImpl = async () => {};
  handles = new Map<string, ContainerHandle>();
  isAvailable = async (...args: any[]) => (this.isAvailableImpl as any)(...args);
  start = async (spec: any) => this.startImpl(spec);
  startExisting = async (containerId: string) => this.startExistingImpl(containerId);
  list = async (...args: any[]) => (this.listImpl as any)(...args);
  get = (id: string) => this.getImpl(id);
  shutdown = async () => this.shutdownImpl();
}

describe('WorkspaceManager with docker mode', () => {
  let mgr: WorkspaceManager;
  let runtime: FakeRuntime;

  beforeEach(() => {
    runtime = new FakeRuntime();
    mgr = new WorkspaceManager({ runtime });
  });

  it('starts a docker container in mode=docker and returns a non-empty containerId', async () => {
    const result = await mgr.createWorkspace(
      buildRunSpec({ mode: 'docker', mounts: [{ source: '/host', target: '/workspace' }] })
    );
    expect(result.workspace?.mode).toBe('docker');
    expect(result.workspace?.metadata?.containerId).toMatch(/^cid_workspace_run_test_1_/);
    expect(result.workspace?.metadata?.status).toBe('starting');
  });

  it('falls back to local when docker is unavailable', async () => {
    runtime.isAvailableImpl = async () => ({ ok: false, reason: 'daemon-unreachable' });
    const result = await mgr.createWorkspace(buildRunSpec({ mode: 'docker' }));
    expect(result.workspace?.mode).toBe('local');
    expect(result.workspace?.metadata?.fallback).toBe('docker-unreachable');
    expect(result.workspace?.metadata?.fallbackReason).toBe('daemon-unreachable');
  });

  it('falls back to local when start throws a ContainerRuntimeError', async () => {
    runtime.startImpl = async () => {
      throw new ContainerRuntimeError('image-missing', 'no such image');
    };
    const result = await mgr.createWorkspace(buildRunSpec({ mode: 'docker' }));
    expect(result.workspace?.mode).toBe('local');
    expect(result.workspace?.metadata?.fallback).toBe('docker-image-missing');
  });

  it('keeps remote mode as a reserved placeholder', async () => {
    const result = await mgr.createWorkspace(buildRunSpec({ mode: 'remote' }));
    expect(result.workspace?.mode).toBe('remote');
    expect(result.workspace?.metadata?.status).toBe('reserved');
    expect(result.workspace?.metadata?.reason).toBe('remote-not-implemented-yet');
  });

  it('mode=none still returns no workspace and zero side effects', async () => {
    const result = await mgr.createWorkspace(buildRunSpec({ mode: 'none' }));
    expect(result.workspace).toBeUndefined();
  });

  it('mode=local still uses fs and does not call runtime.start', async () => {
    const startSpy = vi.spyOn(runtime, 'start');
    const result = await mgr.createWorkspace(buildRunSpec({ mode: 'local' }));
    expect(result.workspace?.mode).toBe('local');
    expect(startSpy).not.toHaveBeenCalled();
  });

  it('cleanup stops and removes the docker container when metadata.containerId is set', async () => {
    const result = await mgr.createWorkspace(buildRunSpec({ mode: 'docker' }));
    const stop = vi.fn();
    const remove = vi.fn();
    const containerId = result.workspace?.metadata?.containerId as string;
    const looked = runtime.get(containerId) as FakeHandle | undefined;
    expect(looked).toBeDefined();
    looked!.stop = stop;
    looked!.remove = remove;
    await mgr.cleanupWorkspace(result.workspace!);
    expect(stop).toHaveBeenCalled();
    expect(remove).toHaveBeenCalled();
  });
});
