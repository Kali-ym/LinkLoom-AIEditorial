import type { PgConnection } from '../repositories/DatabaseConnection.js';

export class ToolAuthGrantStore {
  constructor(private readonly conn: PgConnection) {}

  async list(agentId: string): Promise<Set<string>> {
    const rows = await this.conn.all<{ tool_key: string }>(
      `SELECT tool_key FROM agent_tool_auth_grants WHERE agent_id = $1`,
      agentId,
    );
    return new Set(rows.map((row) => row.tool_key));
  }

  async grant(agentId: string, toolKey: string, metadata?: Record<string, unknown>): Promise<void> {
    const now = Date.now();
    await this.conn.run(
      `INSERT INTO agent_tool_auth_grants(agent_id, tool_key, granted_at, metadata)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (agent_id, tool_key) DO UPDATE SET
         granted_at = EXCLUDED.granted_at,
         metadata = EXCLUDED.metadata`,
      agentId,
      toolKey,
      now,
      metadata ?? null,
    );
  }
}
