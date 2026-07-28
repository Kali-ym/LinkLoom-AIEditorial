import { randomUUID } from 'crypto';
import { LogService } from '../../LogService.js';
import type { PgConnection } from '../../repositories/DatabaseConnection.js';

/**
 * Lightweight cross-process signal that "run X has a new event at sequence N".
 * Carries only `runId + seq + instanceId` — never the event payload — so it stays well
 * under the PostgreSQL NOTIFY 8KB limit. Receivers pull the real event(s) from
 * `agent_events` by sequence.
 */
export interface AgentRunEventSignal {
  runId: string;
  seq: number;
  instanceId: string;
}

export type AgentRunEventSignalHandler = (signal: AgentRunEventSignal) => void;

export interface AgentRunEventChannel {
  /** Stable id of the emitting process instance; used to suppress self-delivery. */
  readonly instanceId: string;
  start(): Promise<void>;
  signal(runId: string, seq: number): Promise<void>;
  onSignal(handler: AgentRunEventSignalHandler): () => void;
  close(): Promise<void>;
}

/**
 * Single-process channel. `signal` dispatches synchronously to local handlers, tagged
 * with this instance's id, so the cross-process fan-out collapses to a no-op extra path
 * (the local event bus already delivered the event). Default for tests / no-DB setups.
 */
export class InMemoryAgentRunEventChannel implements AgentRunEventChannel {
  readonly instanceId = `mem-${randomUUID()}`;
  private readonly handlers = new Set<AgentRunEventSignalHandler>();

  async start(): Promise<void> {
    /* nothing to do */
  }

  async signal(runId: string, seq: number): Promise<void> {
    const payload: AgentRunEventSignal = { runId, seq, instanceId: this.instanceId };
    for (const handler of [...this.handlers]) {
      handler(payload);
    }
  }

  onSignal(handler: AgentRunEventSignalHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  async close(): Promise<void> {
    this.handlers.clear();
  }
}

const AGENT_RUN_EVENT_NOTIFY_CHANNEL = 'agent_run_events';

/**
 * PostgreSQL LISTEN/NOTIFY channel. Holds one dedicated long-lived client for LISTEN and
 * issues `pg_notify` for outgoing signals. Aligns with the project's "all-PostgreSQL, no
 * Redis" stance.
 */
export class PgAgentRunEventChannel implements AgentRunEventChannel {
  readonly instanceId = `pg-${process.pid}-${randomUUID()}`;
  private readonly handlers = new Set<AgentRunEventSignalHandler>();
  private client: import('pg').PoolClient | null = null;
  private started = false;
  private closing = false;
  private reconnectAttempts = 0;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private connecting?: Promise<void>;

  constructor(private readonly conn: PgConnection) {}

  async start(): Promise<void> {
    if (this.started && this.client) return;
    this.started = true;
    this.closing = false;
    await this.connectListener();
  }

  private async connectListener(): Promise<void> {
    if (this.closing) return;
    if (this.connecting) return this.connecting;

    this.connecting = (async () => {
      let nextClient: import('pg').PoolClient | null = null;
      try {
        nextClient = await this.conn.pool.connect();
        nextClient.on('notification', (message) => {
          if (message.channel !== AGENT_RUN_EVENT_NOTIFY_CHANNEL || !message.payload) return;
          const parsed = safeParseSignal(message.payload);
          if (!parsed) return;
          for (const handler of [...this.handlers]) {
            handler(parsed);
          }
        });
        nextClient.once('error', (err) => {
          LogService.warn(`Agent run event LISTEN client error: ${err?.message || err}`);
          this.scheduleReconnect(nextClient, true);
        });
        nextClient.once('end', () => {
          LogService.warn('Agent run event LISTEN client ended; reconnecting');
          this.scheduleReconnect(nextClient, true);
        });
        await nextClient.query(`LISTEN ${AGENT_RUN_EVENT_NOTIFY_CHANNEL}`);

        if (this.closing) {
          this.releaseClient(nextClient);
          return;
        }

        if (this.client && this.client !== nextClient) {
          this.releaseClient(this.client);
        }
        this.client = nextClient;
        this.reconnectAttempts = 0;
      } catch (err: any) {
        if (nextClient) this.releaseClient(nextClient, true);
        LogService.warn(`Failed to start agent run event LISTEN: ${err?.message || err}`);
        this.scheduleReconnect(null, true);
      } finally {
        this.connecting = undefined;
      }
    })();

    return this.connecting;
  }

  private scheduleReconnect(client: import('pg').PoolClient | null, destroyClient = false): void {
    if (this.closing || !this.started) return;
    if (client && this.client && this.client !== client) return;

    if (client) {
      if (this.client === client) this.client = null;
      this.releaseClient(client, destroyClient);
    }
    if (this.reconnectTimer) return;

    const delayMs = Math.min(30_000, 500 * 2 ** Math.min(6, this.reconnectAttempts++));
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      void this.connectListener();
    }, delayMs);
    if (typeof this.reconnectTimer.unref === 'function') this.reconnectTimer.unref();
  }

  private releaseClient(client: import('pg').PoolClient, destroy = false): void {
    try {
      if (destroy) {
        (client.release as any)(new Error('agent run event LISTEN reconnect'));
      } else {
        client.release();
      }
    } catch {
      /* ignore */
    }
  }

  async signal(runId: string, seq: number): Promise<void> {
    const payload: AgentRunEventSignal = { runId, seq, instanceId: this.instanceId };
    try {
      await this.conn.run('SELECT pg_notify(?, ?)', AGENT_RUN_EVENT_NOTIFY_CHANNEL, JSON.stringify(payload));
    } catch (err: any) {
      LogService.warn(`Failed to pg_notify agent run event: ${err?.message || err}`);
    }
  }

  onSignal(handler: AgentRunEventSignalHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  async close(): Promise<void> {
    this.closing = true;
    this.started = false;
    this.handlers.clear();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    if (this.client) {
      const client = this.client;
      this.client = null;
      try {
        await client.query(`UNLISTEN ${AGENT_RUN_EVENT_NOTIFY_CHANNEL}`);
      } catch {
        /* ignore */
      }
      this.releaseClient(client);
    }
  }
}

function safeParseSignal(payload: string): AgentRunEventSignal | null {
  try {
    const parsed = JSON.parse(payload) as Partial<AgentRunEventSignal>;
    if (typeof parsed.runId === 'string' && typeof parsed.seq === 'number' && typeof parsed.instanceId === 'string') {
      return { runId: parsed.runId, seq: parsed.seq, instanceId: parsed.instanceId };
    }
  } catch {
    /* ignore malformed payloads */
  }
  return null;
}
