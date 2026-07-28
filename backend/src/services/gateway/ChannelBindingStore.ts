import { LogService } from '../LogService.js';
import type { PgConnection } from '../repositories/DatabaseConnection.js';
import {
  CHANNEL_BINDING_WILDCARD,
  type ChannelBinding,
  type ChannelBindingInput,
  type ChannelBindingListFilter,
  type ChannelBindingQuery,
  type ResolveResult,
  normalizeWildcard,
} from './channelBindingTypes.js';

interface BindingRow {
  id: string;
  channel: string;
  account_id: string | null;
  peer_id: string | null;
  agent_id: string;
  priority: number;
  is_enabled: boolean;
  description: string | null;
  created_at: number;
  updated_at: number;
  metadata: Record<string, unknown> | null;
}

function rowToBinding(row: BindingRow): ChannelBinding {
  return {
    id: row.id,
    channel: row.channel,
    accountId: row.account_id,
    peerId: row.peer_id,
    agentId: row.agent_id,
    priority: row.priority,
    isEnabled: row.is_enabled,
    description: row.description ?? undefined,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    metadata: row.metadata ?? undefined,
  };
}

function generateId(): string {
  // ULID-ish: sortable by created_at. Good enough for an ID.
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 10);
  return `bnd_${t}${r}`;
}

export class ChannelBindingStore {
  constructor(private readonly conn: PgConnection) {}

  async upsert(input: ChannelBindingInput): Promise<ChannelBinding> {
    const now = Date.now();
    const accountId = normalizeWildcard(input.accountId);
    const peerId = normalizeWildcard(input.peerId);
    const id = input.id ?? generateId();
    const priority = input.priority ?? 0;
    const isEnabled = input.isEnabled ?? true;
    const channel = input.channel;
    if (!channel) throw new Error('channel is required');
    if (!input.agentId) throw new Error('agentId is required');

    // Deactivate any existing active rule for the same (channel, account, peer)
    // so the unique index doesn't conflict. Re-activate the new one.
    await this.conn.run(
      `UPDATE channel_bindings
         SET is_enabled = FALSE, updated_at = $1
       WHERE channel = $2
         AND COALESCE(account_id, $3) = $3
         AND COALESCE(peer_id, $4) = $4
         AND is_enabled = TRUE
         AND id <> $5`,
      now,
      channel,
      accountId ?? CHANNEL_BINDING_WILDCARD,
      peerId ?? CHANNEL_BINDING_WILDCARD,
      id
    );

    await this.conn.run(
      `INSERT INTO channel_bindings(
         id, channel, account_id, peer_id, agent_id, priority, is_enabled,
         description, created_at, updated_at, metadata
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,$10)
       ON CONFLICT (id) DO UPDATE SET
         channel = EXCLUDED.channel,
         account_id = EXCLUDED.account_id,
         peer_id = EXCLUDED.peer_id,
         agent_id = EXCLUDED.agent_id,
         priority = EXCLUDED.priority,
         is_enabled = EXCLUDED.is_enabled,
         description = EXCLUDED.description,
         updated_at = EXCLUDED.updated_at,
         metadata = EXCLUDED.metadata`,
      id,
      channel,
      accountId,
      peerId,
      input.agentId,
      priority,
      isEnabled,
      input.description ?? null,
      now,
      input.metadata ? JSON.stringify(input.metadata) : null
    );

    const row = await this.conn.get<BindingRow>(
      `SELECT * FROM channel_bindings WHERE id = $1`,
      id
    );
    if (!row) {
      throw new Error(`ChannelBinding upsert succeeded but row not found for id=${id}`);
    }
    return rowToBinding(row);
  }

  async get(id: string): Promise<ChannelBinding | null> {
    const row = await this.conn.get<BindingRow>(
      `SELECT * FROM channel_bindings WHERE id = $1`,
      id
    );
    return row ? rowToBinding(row) : null;
  }

  async list(filter: ChannelBindingListFilter = {}): Promise<ChannelBinding[]> {
    const conds: string[] = [];
    const params: unknown[] = [];
    if (filter.channel !== undefined) {
      params.push(filter.channel);
      conds.push(`channel = $${params.length}`);
    }
    if (filter.agentId !== undefined) {
      params.push(filter.agentId);
      conds.push(`agent_id = $${params.length}`);
    }
    if (filter.isEnabled !== undefined) {
      params.push(filter.isEnabled);
      conds.push(`is_enabled = $${params.length}`);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const rows = await this.conn.all<BindingRow>(
      `SELECT * FROM channel_bindings ${where} ORDER BY channel, priority DESC, updated_at DESC`,
      ...params
    );
    return rows.map(rowToBinding);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.conn.run(
      `DELETE FROM channel_bindings WHERE id = $1`,
      id
    );
    return result.changes > 0;
  }

  async setEnabled(id: string, isEnabled: boolean): Promise<ChannelBinding | null> {
    const now = Date.now();
    const row = await this.conn.get<BindingRow>(
      `UPDATE channel_bindings
         SET is_enabled = $1, updated_at = $2
       WHERE id = $3
       RETURNING *`,
      isEnabled,
      now,
      id
    );
    return row ? rowToBinding(row) : null;
  }

  /**
   * Resolve a (channel, account, peer) triple to an agent_id.
   *
   * Returns null if no rule matches and no fallback is provided. If `fallbackAgentId`
   * is set, a non-binding result is returned with strategy='fallback'.
   *
   * Matching order (most specific wins):
   *   1. (channel, account, peer) all non-null
   *   2. (channel, account, *)    account_id non-null, peer_id null
   *   3. (channel, *,    peer)    account_id null, peer_id non-null
   *   4. (channel, *,    *)       both null
   * Then by priority DESC, updated_at DESC.
   */
  async resolve(
    query: ChannelBindingQuery,
    opts: { fallbackAgentId?: string } = {}
  ): Promise<ResolveResult | null> {
    const channel = query.channel;
    if (!channel) {
      LogService.warn('[ChannelBindingStore] resolve called without channel');
      return null;
    }
    const accountId = normalizeWildcard(query.accountId);
    const peerId = normalizeWildcard(query.peerId);

    const rows = await this.conn.all<BindingRow>(
      `SELECT *,
              (CASE WHEN account_id IS NOT NULL AND peer_id IS NOT NULL THEN 1
                    WHEN account_id IS NOT NULL AND peer_id IS NULL     THEN 2
                    WHEN account_id IS NULL     AND peer_id IS NOT NULL THEN 3
                    ELSE 4 END) AS match_level
         FROM channel_bindings
        WHERE channel = $1
          AND is_enabled = TRUE
          AND (account_id = $2 OR account_id IS NULL OR account_id = $3)
          AND (peer_id    = $4 OR peer_id    IS NULL OR peer_id    = $5)
        ORDER BY match_level ASC, priority DESC, updated_at DESC
        LIMIT 1`,
      channel,
      accountId,
      CHANNEL_BINDING_WILDCARD,
      peerId,
      CHANNEL_BINDING_WILDCARD
    );

    if (rows.length > 0) {
      const row = rows[0];
      const level = (row as BindingRow & { match_level: number }).match_level as
        | 1
        | 2
        | 3
        | 4;
      const strategy =
        level === 1
          ? 'specific'
          : level === 2
            ? 'account'
            : level === 3
              ? 'peer'
              : 'channel';
      return {
        agentId: row.agent_id,
        bindingId: row.id,
        matchLevel: level,
        strategy,
      };
    }

    if (opts.fallbackAgentId) {
      return {
        agentId: opts.fallbackAgentId,
        bindingId: null,
        matchLevel: 4,
        strategy: 'fallback',
      };
    }
    return null;
  }
}
