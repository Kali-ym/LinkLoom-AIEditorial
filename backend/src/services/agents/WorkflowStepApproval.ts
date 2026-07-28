import { ToolRegistry } from '../../registries/ToolRegistry.js';
import type { WorkflowStep } from '../../types/agent.js';
import {
  createPlatformPermissionPolicy,
  normalizePermissionSubject,
  previewPermissionEffect
} from './engine/PermissionEngine.js';
import type { PermissionEffect } from './engine/PermissionPolicy.js';
import { deepClone } from './workflowExpressions.js';

export interface WorkflowRunCheckpoint {
  stepResults: Record<string, unknown>;
  date?: string;
  runtimeOptions?: Record<string, unknown>;
  completedStepIds: string[];
}

export interface WorkflowStepPendingApproval {
  permissionId: string;
  workflowRunId: string;
  /** 当前执行审批步骤所在的工作流（子工作流时为内层 id） */
  workflowId: string;
  workflowName?: string;
  stepId: string;
  stepDisplayName?: string;
  /** 编排层父步骤（子工作流审批时指向 report 等容器步骤） */
  hostWorkflowId?: string;
  hostStepId?: string;
  hostCheckpoint?: WorkflowRunCheckpoint;
  toolId: string;
  toolName: string;
  reason?: string;
  requestedAt: string;
  checkpoint: WorkflowRunCheckpoint;
  toolInput: Record<string, unknown>;
}

export class WorkflowStepApprovalRequired extends Error {
  readonly approval: WorkflowStepPendingApproval;

  constructor(approval: WorkflowStepPendingApproval) {
    super(`Workflow step requires approval: ${approval.toolName}`);
    this.name = 'WorkflowStepApprovalRequired';
    this.approval = approval;
  }
}

export function previewWorkflowToolPermission(toolId: string): {
  effect: PermissionEffect;
  reason?: string;
} {
  const policy = createPlatformPermissionPolicy();
  const preview = previewPermissionEffect(
    policy,
    normalizePermissionSubject({ toolName: toolId })
  );
  return {
    effect: preview.decision.effect,
    reason: preview.decision.reason
  };
}

export function shouldGateWorkflowTool(
  toolId: string,
  runtimeOptions?: Record<string, unknown>
): boolean {
  if (isWorkflowApprovalSkipped(runtimeOptions)) return false;
  if (toolId === 'human-approval') return true;
  return previewWorkflowToolPermission(toolId).effect === 'ask';
}

export function isWorkflowApprovalSkipped(runtimeOptions?: Record<string, unknown>): boolean {
  return runtimeOptions?.skipWorkflowApproval === true;
}

/** 工作流运行默认授予工具权限；显式传 skipWorkflowApproval: false 可恢复审批门槛。 */
export function mergeWorkflowRuntimeOptions(
  runtimeOptions?: Record<string, unknown>
): Record<string, unknown> {
  return {
    skipWorkflowApproval: true,
    ...(runtimeOptions ?? {})
  };
}

export function buildWorkflowStepApproval(params: {
  workflowRunId: string;
  workflowId: string;
  workflowName?: string;
  step: WorkflowStep;
  toolId: string;
  toolInput: Record<string, unknown>;
  stepResults: Record<string, unknown>;
  date?: string;
  runtimeOptions?: Record<string, unknown>;
}): WorkflowStepPendingApproval {
  const preview = previewWorkflowToolPermission(params.toolId);
  const tool = ToolRegistry.getInstance().getTool(params.toolId);
  const completedStepIds = Object.keys(params.stepResults).filter(
    (key) => key !== 'start' && key !== '__context'
  );
  const runtime = params.runtimeOptions ?? {};
  const hostStepId =
    typeof runtime.parentWorkflowStepId === 'string' ? runtime.parentWorkflowStepId : undefined;
  const hostWorkflowId =
    typeof runtime.parentWorkflowId === 'string' ? runtime.parentWorkflowId : undefined;
  const parentSnapshot = runtime.parentStepResultsSnapshot;
  const hostCheckpoint =
    hostStepId && parentSnapshot && typeof parentSnapshot === 'object'
      ? {
          stepResults: deepClone(parentSnapshot as Record<string, unknown>),
          date: typeof runtime.parentDate === 'string' ? runtime.parentDate : params.date,
          runtimeOptions: params.runtimeOptions ? deepClone(params.runtimeOptions) : undefined,
          completedStepIds: Object.keys(parentSnapshot as Record<string, unknown>).filter(
            (key) => key !== 'start' && key !== '__context'
          )
        }
      : undefined;

  return {
    permissionId: createWorkflowPermissionId(params.workflowRunId, params.step.id),
    workflowRunId: params.workflowRunId,
    workflowId: params.workflowId,
    workflowName: params.workflowName,
    hostWorkflowId:
      hostWorkflowId && hostWorkflowId !== params.workflowId ? hostWorkflowId : undefined,
    hostStepId,
    hostCheckpoint,
    stepId: params.step.id,
    stepDisplayName: params.step.displayName,
    toolId: params.toolId,
    toolName: tool?.displayName || tool?.name || params.toolId,
    reason:
      (typeof params.toolInput.reason === 'string' && params.toolInput.reason) ||
      preview.reason,
    requestedAt: new Date().toISOString(),
    checkpoint: {
      stepResults: deepClone(params.stepResults),
      date: params.date,
      runtimeOptions: params.runtimeOptions ? deepClone(params.runtimeOptions) : undefined,
      completedStepIds
    },
    toolInput: deepClone(params.toolInput)
  };
}

function createWorkflowPermissionId(workflowRunId: string, stepId: string): string {
  return `wfperm_${workflowRunId}_${stepId}_${Date.now().toString(36)}`;
}
