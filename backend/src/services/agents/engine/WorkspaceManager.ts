import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { LogService } from '../../LogService.js';
import { AgentSandboxPool } from './AgentSandboxPool.js';
import { isPerAgentSandboxPolicy } from './AgentSandboxTypes.js';
import type { AgentRunSpec } from './AgentRunSpec.js';
import type { AgentArtifactRef } from './AgentSession.js';
import { createDefaultContainerRuntime } from './ContainerRuntime.js';
import type { WorkspacePolicy, WorkspaceRef } from './WorkspacePolicy.js';
import {
  ContainerRuntimeError,
  type ContainerHandle,
  type ContainerNetworkMode,
  type ContainerRunSpec,
  type ContainerRuntime
} from './workspaceTypes.js';

export interface WorkspaceManagerOptions {
  runtime?: ContainerRuntime;
  sandboxPool?: AgentSandboxPool;
  /** Override AGENT_WORKSPACE_ROOT for local mode; primarily for tests. */
  localRootDir?: string;
}

export interface WorkspaceCreateResult {
  workspace?: WorkspaceRef;
  policy: WorkspacePolicy;
}

export class WorkspaceManager {
  private readonly runtime: ContainerRuntime;
  private readonly sandboxPool?: AgentSandboxPool;
  private readonly localRootDir: string;
  // Track containerIds we started so cleanup can locate them. Handles are obtained
  // on demand from the runtime (which may be a fresh dockerode getContainer call
  // or an in-memory fake) so this map is intentionally small.
  private readonly startedContainerIds = new Set<string>();

  constructor(opts: WorkspaceManagerOptions = {}) {
    this.runtime = opts.runtime ?? createDefaultContainerRuntime();
    this.sandboxPool = opts.sandboxPool;
    this.localRootDir =
      opts.localRootDir ||
      process.env.AGENT_WORKSPACE_ROOT ||
      path.join(os.tmpdir(), 'linkloom-agent-workspaces');
  }

  async createWorkspace(spec: AgentRunSpec): Promise<WorkspaceCreateResult> {
    const policy = this.effectivePolicy(spec.workspacePolicy);
    if (policy.mode === 'none') return { policy };

    if (policy.mode === 'remote') {
      return {
        policy,
        workspace: {
          workspaceId: this.createWorkspaceId(spec.runId),
          mode: 'remote',
          createdAt: new Date().toISOString(),
          metadata: {
            status: 'reserved',
            reason: 'remote-not-implemented-yet'
          }
        }
      };
    }

    if (policy.mode === 'docker') {
      return this.createDockerWorkspace(spec, policy);
    }

    return this.createLocalWorkspace(spec, policy);
  }

  async saveArtifact(
    workspace: WorkspaceRef | undefined,
    artifact: AgentArtifactRef,
    content?: unknown
  ): Promise<AgentArtifactRef> {
    if (content === undefined) return artifact;

    if (workspace?.mode === 'docker') {
      const hostMount = this.firstHostMount(workspace);
      const artifactsDir = hostMount
        ? path.join(hostMount, 'artifacts')
        : path.join(
            os.tmpdir(),
            'linkloom-agent-artifacts',
            sanitizeName(String(artifact.metadata?.runId || 'global'))
          );
      await fs.mkdir(artifactsDir, { recursive: true });
      const fileName = `${sanitizeName(artifact.artifactId)}.${typeof content === 'string' ? 'txt' : 'json'}`;
      const filePath = path.join(artifactsDir, fileName);
      const body = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
      await fs.writeFile(filePath, body, 'utf8');
      return {
        ...artifact,
        uri: `file://${filePath}`,
        metadata: {
          ...artifact.metadata,
          workspaceId: workspace.workspaceId,
          workspacePath: filePath,
          storage: 'workspace'
        }
      };
    }

    const artifactsDir =
      workspace?.rootDir && workspace.mode === 'local'
        ? path.join(workspace.rootDir, 'artifacts')
        : path.join(
            os.tmpdir(),
            'linkloom-agent-artifacts',
            sanitizeName(String(artifact.metadata?.runId || 'global'))
          );
    await fs.mkdir(artifactsDir, { recursive: true });
    const fileName = `${sanitizeName(artifact.artifactId)}.${typeof content === 'string' ? 'txt' : 'json'}`;
    const filePath = path.join(artifactsDir, fileName);
    const body = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
    await fs.writeFile(filePath, body, 'utf8');
    return {
      ...artifact,
      uri: `file://${filePath}`,
      metadata: {
        ...artifact.metadata,
        workspaceId: workspace?.workspaceId,
        workspacePath: filePath,
        storage: workspace?.rootDir && workspace.mode === 'local' ? 'workspace' : 'platform'
      }
    };
  }

  async cleanupWorkspace(workspace: WorkspaceRef | undefined): Promise<void> {
    if (!workspace) return;
    if (workspace.mode === 'local' && workspace.rootDir) {
      // per-agent 持久化工作区不清理：保留文件供下次 run 与 agent-console 浏览。
      if (workspace.metadata?.pool === 'per-agent') return;
      await fs.rm(workspace.rootDir, { recursive: true, force: true });
      return;
    }
    if (workspace.mode === 'docker') {
      if (workspace.metadata?.pool === 'per-agent') return;
      const containerId = String(workspace.metadata?.containerId ?? '');
      if (!containerId) return;
      if (!this.startedContainerIds.has(containerId)) return;
      const handle = this.runtime.get(containerId);
      if (!handle) return;
      try {
        await handle.stop(10_000);
      } catch {
        // ignore; container may already be stopped
      }
      try {
        await handle.remove();
      } catch {
        // ignore; container may already be removed
      }
      this.startedContainerIds.delete(containerId);
    }
  }

  shouldCleanup(policy: WorkspacePolicy, outcome: 'success' | 'failed'): boolean {
    if (isPerAgentSandboxPolicy(policy)) return false;
    if (policy.cleanup === 'always') return true;
    if (policy.cleanup === 'on-success' && outcome === 'success') return true;
    return false;
  }

  private async createDockerWorkspace(
    spec: AgentRunSpec,
    policy: WorkspacePolicy
  ): Promise<WorkspaceCreateResult> {
    if (isPerAgentSandboxPolicy(policy)) {
      return this.createPerAgentDockerWorkspace(spec, policy);
    }
    const workspaceId = this.createWorkspaceId(spec.runId);
    const availability = await this.runtime.isAvailable();
    if (!availability.ok) {
      return this.fallbackToLocal(spec, policy, {
        fallback: 'docker-unreachable',
        fallbackReason: availability.reason ?? 'unknown'
      });
    }
    const runSpec = this.toContainerRunSpec(spec, workspaceId, policy);
    let handle: ContainerHandle;
    try {
      handle = await this.runtime.start(runSpec);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const code =
        error instanceof ContainerRuntimeError
          ? `docker-${error.code}`
          : `docker-start-failed`;
      return this.fallbackToLocal(spec, policy, {
        fallback: code,
        fallbackReason: message
      });
    }
    this.startedContainerIds.add(handle.containerId);
    return {
      policy,
      workspace: {
        workspaceId,
        mode: 'docker',
        createdAt: new Date().toISOString(),
        metadata: {
          runId: spec.runId,
          sessionId: spec.sessionId,
          containerId: handle.containerId,
          status: handle.status,
          mounts: runSpec.mounts,
          network: policy.network ?? 'disabled',
          writes: policy.writes ?? 'workspace-only',
          cleanup: policy.cleanup ?? 'manual'
        }
      }
    };
  }

  private async createPerAgentDockerWorkspace(
    spec: AgentRunSpec,
    policy: WorkspacePolicy
  ): Promise<WorkspaceCreateResult> {
    const agentId = this.resolveAgentId(spec);
    if (!agentId) {
      LogService.warn('[Workspace] per-agent docker policy requires agentId; falling back to per-run docker.');
      return this.createDockerWorkspace(
        { ...spec, workspacePolicy: { ...policy, pool: 'per-run' } },
        { ...policy, pool: 'per-run' }
      );
    }
    if (!this.sandboxPool) {
      return this.fallbackToLocal(spec, policy, {
        fallback: 'sandbox-pool-unconfigured',
        fallbackReason: 'AgentSandboxPool is not configured'
      });
    }

    const availability = await this.runtime.isAvailable();
    if (!availability.ok) {
      return this.fallbackToLocal(spec, policy, {
        fallback: 'docker-unreachable',
        fallbackReason: availability.reason ?? 'unknown'
      });
    }

    try {
      const instance = await this.sandboxPool.acquire(agentId, policy, spec);
      return {
        policy,
        workspace: {
          workspaceId: instance.workspaceId,
          mode: 'docker',
          createdAt: instance.createdAt,
          metadata: {
            agentId,
            pool: 'per-agent',
            containerId: instance.containerId,
            status: instance.status,
            mounts: [{ source: instance.hostMountPath, target: '/workspace' }],
            network: policy.network ?? 'disabled',
            writes: policy.writes ?? 'workspace-only',
            cleanup: 'manual',
            runId: spec.runId,
            sessionId: spec.sessionId
          }
        }
      };
    } catch (error) {
      if (error instanceof ContainerRuntimeError && error.code === 'sandbox-capacity-exceeded') {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      const code =
        error instanceof ContainerRuntimeError
          ? `docker-${error.code}`
          : 'docker-start-failed';
      return this.fallbackToLocal(spec, policy, {
        fallback: code,
        fallbackReason: message
      });
    }
  }

  private resolveAgentId(spec: AgentRunSpec): string | undefined {
    const fromDef = spec.agentDef?.id || spec.temporaryAgentDef?.id;
    if (typeof fromDef === 'string' && fromDef.trim()) return fromDef.trim();
    const fromMetadata = spec.metadata?.agentId;
    if (typeof fromMetadata === 'string' && fromMetadata.trim()) return fromMetadata.trim();
    return undefined;
  }

  private toContainerRunSpec(
    spec: AgentRunSpec,
    workspaceId: string,
    policy: WorkspacePolicy
  ): ContainerRunSpec {
    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) {
      if (typeof v === 'string' && v.length > 0) {
        if (k === 'NODE_ENV' || k.startsWith('LINKLOOM_') || k === 'PATH') {
          env[k] = v;
        }
      }
    }
    return {
      image: process.env.LINKLOOM_AGENT_IMAGE ?? 'linkloom-agent:latest',
      workspaceId,
      runId: spec.runId,
      mounts: (policy.mounts ?? []).map((m) => ({ ...m })),
      env,
      network: this.toContainerNetworkMode(policy.network),
      resourceLimits: { ...(policy.resourceLimits ?? {}) },
      command: [
        'node',
        '/app/agent-runner.js',
        '--run-id',
        spec.runId,
        '--session-id',
        spec.sessionId
      ]
    };
  }

  private toContainerNetworkMode(
    network: WorkspacePolicy['network']
  ): ContainerNetworkMode {
    switch (network) {
      case 'enabled':
        return 'host';
      case 'limited':
        return 'bridge';
      case 'disabled':
      default:
        return 'disabled';
    }
  }

  private async fallbackToLocal(
    spec: AgentRunSpec,
    originalPolicy: WorkspacePolicy,
    extra: { fallback: string; fallbackReason: string }
  ): Promise<WorkspaceCreateResult> {
    LogService.warn(
      `[Workspace] Docker unavailable (${extra.fallback}: ${extra.fallbackReason}); falling back to local mode.`
    );
    const localPolicy: WorkspacePolicy = { ...originalPolicy, mode: 'local' };
    const result = await this.createLocalWorkspace(spec, localPolicy);
    return {
      ...result,
      workspace: result.workspace
        ? {
            ...result.workspace,
            metadata: {
              ...(result.workspace.metadata ?? {}),
              fallback: extra.fallback,
              fallbackReason: extra.fallbackReason
            }
          }
        : result.workspace
    };
  }

  private async createLocalWorkspace(
    spec: AgentRunSpec,
    policy: WorkspacePolicy
  ): Promise<WorkspaceCreateResult> {
    const rootDir = path.resolve(policy.rootDir || this.localRootDir);

    // per-agent 持久化工作区：executionTarget=local 或 docker fallback 时，
    // 用 ${rootDir}/agents/${agentId} 作为持久化目录（与 AgentWorkspaceFileService 一致），
    // 让 agent-console 能浏览 agent run 写入的文件。
    if (policy.pool === 'per-agent') {
      const agentId = this.resolveAgentId(spec);
      if (agentId) {
        const workspaceRoot = path.join(rootDir, 'agents', sanitizeName(agentId));
        await fs.mkdir(path.join(workspaceRoot, 'artifacts'), { recursive: true });
        return {
          policy,
          workspace: {
            workspaceId: `agent_local_${sanitizeName(agentId)}`,
            mode: 'local',
            rootDir: workspaceRoot,
            createdAt: new Date().toISOString(),
            metadata: {
              runId: spec.runId,
              sessionId: spec.sessionId,
              agentId,
              pool: 'per-agent',
              cleanup: policy.cleanup || 'manual',
              network: policy.network || 'disabled',
              writes: policy.writes || 'workspace-only'
            }
          }
        };
      }
    }

    const workspaceId = this.createWorkspaceId(spec.runId);
    const workspaceRoot = path.join(rootDir, workspaceId);
    await fs.mkdir(path.join(workspaceRoot, 'artifacts'), { recursive: true });

    return {
      policy,
      workspace: {
        workspaceId,
        mode: 'local',
        rootDir: workspaceRoot,
        createdAt: new Date().toISOString(),
        metadata: {
          runId: spec.runId,
          sessionId: spec.sessionId,
          cleanup: policy.cleanup || 'manual',
          network: policy.network || 'disabled',
          writes: policy.writes || 'workspace-only'
        }
      }
    };
  }

  private firstHostMount(workspace: WorkspaceRef): string | undefined {
    const mounts = (
      workspace.metadata as { mounts?: Array<{ source: string; target: string }> } | undefined
    )?.mounts;
    if (!Array.isArray(mounts) || mounts.length === 0) return undefined;
    return mounts[0].source;
  }

  private effectivePolicy(policy?: WorkspacePolicy): WorkspacePolicy {
    return {
      mode: policy?.mode || 'none',
      network: 'disabled',
      writes: 'workspace-only',
      cleanup: 'manual',
      ...policy
    };
  }

  private createWorkspaceId(runId: string): string {
    return `workspace_${runId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }
}

function sanitizeName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 160);
}
