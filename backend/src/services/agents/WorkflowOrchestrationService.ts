import type { WorkflowProgressPayload } from './WorkflowEngine.js';
import type { WorkflowEngine } from './WorkflowEngine.js';
import { WorkflowStepApprovalRequired } from './WorkflowStepApproval.js';
import type { LocalStore } from '../LocalStore.js';
import { LogService } from '../LogService.js';
import type { WorkflowRunSource } from './WorkflowRun.js';
import {
  buildWorkflowRunSteps,
  type WorkflowRunRegistry
} from './WorkflowRunRegistry.js';

export interface WorkflowOrchestrationRunParams {
  workflowId: string;
  input: unknown;
  date?: string;
  source: WorkflowRunSource;
  scheduleId?: string;
  timeoutMs?: number;
  onProgress?: (payload: WorkflowProgressPayload) => void;
  runtimeOptions?: Record<string, unknown>;
}

export class WorkflowOrchestrationService {
  private readonly progressChains = new Map<string, Promise<void>>();

  constructor(
    private readonly store: LocalStore,
    private readonly workflowEngine: WorkflowEngine,
    private readonly registry: WorkflowRunRegistry
  ) {}

  async run(params: WorkflowOrchestrationRunParams): Promise<unknown> {
    const workflow = await this.store.getWorkflow(params.workflowId);
    if (!workflow) throw new Error(`Workflow ${params.workflowId} not found`);

    const workflowRun = await this.registry.create({
      workflowId: params.workflowId,
      workflowName: workflow.name,
      source: params.source,
      scheduleId: params.scheduleId,
      date: params.date,
      steps: buildWorkflowRunSteps(workflow),
      metadata: {
        inputPreview: summarizeInput(params.input)
      }
    });

    const startedAt = Date.now();
    try {
      const result = await this.runWithTimeout(
        () =>
          this.workflowEngine.runWorkflow(params.workflowId, params.input, params.date, {
            onProgress: (payload) => {
              this.scheduleProgress(workflowRun.workflowRunId, payload);
              params.onProgress?.(payload);
            },
            runtimeOptions: {
              ...(params.runtimeOptions ?? {}),
              workflowRunId: workflowRun.workflowRunId,
              workflowId: params.workflowId
            }
          }),
        params.timeoutMs
      );

      await this.flushProgress(workflowRun.workflowRunId);
      await this.registry.update(workflowRun.workflowRunId, {
        status: 'succeeded',
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt
      });
      return result;
    } catch (error) {
      if (error instanceof WorkflowStepApprovalRequired) {
        const approval = error.approval;
        const current = await this.registry.get(workflowRun.workflowRunId);
        const steps = [...(current?.steps ?? workflowRun.steps)];
        const trackStepId = approval.hostStepId ?? approval.stepId;
        const stepIndex = steps.findIndex((step) => step.stepId === trackStepId);
        if (stepIndex >= 0) {
          steps[stepIndex] = {
            ...steps[stepIndex],
            status: 'running',
            error: '等待人工审批'
          };
        }
        await this.registry.update(workflowRun.workflowRunId, {
          status: 'paused',
          pendingStepApproval: approval,
          steps,
          error: `步骤 ${approval.stepDisplayName || approval.stepId} 等待审批：${approval.toolName}`
        });
        return {
          status: 'paused',
          workflowRunId: workflowRun.workflowRunId,
          pendingApproval: approval
        };
      }

      const message = error instanceof Error ? error.message : String(error);
      const status = message.includes('timed out') ? 'timeout' : 'failed';
      await this.flushProgress(workflowRun.workflowRunId);
      const current = await this.registry.get(workflowRun.workflowRunId);
      await this.registry.update(workflowRun.workflowRunId, {
        status,
        error: message,
        failedStepId: current?.failedStepId,
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt
      });
      throw error;
    }
  }

  private scheduleProgress(workflowRunId: string, payload: WorkflowProgressPayload): void {
    const previous = this.progressChains.get(workflowRunId) ?? Promise.resolve();
    const next = previous
      .then(() => this.applyProgress(workflowRunId, payload))
      .catch((error) => {
        LogService.warn(
          `Workflow progress update failed for ${workflowRunId}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      });
    this.progressChains.set(workflowRunId, next);
    void next.finally(() => {
      if (this.progressChains.get(workflowRunId) === next) {
        this.progressChains.delete(workflowRunId);
      }
    });
  }

  private async applyProgress(workflowRunId: string, payload: WorkflowProgressPayload): Promise<void> {
    const run = await this.registry.get(workflowRunId);
    if (!run) return;

    const steps = [...run.steps];
    const touch = (stepId: string, patch: Partial<(typeof steps)[number]>) => {
      const index = steps.findIndex((step) => step.stepId === stepId);
      if (index < 0) return;
      steps[index] = { ...steps[index], ...patch };
    };

    if (payload.type === 'step_start' && payload.stepId) {
      touch(payload.stepId, {
        status: 'running',
        displayName: typeof payload.displayName === 'string' ? payload.displayName : undefined,
        agentId: typeof payload.agentId === 'string' ? payload.agentId : undefined,
        startedAt: new Date().toISOString()
      });
    } else if (payload.type === 'step_done' && payload.stepId) {
      const success = payload.success === true;
      touch(payload.stepId, {
        status: success ? 'succeeded' : 'failed',
        error: typeof payload.error === 'string' ? payload.error : undefined,
        finishedAt: new Date().toISOString()
      });
      await this.registry.update(workflowRunId, {
        steps,
        failedStepId: success ? run.failedStepId : payload.stepId,
        error: success ? run.error : String(payload.error || 'step failed')
      });
      return;
    } else {
      return;
    }

    await this.registry.update(workflowRunId, { steps });
  }

  async resumeAfterApproval(
    workflowRunId: string,
    approvedOutput: unknown
  ): Promise<unknown> {
    const run = await this.registry.get(workflowRunId);
    if (!run?.pendingStepApproval) {
      throw new Error(`Workflow run ${workflowRunId} has no pending step approval`);
    }

    const approval = run.pendingStepApproval;
    const startedAt = Date.now();
    await this.registry.update(workflowRunId, {
      status: 'running',
      pendingStepApproval: undefined,
      error: undefined
    });

    const steps = [...run.steps];
    const trackStepId = approval.hostStepId ?? approval.stepId;
    const stepIndex = steps.findIndex((step) => step.stepId === trackStepId);
    if (stepIndex >= 0) {
      steps[stepIndex] = {
        ...steps[stepIndex],
        status: 'succeeded',
        finishedAt: new Date().toISOString(),
        error: undefined
      };
    }
    await this.registry.update(workflowRunId, { steps });

    try {
      const progress = (payload: WorkflowProgressPayload) =>
        this.scheduleProgress(workflowRunId, payload);
      const resumeOptions = {
        onProgress: progress,
        runtimeOptions: {
          ...(approval.checkpoint.runtimeOptions ?? {}),
          workflowRunId,
          workflowId: run.workflowId
        }
      };

      let result: unknown;
      if (approval.hostCheckpoint && approval.hostStepId) {
        const innerResult = await this.workflowEngine.continueFromCheckpoint(
          approval.workflowId,
          approval.checkpoint,
          approval.stepId,
          approvedOutput,
          resumeOptions
        );
        result = await this.workflowEngine.continueFromCheckpoint(
          run.workflowId,
          approval.hostCheckpoint,
          approval.hostStepId,
          innerResult,
          resumeOptions
        );
      } else {
        result = await this.workflowEngine.continueFromCheckpoint(
          run.workflowId,
          approval.checkpoint,
          approval.stepId,
          approvedOutput,
          resumeOptions
        );
      }

      await this.flushProgress(workflowRunId);
      await this.registry.update(workflowRunId, {
        status: 'succeeded',
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - new Date(run.createdAt).getTime(),
        pendingStepApproval: undefined
      });
      return result;
    } catch (error) {
      if (error instanceof WorkflowStepApprovalRequired) {
        const nextApproval = error.approval;
        await this.registry.update(workflowRunId, {
          status: 'paused',
          pendingStepApproval: nextApproval,
          error: `步骤 ${nextApproval.stepDisplayName || nextApproval.stepId} 等待审批：${nextApproval.toolName}`
        });
        return { status: 'paused', workflowRunId, pendingApproval: nextApproval };
      }

      const message = error instanceof Error ? error.message : String(error);
      await this.flushProgress(workflowRunId);
      const current = await this.registry.get(workflowRunId);
      await this.registry.update(workflowRunId, {
        status: 'failed',
        error: message,
        failedStepId: current?.failedStepId ?? approval.stepId,
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt
      });
      throw error;
    }
  }

  private async flushProgress(workflowRunId: string): Promise<void> {
    await (this.progressChains.get(workflowRunId) ?? Promise.resolve());
  }

  private async runWithTimeout<T>(task: () => Promise<T>, timeoutMs?: number): Promise<T> {
    if (!timeoutMs || timeoutMs <= 0) return task();

    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`Workflow run timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      return await Promise.race([task(), timeoutPromise]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

function summarizeInput(input: unknown): string | undefined {
  if (input == null) return undefined;
  if (typeof input === 'string') return input.slice(0, 200);
  try {
    return JSON.stringify(input).slice(0, 200);
  } catch {
    return undefined;
  }
}
