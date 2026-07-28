import type { PgConnection } from '../repositories/DatabaseConnection.js';
import type { AgentUploadRecord } from './agentUploadTypes.js';

interface UploadRow {
  id: string;
  agent_id: string;
  name: string;
  mime: string;
  size: number;
  storage_path: string;
  created_at: number;
}

function rowToRecord(row: UploadRow): AgentUploadRecord {
  return {
    id: row.id,
    agentId: row.agent_id,
    name: row.name,
    mime: row.mime,
    size: Number(row.size),
    storagePath: row.storage_path,
    createdAt: Number(row.created_at),
  };
}

function generateUploadId(): string {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 10);
  return `aupl_${t}${r}`;
}

export class AgentUploadStore {
  constructor(private readonly conn: PgConnection) {}

  async get(id: string): Promise<AgentUploadRecord | null> {
    const row = await this.conn.get<UploadRow>(
      `SELECT * FROM agent_uploads WHERE id = $1`,
      id,
    );
    return row ? rowToRecord(row) : null;
  }

  async insert(input: {
    agentId: string;
    name: string;
    mime: string;
    size: number;
  }): Promise<AgentUploadRecord> {
    const id = generateUploadId();
    const storagePath = `agent-uploads/${id}`;
    const now = Date.now();
    await this.conn.run(
      `INSERT INTO agent_uploads(
         id, agent_id, name, mime, size, storage_path, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      id,
      input.agentId,
      input.name,
      input.mime,
      input.size,
      storagePath,
      now,
    );
    const row = await this.conn.get<UploadRow>(`SELECT * FROM agent_uploads WHERE id = $1`, id);
    if (!row) throw new Error(`upload ${id} not found after insert`);
    return rowToRecord(row);
  }
}
