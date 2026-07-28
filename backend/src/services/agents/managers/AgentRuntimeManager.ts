import type { AgentExecutionResult } from '../../../types/agent.js';
import type { AIProvider } from '../../AIProvider.js';
import { createPlatformGovernanceMiddleware } from '../engine/PlatformGovernanceMiddleware.js';
import type { AgentMiddleware } from '../engine/AgentMiddleware.js';
import type { AgentHitlResolution } from '../engine/AgentEvent.js';
import type { AgentRunSpec } from '../engine/AgentRunSpec.js';
import type { PermissionDecision } from '../engine/PermissionPolicy.js';
import type { ReActAgentEngine } from '../engine/ReActAgentEngine.js';
import type { ReActRuntimeOptions } from '../runtime/ReActRuntime.js';
import {
  AgentRunQueueManager,
  type AgentRunQueueJob,
  type AgentRunQueueLease,
  type AgentRunQueueWorkerOptions
} from './AgentRunQueueManager.js';

export interface AgentRuntimeRunInput {
  runSpec: AgentRunSpec;
  provider: AIProvider;
  runtimeOptions: Omit<ReActRuntimeOptions, 'provider' | 'budgetPolicy' | 'observationPolicy'>;
  middleware?: AgentMiddleware[];
  signal?: AbortSignal;
  metadata?: Record<string, unknown>;
}

export interface AgentRuntimeResumeInput extends AgentRuntimeRunInput {
  sessionId: string;
  decision: PermissionDecision;
  checkpointId?: string;
}

export interface AgentRuntimeHitlResumeInput extends AgentRuntimeRunInput {
  sessionId: string;
  resolution: AgentHitlResolution;
  checkpointId?: string;
}

export class AgentRuntimeManager {
  constructor(
    private readonly agentEngine: ReActAgentEngine,
    private readonly runQueue: AgentRunQueueManager = new AgentRunQueueManager()
  ) {}

  getQueueSnapshot() {
    return this.runQueue.snapshot;
  }

  cancelQueuedRun(runId: string): boolean {
    return this.runQueue.cancel(runId);
  }

  startQueueWorker(
    worker: (job: AgentRunQueueJob) => Promise<void>,
    options?: AgentRunQueueWorkerOptions
  ): () => void {
    return this.runQueue.startWorker(worker, options);
  }

  stopQueueWorker(): void {
    this.runQueue.stopWorker();
  }

  async runClaimed(input: AgentRuntimeRunInput, queue?: { queued?: boolean; acquiredAt?: string }): Promise<AgentExecutionResult> {
    const output = await this.agentEngine.run(input.runSpec, {
      middleware: [createPlatformGovernanceMiddleware(), ...(input.middleware ?? [])],
      signal: input.signal,
      metadata: {
        ...input.metadata,
        runQueue: {
          maxConcurrentRuns: this.runQueue.snapshot.maxConcurrentRuns,
          queued: queue?.queued ?? true,
          acquiredAt: queue?.acquiredAt ?? new Date().toISOString(),
          recovered: true
        }
      },
      runtimeOptions: {
        ...input.runtimeOptions,
        provider: input.provider,
        budgetPolicy: input.runSpec.budgetPolicy,
        observationPolicy: input.runSpec.observationPolicy
      }
    });
    return this.toAgentExecutionResult(output);
  }

  async run(input: AgentRuntimeRunInput): Promise<AgentExecutionResult> {
    const lease = await this.acquireRunSlot(input.runSpec, input.signal);
    try {
      const output = await this.agentEngine.run(input.runSpec, {
        middleware: [createPlatformGovernanceMiddleware(), ...(input.middleware ?? [])],
        signal: input.signal,
        metadata: {
          ...input.metadata,
          runQueue: {
            maxConcurrentRuns: this.runQueue.snapshot.maxConcurrentRuns,
            queued: lease.queued,
            acquiredAt: lease.acquiredAt
          }
        },
        runtimeOptions: {
          ...input.runtimeOptions,
          provider: input.provider,
          budgetPolicy: input.runSpec.budgetPolicy,
          observationPolicy: input.runSpec.observationPolicy
        }
      });

      await lease.release();
      return this.toAgentExecutionResult(output);
    } catch (error) {
      await lease.fail(error);
      throw error;
    }
  }

  async resume(input: AgentRuntimeResumeInput): Promise<AgentExecutionResult> {
    await this.runQueue.requeueForResume(input.runSpec.runId);
    const lease = await this.acquireRunSlot(input.runSpec, input.signal);
    try {
      const output = await this.agentEngine.resume(input.sessionId, {
        runId: input.runSpec.runId,
        decision: input.decision,
        checkpointId: input.checkpointId,
        middleware: [createPlatformGovernanceMiddleware(), ...(input.middleware ?? [])],
        signal: input.signal,
        metadata: {
          ...input.metadata,
          runQueue: {
            maxConcurrentRuns: this.runQueue.snapshot.maxConcurrentRuns,
            queued: lease.queued,
            acquiredAt: lease.acquiredAt
          }
        },
        runtimeOptions: {
          ...input.runtimeOptions,
          provider: input.provider,
          budgetPolicy: input.runSpec.budgetPolicy,
          observationPolicy: input.runSpec.observationPolicy
        }
      });

      await lease.release();
      return this.toAgentExecutionResult(output);
    } catch (error) {
      await lease.fail(error);
      throw error;
    }
  }

  async resumeHitl(input: AgentRuntimeHitlResumeInput): Promise<AgentExecutionResult> {
    await this.runQueue.requeueForResume(input.runSpec.runId);
    const lease = await this.acquireRunSlot(input.runSpec, input.signal);
    try {
      const output = await this.agentEngine.resumeHitl(input.sessionId, {
        runId: input.runSpec.runId,
        resolution: input.resolution,
        checkpointId: input.checkpointId,
        middleware: [createPlatformGovernanceMiddleware(), ...(input.middleware ?? [])],
        signal: input.signal,
        metadata: {
          ...input.metadata,
          runQueue: {
            maxConcurrentRuns: this.runQueue.snapshot.maxConcurrentRuns,
            queued: lease.queued,
            acquiredAt: lease.acquiredAt
          }
        },
        runtimeOptions: {
          ...input.runtimeOptions,
          provider: input.provider,
          budgetPolicy: input.runSpec.budgetPolicy,
          observationPolicy: input.runSpec.observationPolicy
        }
      });

      await lease.release();
      return this.toAgentExecutionResult(output);
    } catch (error) {
      await lease.fail(error);
      throw error;
    }
  }

  async *stream(input: AgentRuntimeRunInput): AsyncIterable<any> {
    const lease = await this.acquireRunSlot(input.runSpec, input.signal);
    let failed = false;
    try {
      yield* this.agentEngine.streamRuntimeChunks(
        input.runSpec,
        {
          ...input.runtimeOptions,
          provider: input.provider,
          budgetPolicy: input.runSpec.budgetPolicy,
          observationPolicy: input.runSpec.observationPolicy
        },
        {
          middleware: [createPlatformGovernanceMiddleware(), ...(input.middleware ?? [])],
          signal: input.signal,
          metadata: {
            ...input.metadata,
            runQueue: {
              maxConcurrentRuns: this.runQueue.snapshot.maxConcurrentRuns,
              queued: lease.queued,
              acquiredAt: lease.acquiredAt
            }
          }
        }
      );
    } catch (error) {
      failed = true;
      await lease.fail(error);
      throw error;
    } finally {
      if (!failed) {
        const session = await this.agentEngine.getSessionByRunId(input.runSpec.runId);
        if (session?.status === 'paused') {
          await lease.suspend();
        } else {
          await lease.release();
        }
      }
    }
  }

  private async acquireRunSlot(
    runSpec: AgentRunSpec,
    signal?: AbortSignal
  ): Promise<AgentRunQueueLease> {
    try {
      return await this.runQueue.acquire(runSpec, signal);
    } catch (error) {
      if (this.isCancellationError(error, signal)) {
        await this.agentEngine.cancelRun(runSpec.runId, this.getAbortReason(signal));
      }
      throw error;
    }
  }

  private isCancellationError(error: unknown, signal?: AbortSignal): boolean {
    if (signal?.aborted) return true;
    if (!error || typeof error !== 'object') return false;
    const record = error as { name?: unknown; code?: unknown; message?: unknown };
    return (
      record.name === 'AbortError' ||
      record.code === 'ABORT_ERR' ||
      String(record.message || '').toLowerCase().includes('abort')
    );
  }

  private getAbortReason(signal?: AbortSignal): 'manual' | 'client_disconnect' | 'timeout' | 'system' {
    const reason = signal?.reason;
    if (reason === 'client_disconnect' || reason === 'timeout' || reason === 'system') return reason;
    return 'manual';
  }

  private toAgentExecutionResult(output: {
    content: string;
    toolCalls?: unknown[];
    data?: unknown;
    usage?: unknown;
    stopReason?: string;
    trace?: unknown;
  }): AgentExecutionResult {
    return {
      content: output.content,
      toolCalls: output.toolCalls as AgentExecutionResult['toolCalls'],
      data: output.data,
      usage: output.usage,
      stopReason: output.stopReason as AgentExecutionResult['stopReason'],
      trace: output.trace as AgentExecutionResult['trace']
    };
  }
}