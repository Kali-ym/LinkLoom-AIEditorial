import { renderTemplate } from '../workflowExpressions.js';
import {
  buildWorkflowStepApproval,
  shouldGateWorkflowTool,
  WorkflowStepApprovalRequired
} from '../WorkflowStepApproval.js';
import type { WorkflowStepTypeDefinition } from './StepCatalog.js';
import type { StepExecutionContext, StepExecutor } from './StepRegistry.js';

interface HumanApprovalStepConfig {
  previewTemplate?: unknown;
  reason?: string;
  requireApproval?: boolean;
}

function resolveConfig(ctx: StepExecutionContext): HumanApprovalStepConfig {
  const config = ctx.step.config || {};
  return {
    previewTemplate: config.previewTemplate,
    reason: typeof config.reason === 'string' ? config.reason : undefined,
    requireApproval: config.requireApproval !== false
  };
}

function buildScope(ctx: StepExecutionContext): Record<string, unknown> {
  return {
    ...ctx.stepResults,
    input: ctx.resolvedInput,
    current: ctx.resolvedInput,
    __date: ctx.date,
    __runtimeOptions: ctx.runOptions?.runtimeOptions ?? {},
    __workflow: { id: ctx.workflow.id, name: ctx.workflow.name }
  };
}

export const humanApprovalStepExecutor: StepExecutor = async (ctx) => {
  const cfg = resolveConfig(ctx);
  const runtime = ctx.runOptions?.runtimeOptions ?? {};

  if (!cfg.requireApproval || !shouldGateWorkflowTool('human-approval', runtime)) {
    const scope = buildScope(ctx);
    const previewPayload =
      cfg.previewTemplate !== undefined
        ? renderTemplate(cfg.previewTemplate, scope)
        : ctx.resolvedInput;
    return {
      approved: true,
      skipped: true,
      previewPayload,
      input: ctx.resolvedInput
    };
  }

  const workflowRunId = runtime.workflowRunId as string | undefined;
  if (!workflowRunId) {
    throw new Error(`human-approval step ${ctx.step.id} requires workflowRunId in runtimeOptions`);
  }

  const scope = buildScope(ctx);
  const previewPayload =
    cfg.previewTemplate !== undefined
      ? renderTemplate(cfg.previewTemplate, scope)
      : ctx.resolvedInput;

  throw new WorkflowStepApprovalRequired(
    buildWorkflowStepApproval({
      workflowRunId,
      workflowId: ctx.workflow.id,
      workflowName: ctx.workflow.name,
      step: ctx.step,
      toolId: 'human-approval',
      toolInput: {
        previewPayload,
        reason: cfg.reason,
        input: ctx.resolvedInput
      },
      stepResults: ctx.stepResults,
      date: ctx.date,
      runtimeOptions: runtime
    })
  );
};

export const humanApprovalStepDefinition: WorkflowStepTypeDefinition = {
  type: 'human-approval',
  label: '人工审批',
  icon: 'verified_user',
  color: 'rose',
  category: 'pipeline',
  description: '暂停工作流等待人工确认；复用 WorkflowStepApproval checkpoint 恢复。',
  defaultConfig: {
    requireApproval: true,
    reason: '需要人工确认后继续'
  },
  configSchema: {
    fields: [
      {
        key: 'reason',
        label: '审批原因',
        type: 'string',
        required: false,
        default: '需要人工确认后继续',
        group: '审批'
      },
      {
        key: 'previewTemplate',
        label: '预览模板',
        type: 'json',
        required: false,
        description: '展示在审批工作台的摘要（JSON 模板）。',
        group: '审批'
      },
      {
        key: 'requireApproval',
        label: '启用门控',
        type: 'boolean',
        required: false,
        default: true,
        group: '审批'
      }
    ]
  },
  executor: humanApprovalStepExecutor
};
