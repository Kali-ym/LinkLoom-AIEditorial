import type { WorkflowDefinition } from '../../types/agent.js';
import type { LocalStore } from '../LocalStore.js';
import type {
  WorkflowRun,
  WorkflowRunFilter,
  WorkflowRunPage,
  WorkflowRunSource,
  WorkflowRunStatus,
  WorkflowRunStepRecord
} from './WorkflowRun.js';

export interface WorkflowRunRegistry {
  create(params: {
    workflowId: string;
    workflowName?: string;
    source: WorkflowRunSource;
    scheduleId?: string;
    date?: string;
    steps: WorkflowRunStepRecord[];
    metadata?: Record<string, unknown>;
  }): Promise<WorkflowRun>;
  update(workflowRunId: string, patch: Partial<WorkflowRun>): Promise<void>;
  get(workflowRunId: string): Promise<WorkflowRun | null>;
  list(filter?: WorkflowRunFilter, offset?: number, limit?: number): Promise<WorkflowRunPage>;
}

export class LocalStoreWorkflowRunRegistry implements WorkflowRunRegistry {
  private readonly keyPrefix = 'workflow_run:';
  private readonly indexKey = 'workflow_run_index';

  constructor(private readonly store: LocalStore) {}

  async create(params: {
    workflowId: string;
    workflowName?: string;
    source: WorkflowRunSource;
    scheduleId?: string;
    date?: string;
    steps: WorkflowRunStepRecord[];
    metadata?: Record<string, unknown>;
  }): Promise<WorkflowRun> {
    const now = new Date().toISOString();
    const run: WorkflowRun = {
      workflowRunId: createWorkflowRunId(params.workflowId),
      workflowId: params.workflowId,
      workflowName: params.workflowName,
      source: params.source,
      scheduleId: params.scheduleId,
      status: 'running',
      date: params.date,
      createdAt: now,
      updatedAt: now,
      steps: params.steps,
      metadata: params.metadata
    };
    await this.persist(run);
    return { ...run };
  }

  async update(workflowRunId: string, patch: Partial<WorkflowRun>): Promise<void> {
    const existing = await this.get(workflowRunId);
    if (!existing) return;
    const next = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    await this.persist(next);
  }

  async get(workflowRunId: string): Promise<WorkflowRun | null> {
    const stored = await this.store.get(this.key(workflowRunId));
    return stored ? (stored as WorkflowRun) : null;
  }

  async list(filter?: WorkflowRunFilter, offset = 0, limit = 50): Promise<WorkflowRunPage> {
    await this.reconcileStaleRuns();
    const index = await this.getIndex();
    const items: WorkflowRun[] = [];
    for (const workflowRunId of index) {
      const run = await this.get(workflowRunId);
      if (run) items.push(run);
    }
    const filtered = applyFilter(items, filter).sort(compareWorkflowRuns);
    return {
      items: filtered.slice(offset, offset + limit),
      total: filtered.length,
      offset,
      limit
    };
  }

  private async reconcileStaleRuns(staleAfterMs = 45 * 60 * 1000): Promise<void> {
    const now = Date.now();
    const index = await this.getIndex();
    for (const workflowRunId of index) {
      const run = await this.get(workflowRunId);
      if (!run) continue;
      if (run.status !== 'running' && run.status !== 'queued') continue;
      const lastTouch = new Date(run.updatedAt || run.createdAt).getTime();
      if (now - lastTouch <= staleAfterMs) continue;
      const unfinished = run.steps.filter((step) => step.status === 'pending' || step.status === 'running');
      const steps = run.steps.map((step) =>
        step.status === 'pending' || step.status === 'running'
          ? ({
              ...step,
              status: 'failed' as const,
              error: step.error || '运行超时',
              finishedAt: new Date().toISOString()
            } as WorkflowRunStepRecord)
          : step
      );
      await this.update(workflowRunId, {
        status: 'timeout',
        steps,
        failedStepId: run.failedStepId || unfinished[0]?.stepId,
        error: run.error || '运行超时或未正常结束，已自动标记为 timeout',
        finishedAt: new Date().toISOString(),
        durationMs: now - new Date(run.createdAt).getTime()
      });
    }
  }

  private async persist(run: WorkflowRun): Promise<void> {
    await this.store.put(this.key(run.workflowRunId), run);
    await this.appendToIndex(run.workflowRunId);
  }

  private async getIndex(): Promise<string[]> {
    const index = await this.store.get(this.indexKey);
    return Array.isArray(index) ? index.filter((item): item is string => typeof item === 'string') : [];
  }

  private async appendToIndex(workflowRunId: string): Promise<void> {
    const index = await this.getIndex();
    if (index.includes(workflowRunId)) return;
    await this.store.put(this.indexKey, [...index, workflowRunId]);
  }

  private key(workflowRunId: string): string {
    return `${this.keyPrefix}${workflowRunId}`;
  }
}

export function buildWorkflowRunSteps(workflow: WorkflowDefinition): WorkflowRunStepRecord[] {
  return workflow.steps.map((step) => ({
    stepId: step.id,
    displayName: step.displayName || step.id,
    agentId: step.agentId,
    stepType: step.type || (step.toolId ? 'tool' : step.workflowId ? 'workflow' : 'agent'),
    nextStepIds: step.nextStepIds?.length ? [...step.nextStepIds] : undefined,
    status: 'pending'
  }));
}

function createWorkflowRunId(workflowId: string): string {
  return `wfr_${workflowId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function isActiveWorkflowRun(status: WorkflowRunStatus): boolean {
  return status === 'running' || status === 'paused' || status === 'queued';
}

function compareWorkflowRuns(a: WorkflowRun, b: WorkflowRun): number {
  const aActive = isActiveWorkflowRun(a.status);
  const bActive = isActiveWorkflowRun(b.status);
  if (aActive !== bActive) return aActive ? -1 : 1;
  if (aActive) {
    return a.createdAt.localeCompare(b.createdAt);
  }
  const aEnded = a.finishedAt || a.updatedAt || a.createdAt;
  const bEnded = b.finishedAt || b.updatedAt || b.createdAt;
  const byEnded = bEnded.localeCompare(aEnded);
  if (byEnded !== 0) return byEnded;
  return b.createdAt.localeCompare(a.createdAt);
}

function applyFilter(items: WorkflowRun[], filter?: WorkflowRunFilter): WorkflowRun[] {
  if (!filter) return items;
  return items.filter((run) => {
    if (filter.workflowId && run.workflowId !== filter.workflowId) return false;
    if (filter.scheduleId && run.scheduleId !== filter.scheduleId) return false;
    if (filter.source && run.source !== filter.source) return false;
    if (filter.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      if (!statuses.includes(run.status)) return false;
    }
    return true;
  });
}
