import { LogService } from '../../LogService.js';
import type { AgentSandboxPool } from '../engine/AgentSandboxPool.js';
import type { AgentSandboxInstanceStore } from '../engine/AgentSandboxTypes.js';

export interface AgentSandboxIdleReaperOptions {
  pool: AgentSandboxPool;
  store: AgentSandboxInstanceStore;
  intervalMs?: number;
  resolveIdleTimeoutMs?: (agentId: string, metadata?: Record<string, unknown>) => number;
}

export function resolveDefaultSandboxIdleTimeoutMs(): number {
  const raw = process.env.LINKLOOM_SANDBOX_IDLE_TIMEOUT_MS;
  if (raw === '0') return 0;
  const parsed = raw ? Number(raw) : 30 * 60 * 1000;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 30 * 60 * 1000;
}

export class AgentSandboxIdleReaper {
  private readonly pool: AgentSandboxPool;
  private readonly store: AgentSandboxInstanceStore;
  private readonly intervalMs: number;
  private readonly resolveIdleTimeoutMs: (
    agentId: string,
    metadata?: Record<string, unknown>
  ) => number;
  private timer: ReturnType<typeof setInterval> | undefined;
  private ticking = false;

  constructor(opts: AgentSandboxIdleReaperOptions) {
    this.pool = opts.pool;
    this.store = opts.store;
    this.intervalMs = opts.intervalMs ?? Number(process.env.LINKLOOM_SANDBOX_REAPER_INTERVAL_MS || 60_000);
    this.resolveIdleTimeoutMs =
      opts.resolveIdleTimeoutMs ??
      ((_agentId, metadata) => {
        const fromMetadata = metadata?.idleTimeoutMs;
        if (typeof fromMetadata === 'number' && fromMetadata >= 0) return fromMetadata;
        return resolveDefaultSandboxIdleTimeoutMs();
      });
  }

  start(): void {
    if (resolveDefaultSandboxIdleTimeoutMs() === 0) {
      LogService.info('[AgentSandboxIdleReaper] Disabled (LINKLOOM_SANDBOX_IDLE_TIMEOUT_MS=0)');
      return;
    }
    void this.tick();
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
    if (typeof this.timer.unref === 'function') this.timer.unref();
    LogService.info(
      `[AgentSandboxIdleReaper] Started (interval=${this.intervalMs}ms, defaultTimeout=${resolveDefaultSandboxIdleTimeoutMs()}ms)`
    );
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  async tick(): Promise<number> {
    if (this.ticking) return 0;
    this.ticking = true;
    let stopped = 0;
    try {
      const now = Date.now();
      const rows = await this.store.listAll();
      for (const row of rows) {
        if (row.status !== 'running' && row.status !== 'starting') continue;
        const timeoutMs = this.resolveIdleTimeoutMs(row.agentId, row.metadata);
        if (timeoutMs <= 0) continue;
        const lastUsed = Date.parse(row.lastUsedAt);
        if (!Number.isFinite(lastUsed) || now - lastUsed < timeoutMs) continue;
        await this.pool.stop(row.agentId);
        stopped += 1;
        LogService.info(`[AgentSandboxIdleReaper] Stopped idle sandbox for agent ${row.agentId}`);
      }
    } catch (error) {
      LogService.warn(
        `[AgentSandboxIdleReaper] Tick failed: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      this.ticking = false;
    }
    return stopped;
  }
}
