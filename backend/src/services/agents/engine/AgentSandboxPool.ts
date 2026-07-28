import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { LogService } from '../../LogService.js';
import {
  countActiveSandboxContainers,
  resolveAgentSandboxImage,
  resolveMaxSandboxContainers
} from './AgentSandboxLimits.js';
import type { AgentRunSpec } from './AgentRunSpec.js';
import { createDefaultContainerRuntime } from './ContainerRuntime.js';
import {
  agentSandboxHostMount,
  agentSandboxWorkspaceId,
  mapContainerStatusToSandboxStatus,
  type AgentSandboxInstance,
  type AgentSandboxInstanceStore
} from './AgentSandboxTypes.js';
import type { WorkspacePolicy } from './WorkspacePolicy.js';
import {
  ContainerRuntimeError,
  type ContainerHandle,
  type ContainerRuntime,
  type ContainerRunSpec
} from './workspaceTypes.js';

export interface AgentSandboxPoolOptions {
  runtime?: ContainerRuntime;
  store: AgentSandboxInstanceStore;
  /** Override AGENT_WORKSPACE_ROOT; primarily for tests. */
  workspaceRootDir?: string;
}

export class AgentSandboxPool {
  private readonly runtime: ContainerRuntime;
  private readonly store: AgentSandboxInstanceStore;
  private readonly workspaceRootDir: string;

  constructor(opts: AgentSandboxPoolOptions) {
    this.runtime = opts.runtime ?? createDefaultContainerRuntime();
    this.store = opts.store;
    this.workspaceRootDir =
      opts.workspaceRootDir ||
      process.env.AGENT_WORKSPACE_ROOT ||
      path.join(os.tmpdir(), 'linkloom-agent-workspaces');
  }

  async acquire(
    agentId: string,
    policy: WorkspacePolicy,
    runSpec: AgentRunSpec
  ): Promise<AgentSandboxInstance> {
    const existing = await this.store.get(agentId);
    if (existing) {
      const resumed = await this.resumeExisting(agentId, existing, policy);
      if (resumed) {
        if (existing.hostMountPath) {
          await this.ensureHostMountWritable(existing.hostMountPath);
        }
        await this.touch(agentId);
        return (await this.store.get(agentId))!;
      }
    }

    const created = await this.createInstance(agentId, policy, runSpec);
    await this.store.upsert(created);
    return created;
  }

  private async pruneOrphanContainers(agentId: string): Promise<void> {
    const orphans = await this.runtime.list({
      labels: { 'linkloom.pool': 'per-agent', 'linkloom.agentId': agentId }
    });
    for (const handle of orphans) {
      await this.destroyOrphanHandle(handle);
    }
  }

  async touch(agentId: string): Promise<void> {
    const row = await this.store.get(agentId);
    if (!row) return;
    const now = new Date().toISOString();
    await this.store.upsert({ ...row, lastUsedAt: now });
  }

  async getStatus(agentId: string): Promise<AgentSandboxInstance | null> {
    return this.store.get(agentId);
  }

  async refreshStatus(agentId: string): Promise<AgentSandboxInstance | null> {
    const row = await this.store.get(agentId);
    if (!row) return null;
    const handle = await this.findHandle(row);
    if (!handle) {
      const next = { ...row, status: 'error' as const, error: 'container missing from runtime' };
      await this.store.upsert(next);
      return next;
    }
    try {
      const inspected = await handle.inspect();
      const next = {
        ...row,
        containerId: handle.containerId,
        status: mapContainerStatusToSandboxStatus(inspected.status),
        error: undefined
      };
      await this.store.upsert(next);
      return next;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const next = { ...row, status: 'error' as const, error: message };
      await this.store.upsert(next);
      return next;
    }
  }

  async warmStart(agentId: string, policy: WorkspacePolicy): Promise<AgentSandboxInstance> {
    const runSpec = {
      runId: `sandbox_warm_${agentId}_${Date.now().toString(36)}`,
      sessionId: `sandbox_warm_${agentId}`,
      threadId: `sandbox_warm_${agentId}`,
      source: 'api',
      input: { messages: [] },
      metadata: { warmStart: true, agentId },
      agentDef: { id: agentId }
    } as unknown as AgentRunSpec;
    return this.acquire(agentId, policy, runSpec);
  }

  async stop(agentId: string): Promise<void> {
    const row = await this.store.get(agentId);
    if (!row) return;
    const handle = await this.findHandle(row);
    if (handle) {
      try {
        await handle.stop(10_000);
      } catch {
        // container may already be stopped
      }
    }
    await this.store.upsert({ ...row, status: 'stopped', lastUsedAt: new Date().toISOString() });
  }

  async destroy(agentId: string): Promise<void> {
    const row = await this.store.get(agentId);
    if (!row) return;
    const handle = await this.findHandle(row);
    if (handle) {
      try {
        await handle.stop(10_000);
      } catch {
        // ignore
      }
      try {
        await handle.remove();
      } catch {
        // ignore
      }
    }
    await this.store.delete(agentId);
  }

  async reconcile(): Promise<void> {
    const rows = await this.store.listAll();
    for (const row of rows) {
      const handle = await this.findHandle(row);
      if (!handle) {
        await this.store.upsert({
          ...row,
          status: 'error',
          error: 'container missing from runtime'
        });
        continue;
      }
      try {
        const inspected = await handle.inspect();
        await this.store.upsert({
          ...row,
          containerId: handle.containerId,
          status: mapContainerStatusToSandboxStatus(inspected.status)
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await this.store.upsert({
          ...row,
          status: 'error',
          error: message
        });
      }
    }
  }

  private async resumeExisting(
    agentId: string,
    existing: AgentSandboxInstance,
    policy: WorkspacePolicy
  ): Promise<boolean> {
    const handle = await this.findHandle(existing);
    if (!handle) {
      await this.store.delete(agentId);
      return false;
    }

    let inspected;
    try {
      inspected = await handle.inspect();
    } catch {
      await this.store.delete(agentId);
      return false;
    }

    if (inspected.status === 'running' || inspected.status === 'starting') {
      await this.store.upsert({
        ...existing,
        containerId: handle.containerId,
        status: mapContainerStatusToSandboxStatus(inspected.status)
      });
      return true;
    }

    if (inspected.status === 'exited') {
      try {
        const restarted = await this.runtime.startExisting(handle.containerId);
        const next = await restarted.inspect();
        await this.store.upsert({
          ...existing,
          containerId: restarted.containerId,
          status: mapContainerStatusToSandboxStatus(next.status),
          error: undefined
        });
        return true;
      } catch (error) {
        LogService.warn(
          `[AgentSandboxPool] Failed to restart sandbox for ${agentId}; recreating. ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        await this.destroyOrphanHandle(handle);
        await this.store.delete(agentId);
        return false;
      }
    }

    await this.destroyOrphanHandle(handle);
    await this.store.delete(agentId);
    return false;
  }

  private async destroyOrphanHandle(handle: ContainerHandle): Promise<void> {
    try {
      await handle.stop(5_000);
    } catch {
      // ignore
    }
    try {
      await handle.remove();
    } catch {
      // ignore
    }
  }

  private async createInstance(
    agentId: string,
    policy: WorkspacePolicy,
    runSpec: AgentRunSpec
  ): Promise<AgentSandboxInstance> {
    await this.assertSandboxCapacity();
    await this.pruneOrphanContainers(agentId);

    const availability = await this.runtime.isAvailable();
    if (!availability.ok) {
      throw new ContainerRuntimeError(
        'daemon-unreachable',
        availability.reason ?? 'Docker unavailable'
      );
    }

    const workspaceId = agentSandboxWorkspaceId(agentId);
    const hostMountPath = agentSandboxHostMount(this.workspaceRootDir, agentId);
    await fs.mkdir(path.join(hostMountPath, 'artifacts'), { recursive: true, mode: 0o777 });
    await this.ensureHostMountWritable(hostMountPath);

    const image = resolveAgentSandboxImage(policy);
    const runContainerSpec = this.toContainerRunSpec(agentId, workspaceId, hostMountPath, image, policy, runSpec);
    const handle = await this.runtime.start(runContainerSpec);
    const inspected = await handle.inspect();
    const now = new Date().toISOString();

    return {
      agentId,
      containerId: handle.containerId,
      workspaceId,
      hostMountPath,
      status: mapContainerStatusToSandboxStatus(inspected.status),
      image,
      lastUsedAt: now,
      createdAt: now,
      metadata: {
        pool: 'per-agent',
        idleTimeoutMs:
          typeof policy.metadata?.idleTimeoutMs === 'number'
            ? policy.metadata.idleTimeoutMs
            : undefined,
        policySnapshot: {
          network: policy.network,
          writes: policy.writes,
          cleanup: policy.cleanup
        }
      }
    };
  }

  private toContainerRunSpec(
    agentId: string,
    workspaceId: string,
    hostMountPath: string,
    image: string,
    policy: WorkspacePolicy,
    runSpec: AgentRunSpec
  ): ContainerRunSpec {
    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) {
      if (typeof v === 'string' && v.length > 0) {
        if (k === 'NODE_ENV' || k.startsWith('LINKLOOM_') || k === 'PATH') {
          env[k] = v;
        }
      }
    }
    env.LINKLOOM_AGENT_ID = agentId;

    return {
      image,
      workspaceId,
      runId: runSpec.runId,
      // Run as root so bind-mounted /workspace stays writable even when the host dir is root-owned.
      user: '0',
      mounts: [{ source: hostMountPath, target: '/workspace', readonly: false }, ...(policy.mounts ?? [])],
      env,
      network: policy.network === 'enabled' ? 'host' : policy.network === 'limited' ? 'bridge' : 'disabled',
      resourceLimits: { ...(policy.resourceLimits ?? {}) },
      command: ['tail', '-f', '/dev/null'],
      labels: {
        'linkloom.agentId': agentId,
        'linkloom.pool': 'per-agent'
      }
    };
  }

  private async findHandle(row: AgentSandboxInstance): Promise<ContainerHandle | undefined> {
    const byWorkspace = await this.runtime.list({
      workspaceId: row.workspaceId,
      labels: { 'linkloom.pool': 'per-agent', 'linkloom.agentId': row.agentId }
    });
    if (byWorkspace[0]) return byWorkspace[0];

    const cached = this.runtime.get(row.containerId);
    if (cached) return cached;

    const byAgent = await this.runtime.list({
      labels: { 'linkloom.pool': 'per-agent', 'linkloom.agentId': row.agentId }
    });
    return byAgent[0];
  }

  private async assertSandboxCapacity(): Promise<void> {
    const limit = resolveMaxSandboxContainers();
    if (!Number.isFinite(limit)) return;
    const rows = await this.store.listAll();
    const active = countActiveSandboxContainers(rows);
    if (active >= limit) {
      throw new ContainerRuntimeError(
        'sandbox-capacity-exceeded',
        `Sandbox container limit reached (${active}/${limit}). Stop an idle sandbox or raise LINKLOOM_MAX_SANDBOX_CONTAINERS.`
      );
    }
  }

  /** Ensure host bind-mount targets exist; sandbox containers run as root (see toContainerRunSpec). */
  private async ensureHostMountWritable(hostMountPath: string): Promise<void> {
    const targets = [hostMountPath, path.join(hostMountPath, 'artifacts')];
    for (const target of targets) {
      try {
        await fs.mkdir(target, { recursive: true, mode: 0o777 });
        await fs.chmod(target, 0o777);
      } catch (error) {
        LogService.warn(
          `[AgentSandboxPool] Failed to chmod sandbox mount ${target}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }
  }
}
