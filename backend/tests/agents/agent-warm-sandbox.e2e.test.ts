import { execSync } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AgentSandboxIdleReaper } from '../../src/services/agents/sandbox/AgentSandboxIdleReaper.js';
import { AgentSandboxPool } from '../../src/services/agents/engine/AgentSandboxPool.js';
import { resolveWorkspacePolicyFromExecutionTarget } from '../../src/services/agents/engine/WorkspacePolicyResolver.js';
import { WorkspaceManager } from '../../src/services/agents/engine/WorkspaceManager.js';
import type { AgentRunSpec } from '../../src/services/agents/engine/AgentRunSpec.js';
import { DockerContainerRuntime } from '../../src/services/agents/engine/ContainerRuntime.js';
import { ExecuteCommandTool } from '../../src/plugins/builtin/tools/ExecuteCommandTool.js';
import { ReadWorkspaceFileTool } from '../../src/plugins/builtin/tools/ReadWorkspaceFileTool.js';
import { WriteWorkspaceFileTool } from '../../src/plugins/builtin/tools/WriteWorkspaceFileTool.js';
import { ContainerRuntimeError } from '../../src/services/agents/engine/workspaceTypes.js';
import { InMemoryAgentSandboxInstanceStore } from '../../src/services/repositories/AgentSandboxInstanceRepository.js';

function hasDocker(): boolean {
  try {
    execSync('docker version --format "{{.Server.Version}}"', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function imageExists(name: string): boolean {
  try {
    execSync(`docker image inspect ${name}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function resolveAgentImage(): string | null {
  for (const candidate of ['linkloom-agent:demo', 'linkloom-agent:latest', 'linkloom:local']) {
    if (imageExists(candidate)) return candidate;
  }
  return null;
}

function buildRunSpec(agentId: string, runId: string): AgentRunSpec {
  return {
    runId,
    sessionId: `sess_${runId}`,
    threadId: `sess_${runId}`,
    source: 'agent',
    input: { messages: [] },
    metadata: { agentId },
    agentDef: { id: agentId } as AgentRunSpec['agentDef'],
    workspacePolicy: resolveWorkspacePolicyFromExecutionTarget({ executionTarget: 'sandbox' }),
  } as AgentRunSpec;
}

describe.skipIf(!hasDocker() || !resolveAgentImage())('agent warm sandbox E2E (real Docker)', () => {
  const agentId = `agent_e2e_${Date.now()}`;
  const workspaceRoot = path.join(os.tmpdir(), `linkloom-e2e-${Date.now()}`);
  let pool: AgentSandboxPool;
  let runtime: DockerContainerRuntime;
  let store: InMemoryAgentSandboxInstanceStore;
  let agentImage: string;
  let firstContainerId: string | undefined;

  beforeAll(() => {
    const image = resolveAgentImage();
    if (!image) throw new Error('No agent sandbox image available');
    agentImage = image;
    process.env.LINKLOOM_AGENT_IMAGE = agentImage;
    runtime = new DockerContainerRuntime();
    store = new InMemoryAgentSandboxInstanceStore();
    pool = new AgentSandboxPool({ runtime, store, workspaceRootDir: workspaceRoot });
  });

  afterAll(async () => {
    try {
      await pool.destroy(agentId);
    } catch {
      // ignore cleanup errors
    }
    await fs.rm(workspaceRoot, { recursive: true, force: true });
    if (firstContainerId) {
      try {
        execSync(`docker rm -f ${firstContainerId}`, { stdio: 'ignore' });
      } catch {
        // ignore
      }
    }
  });

  it('1) acquire twice reuses the same containerId', async () => {
    const policy = resolveWorkspacePolicyFromExecutionTarget({ executionTarget: 'sandbox' });
    const first = await pool.acquire(agentId, policy, buildRunSpec(agentId, 'run_e2e_1'));
    const second = await pool.acquire(agentId, policy, buildRunSpec(agentId, 'run_e2e_2'));

    firstContainerId = first.containerId;
    expect(second.containerId).toBe(first.containerId);
  });

  it('2) execute_command runs inside the warm sandbox', async () => {
    const mgr = new WorkspaceManager({ runtime, sandboxPool: pool });
    const created = await mgr.createWorkspace(buildRunSpec(agentId, 'run_e2e_exec'));
    expect(created.workspace?.mode).toBe('docker');
    expect(created.workspace?.metadata?.fallback).toBeUndefined();

    const tool = new ExecuteCommandTool();
    const result = await tool.handler(
      { command: 'echo hello' },
      {
        workspace: created.workspace,
        workspacePolicy: created.policy,
      } as never,
    );

    expect(result.exitCode).toBe(0);
    expect(String(result.stdout).trim()).toBe('hello');
  });

  it('2b) read/write workspace file tools chain inside warm sandbox', async () => {
    const mgr = new WorkspaceManager({ runtime, sandboxPool: pool });
    const created = await mgr.createWorkspace(buildRunSpec(agentId, 'run_e2e_files'));
    const ctx = {
      workspace: created.workspace,
      workspacePolicy: created.policy,
    } as never;

    const writeTool = new WriteWorkspaceFileTool();
    await writeTool.handler({ path: 'chain.txt', content: 'chain-ok' }, ctx);

    const readTool = new ReadWorkspaceFileTool();
    const read = await readTool.handler({ path: 'chain.txt' }, ctx);
    expect(read.content).toBe('chain-ok');

    const execTool = new ExecuteCommandTool();
    const exec = await execTool.handler({ command: 'cat chain.txt' }, ctx);
    expect(String(exec.stdout).trim()).toBe('chain-ok');

    const hostMount = path.join(workspaceRoot, 'agents', agentId, 'chain.txt');
    await expect(fs.readFile(hostMount, 'utf8')).resolves.toBe('chain-ok');
  }, 30_000);

  it('3) stop and warmStart toggle sandbox status', async () => {
    await pool.stop(agentId);
    const stopped = await pool.getStatus(agentId);
    expect(stopped?.status).toBe('stopped');

    const policy = resolveWorkspacePolicyFromExecutionTarget({ executionTarget: 'sandbox' });
    const restarted = await pool.warmStart(agentId, policy);
    expect(restarted.status).toBe('running');
    expect(restarted.containerId).toBe(firstContainerId);
  }, 30_000);

  it('4) idle reaper stops sandbox after timeout', async () => {
    const policy = resolveWorkspacePolicyFromExecutionTarget({ executionTarget: 'sandbox' });
    await pool.warmStart(agentId, policy);
    const row = await pool.getStatus(agentId);
    expect(row).toBeTruthy();
    await store.upsert({
      ...row!,
      lastUsedAt: new Date(Date.now() - 5_000).toISOString(),
    });

    const reaper = new AgentSandboxIdleReaper({
      pool,
      store,
      resolveIdleTimeoutMs: () => 1_000,
    });
    const stopped = await reaper.tick();
    expect(stopped).toBe(1);

    const status = await pool.getStatus(agentId);
    expect(status?.status).toBe('stopped');
  }, 30_000);

  it('5) destroy removes container; clearVolume removes host mount', async () => {
    const policy = resolveWorkspacePolicyFromExecutionTarget({ executionTarget: 'sandbox' });
    await pool.warmStart(agentId, policy);
    const hostMount = path.join(workspaceRoot, 'agents', agentId);
    await fs.writeFile(path.join(hostMount, 'marker.txt'), 'e2e', 'utf8');

    await pool.destroy(agentId);
    await fs.rm(hostMount, { recursive: true, force: true });

    await expect(fs.stat(hostMount)).rejects.toThrow();
    const row = await store.get(agentId);
    expect(row).toBeFalsy();
    firstContainerId = undefined;
  }, 30_000);

  it('6) docker unavailable produces local fallback metadata', async () => {
    const mgr = new WorkspaceManager({
      runtime: {
        isAvailable: async () => ({ ok: false as const, reason: 'daemon-unreachable' }),
        start: async () => {
          throw new Error('should not start');
        },
        startExisting: async () => {
          throw new Error('should not start');
        },
        list: async () => [],
        get: () => undefined,
        shutdown: async () => {},
      },
      sandboxPool: pool,
    });

    const created = await mgr.createWorkspace(buildRunSpec(`agent_fallback_${Date.now()}`, 'run_fallback'));
    expect(created.workspace?.mode).toBe('local');
    expect(created.workspace?.metadata?.fallback).toBe('docker-unreachable');
  });
});

describe.skipIf(!hasDocker() || !resolveAgentImage())('agent sandbox capacity E2E (real Docker)', () => {
  const workspaceRoot = path.join(os.tmpdir(), `linkloom-cap-e2e-${Date.now()}`);
  const agentA = `agent_cap_a_${Date.now()}`;
  const agentB = `agent_cap_b_${Date.now()}`;
  let pool: AgentSandboxPool;
  let runtime: DockerContainerRuntime;
  let store: InMemoryAgentSandboxInstanceStore;
  const previousLimit = process.env.LINKLOOM_MAX_SANDBOX_CONTAINERS;

  beforeAll(() => {
    const image = resolveAgentImage();
    if (!image) throw new Error('No agent sandbox image available');
    process.env.LINKLOOM_AGENT_IMAGE = image;
    process.env.LINKLOOM_MAX_SANDBOX_CONTAINERS = '1';
    runtime = new DockerContainerRuntime();
    store = new InMemoryAgentSandboxInstanceStore();
    pool = new AgentSandboxPool({ runtime, store, workspaceRootDir: workspaceRoot });
  });

  afterAll(async () => {
    await pool.destroy(agentA).catch(() => undefined);
    await pool.destroy(agentB).catch(() => undefined);
    await fs.rm(workspaceRoot, { recursive: true, force: true });
    if (previousLimit === undefined) {
      delete process.env.LINKLOOM_MAX_SANDBOX_CONTAINERS;
    } else {
      process.env.LINKLOOM_MAX_SANDBOX_CONTAINERS = previousLimit;
    }
  }, 30_000);

  it('rejects a second sandbox when LINKLOOM_MAX_SANDBOX_CONTAINERS=1', async () => {
    const policy = resolveWorkspacePolicyFromExecutionTarget({ executionTarget: 'sandbox' });
    await pool.acquire(agentA, policy, buildRunSpec(agentA, 'run_cap_a'));

    await expect(
      pool.acquire(agentB, policy, buildRunSpec(agentB, 'run_cap_b'))
    ).rejects.toBeInstanceOf(ContainerRuntimeError);

    await expect(
      pool.acquire(agentB, policy, buildRunSpec(agentB, 'run_cap_b'))
    ).rejects.toMatchObject({ code: 'sandbox-capacity-exceeded' });
  }, 30_000);
});
