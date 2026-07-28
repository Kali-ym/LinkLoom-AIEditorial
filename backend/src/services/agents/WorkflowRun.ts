import type { WorkflowStepPendingApproval } from './WorkflowStepApproval.js';

export type WorkflowRunSource = 'manual' | 'scheduler' | 'api';

export type WorkflowRunStatus =
  | 'queued'
  | 'running'
  | 'paused'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'timeout';

export type WorkflowRunStepStatus =
  | 'pending'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'skipped';

export interface WorkflowRunStepRecord {
  stepId: string;
  displayName?: string;
  agentId?: string;
  stepType?: string;
  nextStepIds?: string[];
  status: WorkflowRunStepStatus;
  error?: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface WorkflowRun {
  workflowRunId: string;
  workflowId: string;
  workflowName?: string;
  source: WorkflowRunSource;
  scheduleId?: string;
  status: WorkflowRunStatus;
  date?: string;
  createdAt: string;
  updatedAt: string;
  finishedAt?: string;
  durationMs?: number;
  error?: string;
  failedStepId?: string;
  steps: WorkflowRunStepRecord[];
  pendingStepApproval?: WorkflowStepPendingApproval;
  metadata?: Record<string, unknown>;
}

export interface WorkflowRunFilter {
  workflowId?: string;
  source?: WorkflowRunSource;
  status?: WorkflowRunStatus | WorkflowRunStatus[];
  scheduleId?: string;
}

export interface WorkflowRunPage {
  items: WorkflowRun[];
  total: number;
  offset: number;
  limit: number;
}
