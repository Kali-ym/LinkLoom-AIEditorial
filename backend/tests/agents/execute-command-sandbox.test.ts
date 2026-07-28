import { afterEach, describe, expect, it, vi } from 'vitest';
import { AgentSandboxPool } from '../../src/services/agents/engine/AgentSandboxPool.js';
import type { DockerExecOptions, DockerExecResult, DockerExecRunner } from '../../src/services/agents/engine/DockerExecRunner.js';
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
import { ExecuteCommandTool } from '../../src/plugins/builtin/tools/ExecuteCommandTool.js';
import { ToolRegistry } from '../../src/registries/ToolRegistry.js';
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
  isAvailable = async () => ({ ok: true as const });
  start = async (spec: ContainerRunSpec): Promise<ContainerHandle> => {
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

class FakeDockerExecRunner implements DockerExecRunner {
  lastCall?: DockerExecOptions;
  result: DockerExecResult = { stdout: 'hello\n', stderr: '', exitCode: 0 };

  exec = async (options: DockerExecOptions): Promise<DockerExecResult> => {
    this.lastCall = options;
    if (options.signal?.aborted) {
      return { stdout: '', stderr: 'Command cancelled', exitCode: 130 };
    }
    return this.result;
  };
}

function buildWorkspaceContext(containerId: string) {
  return {
    workspace: {
      workspaceId: 'agent_sandbox_agent_alpha',
      mode: 'docker' as const,
      createdAt: new Date().toISOString(),
      metadata: {
        pool: 'per-agent',
        containerId,
        agentId: 'agent_alpha'
      }
    },
    workspacePolicy: {
      mode: 'docker' as const,
      pool: 'per-agent' as const,
      cleanup: 'manual' as const
    }
  };
}

describe('ExecuteCommandTool per-agent sandbox routing', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('routes execute_command through docker exec for per-agent workspaces', async () => {
    const runner = new FakeDockerExecRunner();
    const tool = new ExecuteCommandTool({ dockerExecRunner: runner });

    const result = await tool.handler(
      { command: 'echo hello' },
      buildWorkspaceContext('container_123') as any
    );

    expect(runner.lastCall).toMatchObject({
      containerId: 'container_123',
      command: 'echo hello',
      cwd: '/workspace'
    });
    expect(result.stdout).toBe('hello\n');
    expect(result.exitCode).toBe(0);
  });

  it('keeps sandbox cwd inside /workspace', async () => {
    const runner = new FakeDockerExecRunner();
    const tool = new ExecuteCommandTool({ dockerExecRunner: runner });

    await expect(
      tool.handler({ command: 'echo blocked', cwd: '/etc' }, buildWorkspaceContext('container_123') as any)
    ).rejects.toThrow('cwd must stay inside active workspace');
  });

  it('passes AbortSignal to docker exec runner', async () => {
    const runner: DockerExecRunner = {
      exec: async (options) => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        if (options.signal?.aborted) {
          return { stdout: '', stderr: 'Command cancelled', exitCode: 130 };
        }
        return { stdout: '', stderr: '', exitCode: 0 };
      }
    };
    const tool = new ExecuteCommandTool({ dockerExecRunner: runner });
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 20);

    const result = await tool.handler(
      { command: 'sleep 5' },
      { ...buildWorkspaceContext('container_123'), signal: controller.signal } as any
    );

    expect(result.exitCode).toBe(130);
    expect(result.stderr).toContain('Command cancelled');
  });

  it('allows execute_command in production when running in per-agent docker sandbox', async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevEnable = process.env.ENABLE_EXECUTE_COMMAND_TOOL;
    process.env.NODE_ENV = 'production';
    delete process.env.ENABLE_EXECUTE_COMMAND_TOOL;

    try {
      const runner = new FakeDockerExecRunner();
      const tool = new ExecuteCommandTool({ dockerExecRunner: runner });
      const result = await tool.handler(
        { command: 'echo hello' },
        buildWorkspaceContext('container_prod') as any
      );
      expect(result.stdout).toBe('hello\n');
      expect(result.exitCode).toBe(0);
    } finally {
      if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = prevNodeEnv;
      if (prevEnable === undefined) delete process.env.ENABLE_EXECUTE_COMMAND_TOOL;
      else process.env.ENABLE_EXECUTE_COMMAND_TOOL = prevEnable;
    }
  });

  it('allows execute_command through ToolRegistry sandbox for per-agent docker', async () => {
    const registry = ToolRegistry.getInstance();
    const runner = new FakeDockerExecRunner();
    registry.registerTool(new ExecuteCommandTool({ dockerExecRunner: runner }));

    const envelope = await registry.callToolEnvelope(
      'execute_command',
      { command: 'echo hello' },
      buildWorkspaceContext('container_123') as any
    );

    expect(envelope.error).toBeUndefined();
    expect(envelope.result).toMatchObject({ stdout: 'hello\n', exitCode: 0 });
    expect(envelope.sandbox?.effect).toBe('allow');
  });

  it('executes echo hello end-to-end against a warm sandbox workspace', async () => {
    const runtime = new FakeRuntime();
    const store = new InMemoryAgentSandboxInstanceStore();
    const pool = new AgentSandboxPool({ runtime, store, workspaceRootDir: '/tmp/linkloom-exec-test' });
    const mgr = new WorkspaceManager({ runtime, sandboxPool: pool });
    const spec = {
      runId: 'run_exec_1',
      sessionId: 'sess_exec_1',
      threadId: 'sess_exec_1',
      source: 'agent',
      input: { messages: [] },
      metadata: {},
      agentDef: { id: 'agent_alpha' },
      workspacePolicy: { mode: 'docker', pool: 'per-agent', cleanup: 'manual' }
    } as unknown as AgentRunSpec;

    const created = await mgr.createWorkspace(spec);
    const runner = new FakeDockerExecRunner();
    const tool = new ExecuteCommandTool({ dockerExecRunner: runner });
    const containerId = String(created.workspace?.metadata?.containerId);

    const result = await tool.handler(
      { command: 'echo hello' },
      {
        workspace: created.workspace,
        workspacePolicy: spec.workspacePolicy
      } as any
    );

    expect(runner.lastCall?.containerId).toBe(containerId);
    expect(result.stdout).toBe('hello\n');
  });
});
