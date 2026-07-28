import type { PgConnection } from '../repositories/DatabaseConnection.js';
import {
  type GatewayMessageLog,
  type GatewayResolution,
  type GatewayRunStatus,
} from './gatewayTypes.js';

interface GatewayMessageRow {
  id: string;
  channel: string;
  account_id: string | null;
  peer_id: string | null;
  agent_id: string | null;
  binding_id: string | null;
  match_level: number | null;
  strategy: string | null;
  status: string;
  text_length: number | null;
  error: string | null;
  created_at: number;
  completed_at: number | null;
  metadata: Record<string, unknown> | null;
}

function rowToLog(row: GatewayMessageRow): GatewayMessageLog {
  return {
    id: row.id,
    channel: row.channel,
    accountId: row.account_id,
    peerId: row.peer_id,
    agentId: row.agent_id,
    bindingId: row.binding_id,
    matchLevel: (row.match_level ?? null) as GatewayMessageLog['matchLevel'],
    strategy: (row.strategy ?? null) as GatewayMessageLog['strategy'],
    status: row.status as GatewayRunStatus,
    textLength: row.text_length ?? 0,
    error: row.error,
    createdAt: Number(row.created_at),
    completedAt: row.completed_at != null ? Number(row.completed_at) : null,
    metadata: row.metadata,
  };
}

function generateId(): string {
  return `msg_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export class GatewayMessageRepository {
  constructor(private readonly conn: PgConnection) {}

  async create(input: {
    channel: string;
    accountId?: string | null;
    peerId?: string | null;
    resolution?: GatewayResolution | null;
    textLength: number;
    status?: GatewayRunStatus;
    metadata?: Record<string, unknown>;
  }): Promise<GatewayMessageLog> {
    const id = generateId();
    const now = Date.now();
    const status: GatewayRunStatus = input.status ?? 'pending';
    const resolution = input.resolution ?? null;
    await this.conn.run(
      `INSERT INTO gateway_messages(
         id, channel, account_id, peer_id, agent_id, binding_id,
         match_level, strategy, status, text_length,
         error, created_at, completed_at, metadata
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      id,
      input.channel,
      input.accountId ?? null,
      input.peerId ?? null,
      resolution?.agentId ?? null,
      resolution?.bindingId ?? null,
      resolution?.matchLevel ?? null,
      resolution?.strategy ?? null,
      status,
      input.textLength,
      null,
      now,
      null,
      input.metadata ? JSON.stringify(input.metadata) : null
    );
    return {
      id,
      channel: input.channel,
      accountId: input.accountId ?? null,
      peerId: input.peerId ?? null,
      agentId: resolution?.agentId ?? null,
      bindingId: resolution?.bindingId ?? null,
      matchLevel: resolution?.matchLevel ?? null,
      strategy: resolution?.strategy ?? null,
      status,
      textLength: input.textLength,
      error: null,
      createdAt: now,
      completedAt: null,
      metadata: input.metadata ?? null,
    };
  }

  async markStarted(id: string): Promise<void> {
    await this.conn.run(
      `UPDATE gateway_messages SET status = 'started' WHERE id = $1`,
      id
    );
  }

  async markCompleted(
    id: string,
    payload: { status: 'completed' | 'failed' | 'unrouted'; error?: string }
  ): Promise<void> {
    await this.conn.run(
      `UPDATE gateway_messages
         SET status = $1, error = $2, completed_at = $3
       WHERE id = $4`,
      payload.status,
      payload.error ?? null,
      Date.now(),
      id
    );
  }

  async get(id: string): Promise<GatewayMessageLog | null> {
    const row = await this.conn.get<GatewayMessageRow>(
      `SELECT * FROM gateway_messages WHERE id = $1`,
      id
    );
    return row ? rowToLog(row) : null;
  }

  async list(filter: { channel?: string; agentId?: string; limit?: number } = {}): Promise<GatewayMessageLog[]> {
    const conds: string[] = [];
    const params: unknown[] = [];
    if (filter.channel) {
      params.push(filter.channel);
      conds.push(`channel = $${params.length}`);
    }
    if (filter.agentId) {
      params.push(filter.agentId);
      conds.push(`agent_id = $${params.length}`);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const limit = filter.limit ?? 50;
    params.push(limit);
    const rows = await this.conn.all<GatewayMessageRow>(
      `SELECT * FROM gateway_messages ${where} ORDER BY created_at DESC LIMIT $${params.length}`,
      ...params
    );
    return rows.map(rowToLog);
  }
}
