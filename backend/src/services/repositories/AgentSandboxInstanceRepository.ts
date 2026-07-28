import type { AgentSandboxInstance, AgentSandboxInstanceStore } from '../agents/engine/AgentSandboxTypes.js';
import { BaseRepository } from './BaseRepository.js';

interface AgentSandboxInstanceRow {
  agent_id: string;
  container_id: string;
  workspace_id: string;
  host_mount_path: string;
  status: string;
  image: string;
  last_used_at: string;
  created_at: string;
  metadata: unknown;
  error?: string | null;
}

export class AgentSandboxInstanceRepository extends BaseRepository implements AgentSandboxInstanceStore {
  async get(agentId: string): Promise<AgentSandboxInstance | null> {
    const row = await this.db.get<AgentSandboxInstanceRow>(
      `SELECT agent_id, container_id, workspace_id, host_mount_path, status, image,
              last_used_at, created_at, metadata, metadata->>'error' AS error
       FROM agent_sandbox_instances
       WHERE agent_id = ?`,
      agentId
    );
    return row ? this.toEntity(row) : null;
  }

  async upsert(instance: AgentSandboxInstance): Promise<void> {
    const metadata = {
      ...(instance.metadata ?? {}),
      ...(instance.error ? { error: instance.error } : {})
    };
    await this.db.run(
      `INSERT INTO agent_sandbox_instances
        (agent_id, container_id, workspace_id, host_mount_path, status, image,
         last_used_at, created_at, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (agent_id) DO UPDATE SET
         container_id = excluded.container_id,
         workspace_id = excluded.workspace_id,
         host_mount_path = excluded.host_mount_path,
         status = excluded.status,
         image = excluded.image,
         last_used_at = excluded.last_used_at,
         metadata = excluded.metadata`,
      instance.agentId,
      instance.containerId,
      instance.workspaceId,
      instance.hostMountPath,
      instance.status,
      instance.image,
      instance.lastUsedAt,
      instance.createdAt,
      JSON.stringify(metadata)
    );
  }

  async delete(agentId: string): Promise<void> {
    await this.db.run('DELETE FROM agent_sandbox_instances WHERE agent_id = ?', agentId);
  }

  async listAll(): Promise<AgentSandboxInstance[]> {
    const rows = await this.db.all<AgentSandboxInstanceRow>(
      `SELECT agent_id, container_id, workspace_id, host_mount_path, status, image,
              last_used_at, created_at, metadata, metadata->>'error' AS error
       FROM agent_sandbox_instances
       ORDER BY last_used_at DESC`
    );
    return rows.map((row) => this.toEntity(row));
  }

  private toEntity(row: AgentSandboxInstanceRow): AgentSandboxInstance {
    const metadata = this.parseJson<Record<string, unknown>>(row.metadata as string, {});
    const { error: metadataError, ...restMetadata } = metadata;
    return {
      agentId: row.agent_id,
      containerId: row.container_id,
      workspaceId: row.workspace_id,
      hostMountPath: row.host_mount_path,
      status: row.status as AgentSandboxInstance['status'],
      image: row.image,
      lastUsedAt: row.last_used_at,
      createdAt: row.created_at,
      error: row.error ?? (typeof metadataError === 'string' ? metadataError : undefined),
      metadata: Object.keys(restMetadata).length > 0 ? restMetadata : undefined
    };
  }
}

export class InMemoryAgentSandboxInstanceStore implements AgentSandboxInstanceStore {
  private readonly rows = new Map<string, AgentSandboxInstance>();

  async get(agentId: string): Promise<AgentSandboxInstance | null> {
    return this.rows.get(agentId) ?? null;
  }

  async upsert(instance: AgentSandboxInstance): Promise<void> {
    this.rows.set(instance.agentId, { ...instance });
  }

  async delete(agentId: string): Promise<void> {
    this.rows.delete(agentId);
  }

  async listAll(): Promise<AgentSandboxInstance[]> {
    return Array.from(this.rows.values());
  }
}
