import fs from 'fs/promises';
import { AppError } from '../../../domain/errors.js';
import type { AgentDefinition } from '../../../types/agent.js';
import type { LocalStore } from '../../LocalStore.js';
import type { AgentSandboxInstance } from '../engine/AgentSandboxTypes.js';
import { ContainerRuntimeError } from '../engine/workspaceTypes.js';
import {
  readAgentConsoleWorkspaceConfig,
  resolveWorkspacePolicyFromAgent
} from '../engine/WorkspacePolicyResolver.js';
import type { WorkspacePolicy } from '../engine/WorkspacePolicy.js';
import { createAgentSandboxRuntime } from './AgentSandboxRuntime.js';

export interface AgentSandboxStatusDto {
  agentId: string;
  status: AgentSandboxInstance['status'] | 'not_provisioned';
  containerId?: string;
  workspaceId?: string;
  hostMountPath?: string;
  image?: string;
  lastUsedAt?: string;
  createdAt?: string;
  error?: string;
}

export class AgentSandboxService {
  private readonly runtime: NonNullable<ReturnType<typeof createAgentSandboxRuntime>>;

  constructor(private readonly store: LocalStore) {
    const runtime = createAgentSandboxRuntime(store);
    if (!runtime) {
      throw new AppError(503, 'Agent sandbox runtime is not available');
    }
    this.runtime = runtime;
  }

  async getSandbox(agentId: string): Promise<AgentSandboxStatusDto> {
    await this.ensureAgentExists(agentId);
    const refreshed = await this.runtime.pool.refreshStatus(agentId);
    if (!refreshed) {
      return { agentId, status: 'not_provisioned' };
    }
    return this.toDto(refreshed);
  }

  async warmStart(agentId: string): Promise<AgentSandboxStatusDto> {
    const agent = await this.ensureAgentExists(agentId);
    const policy = this.requireSandboxPolicy(agent);
    try {
      const instance = await this.runtime.pool.warmStart(agentId, policy);
      return this.toDto(instance);
    } catch (error) {
      if (error instanceof ContainerRuntimeError) {
        if (error.code === 'sandbox-capacity-exceeded') {
          throw new AppError(503, error.message, 'sandbox-capacity-exceeded');
        }
        if (error.code === 'daemon-unreachable') {
          throw new AppError(503, error.message, 'sandbox-daemon-unreachable');
        }
      }
      throw error;
    }
  }

  async stopSandbox(agentId: string): Promise<AgentSandboxStatusDto> {
    await this.ensureAgentExists(agentId);
    const existing = await this.runtime.pool.getStatus(agentId);
    if (!existing) {
      return { agentId, status: 'not_provisioned' };
    }
    await this.runtime.pool.stop(agentId);
    const next = await this.runtime.pool.getStatus(agentId);
    return next ? this.toDto(next) : { agentId, status: 'stopped' };
  }

  async destroySandbox(
    agentId: string,
    options: { clearVolume?: boolean } = {}
  ): Promise<{ agentId: string; status: 'destroyed' }> {
    await this.ensureAgentExists(agentId);
    const existing = await this.runtime.pool.getStatus(agentId);
    const hostMountPath = existing?.hostMountPath;
    await this.runtime.pool.destroy(agentId);
    if (options.clearVolume && hostMountPath) {
      await fs.rm(hostMountPath, { recursive: true, force: true });
    }
    return { agentId, status: 'destroyed' };
  }

  private async ensureAgentExists(agentId: string): Promise<AgentDefinition> {
    const agent = await this.store.getAgent(agentId);
    if (!agent || agent.isHidden) {
      throw new AppError(404, `Agent ${agentId} not found`);
    }
    return agent;
  }

  private requireSandboxPolicy(agent: AgentDefinition): WorkspacePolicy {
    const policy = resolveWorkspacePolicyFromAgent(agent);
    if (policy?.mode !== 'docker' || policy.pool !== 'per-agent') {
      const config = readAgentConsoleWorkspaceConfig(agent);
      throw new AppError(
        400,
        `Agent ${agent.id} is not configured for sandbox execution (executionTarget=${config?.executionTarget ?? 'unset'})`
      );
    }
    return policy;
  }

  private toDto(instance: AgentSandboxInstance): AgentSandboxStatusDto {
    return {
      agentId: instance.agentId,
      status: instance.status,
      containerId: instance.containerId,
      workspaceId: instance.workspaceId,
      hostMountPath: instance.hostMountPath,
      image: instance.image,
      lastUsedAt: instance.lastUsedAt,
      createdAt: instance.createdAt,
      error: instance.error
    };
  }
}

export function tryCreateAgentSandboxService(store: LocalStore): AgentSandboxService | null {
  try {
    return new AgentSandboxService(store);
  } catch {
    return null;
  }
}
