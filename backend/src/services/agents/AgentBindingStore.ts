import type { PgConnection } from '../repositories/DatabaseConnection.js';
import type {
  AgentResourceBinding,
  AgentResourceBindingInput,
  AgentResourceType,
} from './agentBindingTypes.js';

interface BindingRow {
  id: string;
  agent_id: string;
  resource_type: string;
  resource_id: string;
  created_at: number;
  metadata: Record<string, unknown> | null;
}

function rowToBinding(row: BindingRow): AgentResourceBinding {
  return {
    id: row.id,
    agentId: row.agent_id,
    resourceType: row.resource_type as AgentResourceType,
    resourceId: row.resource_id,
    createdAt: Number(row.created_at),
    metadata: row.metadata ?? undefined,
  };
}

function generateId(): string {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 10);
  return `arb_${t}${r}`;
}

export class AgentBindingStore {
  constructor(private readonly conn: PgConnection) {}

  async list(agentId: string): Promise<AgentResourceBinding[]> {
    const rows = await this.conn.all<BindingRow>(
      `SELECT * FROM agent_resource_bindings
       WHERE agent_id = $1
       ORDER BY resource_type, resource_id`,
      agentId,
    );
    return rows.map(rowToBinding);
  }

  async get(id: string): Promise<AgentResourceBinding | null> {
    const row = await this.conn.get<BindingRow>(
      `SELECT * FROM agent_resource_bindings WHERE id = $1`,
      id,
    );
    return row ? rowToBinding(row) : null;
  }

  async upsert(agentId: string, input: AgentResourceBindingInput): Promise<AgentResourceBinding> {
    const now = Date.now();
    const existing = await this.conn.get<BindingRow>(
      `SELECT * FROM agent_resource_bindings
       WHERE agent_id = $1 AND resource_type = $2 AND resource_id = $3`,
      agentId,
      input.resourceType,
      input.resourceId,
    );

    if (existing) {
      return rowToBinding(existing);
    }

    const id = generateId();
    await this.conn.run(
      `INSERT INTO agent_resource_bindings(
         id, agent_id, resource_type, resource_id, created_at, metadata
       ) VALUES ($1, $2, $3, $4, $5, $6)`,
      id,
      agentId,
      input.resourceType,
      input.resourceId,
      now,
      input.metadata ?? null,
    );

    const row = await this.conn.get<BindingRow>(
      `SELECT * FROM agent_resource_bindings WHERE id = $1`,
      id,
    );
    if (!row) throw new Error(`binding ${id} not found after insert`);
    return rowToBinding(row);
  }

  async deleteById(agentId: string, bindingId: string): Promise<boolean> {
    const result = await this.conn.run(
      `DELETE FROM agent_resource_bindings WHERE id = $1 AND agent_id = $2`,
      bindingId,
      agentId,
    );
    return result.changes > 0;
  }

  async deleteByResource(
    agentId: string,
    resourceType: AgentResourceType,
    resourceId: string,
  ): Promise<boolean> {
    const result = await this.conn.run(
      `DELETE FROM agent_resource_bindings
       WHERE agent_id = $1 AND resource_type = $2 AND resource_id = $3`,
      agentId,
      resourceType,
      resourceId,
    );
    return result.changes > 0;
  }

  async listResourceIds(agentId: string, resourceType: AgentResourceType): Promise<string[]> {
    const rows = await this.conn.all<{ resource_id: string }>(
      `SELECT resource_id FROM agent_resource_bindings
       WHERE agent_id = $1 AND resource_type = $2
       ORDER BY resource_id`,
      agentId,
      resourceType,
    );
    return rows.map((row) => row.resource_id);
  }
}
