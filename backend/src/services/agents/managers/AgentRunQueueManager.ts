import type { AgentRunSpec } from '../engine/AgentRunSpec.js';

export interface AgentRunQueueJob {
  runId: string;
  sessionId?: string;
  attempts?: number;
  maxAttempts?: number;
  payload?: Record<string, unknown>;
}

export type AgentRunQueueWorker = (job: AgentRunQueueJob) => Promise<void>;

/**
 * Persistence port for the durable run queue. Implemented by
 * {@link AgentRunQueueRepository}; left undefined for pure in-memory tests so the
 * manager degrades to its original in-process semaphore behavior.
 */
export interface AgentRunQueueBackend {
  enqueue(input: {
    runId: string;
    sessionId?: string;
    maxAttempts?: number;
    payload?: Record<string, unknown>;
  }): Promise<void>;
  claim(owner: string, limit: number): Promise<AgentRunQueueJob[]>;
  claimRun(runId: string, owner: string): Promise<unknown | null>;
  heartbeat(runId: string, owner: string): Promise<boolean>;
  complete(runId: string): Promise<void>;
  requeueForResume(runId: string): Promise<void>;
  fail(runId: string, error: string): Promise<unknown>;
  cancel(runId: string): Promise<boolean>;
}

export interface AgentRunQueueOptions {
  maxConcurrentRuns?: number;
  backend?: AgentRunQueueBackend;
  owner?: string;
  heartbeatIntervalMs?: number;
  maxAttempts?: number;
  workerPollIntervalMs?: number;
  workerBatchSize?: number;
}

export interface AgentRunQueueWorkerOptions {
  pollIntervalMs?: number;
  batchSize?: number;
  immediate?: boolean;
}

export interface AgentRunQueueLease {
  runId: string;
  queued: boolean;
  acquiredAt: string;
  release: () => Promise<void>;
  /** Re-queue without marking succeeded — used when a run pauses for HITL/permission. */
  suspend: () => Promise<void>;
  /** Mark the underlying durable job failed (re-queues for retry while attempts remain). */
  fail: (error: unknown) => Promise<void>;
}

interface PendingRunQueueEntry {
  spec: AgentRunSpec;
  resolve: (lease: AgentRunQueueLease) => void;
  reject: (error: Error) => void;
  signal?: AbortSignal;
  abortListener?: () => void;
}

export class AgentRunQueueManager {
  private readonly maxConcurrentRuns: number;
  private activeRuns = 0;
  private readonly pending: PendingRunQueueEntry[] = [];
  private readonly backend?: AgentRunQueueBackend;
  private readonly owner: string;
  private readonly heartbeatIntervalMs: number;
  private readonly maxAttempts: number;
  private readonly workerPollIntervalMs: number;
  private readonly workerBatchSize: number;
  private worker?: AgentRunQueueWorker;
  private workerTimer?: ReturnType<typeof setTimeout>;
  private workerStopped = true;
  private workerRunning = false;

  constructor(options: AgentRunQueueOptions = {}) {
    this.maxConcurrentRuns = normalizeMaxConcurrentRuns(options.maxConcurrentRuns);
    this.backend = options.backend;
    this.owner = options.owner ?? `agent-queue-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? 15_000;
    this.maxAttempts = Math.max(1, Math.floor(options.maxAttempts ?? 1));
    this.workerPollIntervalMs = normalizePositiveInteger(options.workerPollIntervalMs, 2_000);
    this.workerBatchSize = normalizePositiveInteger(options.workerBatchSize, 4);
  }

  get snapshot() {
    return {
      maxConcurrentRuns: this.maxConcurrentRuns,
      activeRuns: this.activeRuns,
      queuedRuns: this.pending.length,
      durable: Boolean(this.backend),
      owner: this.owner,
      workerRunning: !this.workerStopped
    };
  }

  async acquire(spec: AgentRunSpec, signal?: AbortSignal): Promise<AgentRunQueueLease> {
    if (signal?.aborted) {
      throw createQueueAbortError(spec.runId);
    }

    if (this.backend) {
      await this.backend.enqueue({
        runId: spec.runId,
        sessionId: spec.sessionId,
        maxAttempts: this.maxAttempts,
        payload: {
          source: spec.source,
          agentId: spec.agentDef?.id || spec.temporaryAgentDef?.id || spec.metadata?.agentId,
          streaming: spec.metadata?.streaming,
          noTools: spec.metadata?.noTools,
          noSkills: spec.metadata?.noSkills,
          owner: this.owner
        }
      });
    }

    if (signal?.aborted) {
      if (this.backend) {
        await this.backend.cancel(spec.runId).catch(() => false);
      }
      throw createQueueAbortError(spec.runId);
    }

    if (this.canAcquireImmediately()) {
      return this.createLease(spec, false);
    }

    return new Promise<AgentRunQueueLease>((resolve, reject) => {
      const entry: PendingRunQueueEntry = { spec, resolve, reject, signal };
      if (signal) {
        entry.abortListener = () => {
          this.removePending(entry);
          if (this.backend) {
            void this.backend.cancel(spec.runId).catch(() => undefined);
          }
          reject(createQueueAbortError(spec.runId));
        };
        signal.addEventListener('abort', entry.abortListener, { once: true });
      }
      this.pending.push(entry);
    });
  }

  cancel(runId: string): boolean {
    const entry = this.pending.find((item) => item.spec.runId === runId);
    if (entry) {
      this.removePending(entry);
      entry.reject(createQueueAbortError(runId));
    }
    if (this.backend) {
      void this.backend.cancel(runId).catch(() => undefined);
    }
    return Boolean(entry);
  }

  async requeueForResume(runId: string): Promise<void> {
    if (!this.backend) return;
    await this.backend.requeueForResume(runId);
  }

  startWorker(worker: AgentRunQueueWorker, options: AgentRunQueueWorkerOptions = {}): () => void {
    if (!this.backend) return () => undefined;
    this.stopWorker();
    this.worker = worker;
    this.workerStopped = false;

    const pollIntervalMs = normalizePositiveInteger(options.pollIntervalMs, this.workerPollIntervalMs);
    const batchSize = normalizePositiveInteger(options.batchSize, this.workerBatchSize);

    const schedule = () => {
      if (this.workerStopped) return;
      this.workerTimer = setTimeout(() => {
        void this.runWorkerOnce(worker, batchSize).finally(schedule);
      }, pollIntervalMs);
      if (typeof this.workerTimer.unref === 'function') this.workerTimer.unref();
    };

    if (options.immediate === false) {
      schedule();
    } else {
      void this.runWorkerOnce(worker, batchSize).finally(schedule);
    }

    return () => this.stopWorker();
  }

  stopWorker(): void {
    this.workerStopped = true;
    this.worker = undefined;
    if (this.workerTimer) {
      clearTimeout(this.workerTimer);
      this.workerTimer = undefined;
    }
  }

  async runWorkerOnce(worker = this.worker, batchSize = this.workerBatchSize): Promise<number> {
    if (!this.backend || !worker || this.workerRunning) return 0;
    const limit = this.availableWorkerSlots(batchSize);
    if (limit <= 0) return 0;

    this.workerRunning = true;
    try {
      const jobs = await this.backend.claim(this.owner, limit);
      const backgroundTasks: Promise<void>[] = [];

      for (const job of jobs) {
        const pendingEntry = this.takePending(job.runId);
        const lease = this.createClaimedLease(job.runId, Boolean(pendingEntry));
        if (pendingEntry) {
          pendingEntry.resolve(lease);
        } else {
          backgroundTasks.push(this.processClaimedJob(job, lease, worker));
        }
      }

      await Promise.all(backgroundTasks);
      return jobs.length;
    } finally {
      this.workerRunning = false;
    }
  }

  private canAcquireImmediately(): boolean {
    return this.activeRuns < this.maxConcurrentRuns;
  }

  private availableWorkerSlots(batchSize: number): number {
    const normalizedBatchSize = normalizePositiveInteger(batchSize, this.workerBatchSize);
    if (this.maxConcurrentRuns === Number.POSITIVE_INFINITY) return normalizedBatchSize;
    return Math.max(0, Math.min(normalizedBatchSize, this.maxConcurrentRuns - this.activeRuns));
  }

  private async createLease(spec: AgentRunSpec, queued: boolean): Promise<AgentRunQueueLease> {
    this.activeRuns += 1;
    try {
      if (this.backend) {
        const claimed = await this.backend.claimRun(spec.runId, this.owner);
        if (!claimed) {
          throw createQueueClaimError(spec.runId);
        }
      }
    } catch (error) {
      this.activeRuns = Math.max(0, this.activeRuns - 1);
      this.drain();
      throw error;
    }

    return this.createLeaseHandle(spec.runId, queued);
  }

  private createClaimedLease(runId: string, queued: boolean): AgentRunQueueLease {
    this.activeRuns += 1;
    return this.createLeaseHandle(runId, queued);
  }

  private createLeaseHandle(runId: string, queued: boolean): AgentRunQueueLease {
    let released = false;
    let heartbeat: ReturnType<typeof setInterval> | undefined;

    if (this.backend) {
      heartbeat = setInterval(() => {
        void this.backend!.heartbeat(runId, this.owner).catch(() => undefined);
      }, this.heartbeatIntervalMs);
      if (typeof heartbeat.unref === 'function') heartbeat.unref();
    }

    const finalize = async (outcome: 'complete' | 'suspend' | 'fail', error?: unknown): Promise<void> => {
      if (released) return;
      released = true;
      if (heartbeat) clearInterval(heartbeat);
      try {
        if (this.backend) {
          if (outcome === 'fail') {
            await this.backend.fail(runId, errorMessage(error));
          } else if (outcome === 'suspend') {
            await this.backend.requeueForResume(runId);
          } else {
            await this.backend.complete(runId);
          }
        }
      } finally {
        this.activeRuns = Math.max(0, this.activeRuns - 1);
        this.drain();
      }
    };

    return {
      runId,
      queued,
      acquiredAt: new Date().toISOString(),
      release: () => finalize('complete'),
      suspend: () => finalize('suspend'),
      fail: (error: unknown) => finalize('fail', error)
    };
  }

  private async processClaimedJob(
    job: AgentRunQueueJob,
    lease: AgentRunQueueLease,
    worker: AgentRunQueueWorker
  ): Promise<void> {
    try {
      await worker(job);
      await lease.release();
    } catch (error) {
      await lease.fail(error);
    }
  }

  private drain(): void {
    if (!this.canAcquireImmediately()) return;
    const entry = this.pending.shift();
    if (!entry) return;
    this.detachAbortListener(entry);
    if (entry.signal?.aborted) {
      if (this.backend) {
        void this.backend.cancel(entry.spec.runId).catch(() => undefined);
      }
      entry.reject(createQueueAbortError(entry.spec.runId));
      this.drain();
      return;
    }
    void this.createLease(entry.spec, true)
      .then(entry.resolve)
      .catch(entry.reject);
  }

  private takePending(runId: string): PendingRunQueueEntry | undefined {
    const entry = this.pending.find((item) => item.spec.runId === runId);
    if (!entry) return undefined;
    this.removePending(entry);
    return entry;
  }

  private removePending(entry: PendingRunQueueEntry): void {
    const index = this.pending.indexOf(entry);
    if (index >= 0) {
      this.pending.splice(index, 1);
    }
    this.detachAbortListener(entry);
  }

  private detachAbortListener(entry: PendingRunQueueEntry): void {
    if (entry.signal && entry.abortListener) {
      entry.signal.removeEventListener('abort', entry.abortListener);
      entry.abortListener = undefined;
    }
  }
}

function normalizeMaxConcurrentRuns(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : Number.POSITIVE_INFINITY;
}

function normalizePositiveInteger(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : fallback;
}

function createQueueAbortError(runId: string): Error {
  const error = new Error(`Agent run queue wait aborted: ${runId}`);
  error.name = 'AbortError';
  return error;
}

function createQueueClaimError(runId: string): Error {
  const error = new Error(`Agent run queue claim rejected: ${runId}`);
  error.name = 'AgentRunQueueClaimError';
  return error;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(error ?? 'unknown error');
}
