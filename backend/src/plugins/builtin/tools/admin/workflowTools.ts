import {
  requireToolContext,
  type ToolExecutionContext,
} from '../../../../services/ToolExecutionContext.js';
import type { ToolExecutionPolicy } from '../../../../types/agent.js';
import { WorkflowRunService } from '../../../../services/api/WorkflowRunService.js';
import type { WorkflowStepPendingApproval } from '../../../../services/agents/WorkflowStepApproval.js';
import { BaseTool } from '../../../base/BaseTool.js';

const MEDIUM: ToolExecutionPolicy = { readonly: false, riskLevel: 'medium' };

function extractRunMeta(result: unknown): { runId?: string; status: string } {
  if (!result || typeof result !== 'object') {
    return { status: 'succeeded' };
  }
  const record = result as Record<string, unknown>;
  if (typeof record.workflowRunId === 'string') {
    return { runId: record.workflowRunId, status: String(record.status ?? 'running') };
  }
  if (typeof record.runId === 'string') {
    return { runId: record.runId, status: String(record.status ?? 'running') };
  }
  return { status: 'succeeded' };
}

function matchesPendingStep(approval: WorkflowStepPendingApproval, stepId: string): boolean {
  return approval.stepId === stepId || approval.hostStepId === stepId;
}

class RunWorkflowTool extends BaseTool {
  readonly id = 'run_workflow';
  readonly name = 'run_workflow';
  readonly displayName = '运行工作流';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly execution = MEDIUM;
  readonly description =
    '运行指定工作流。必填 workflowId;可选 input(工作流输入对象,多数默认 {} 即可)。' +
    '运行前应先调 list_workflows 让用户确认 workflowId。返回 runId,异步执行,进度可调 list_workflow_runs。';
  readonly parameters = {
    type: 'object',
    properties: {
      workflowId: { type: 'string', description: '要运行的工作流 id' },
      input: { type: 'object', description: '工作流输入参数(可选,默认 {})', additionalProperties: true },
    },
    required: ['workflowId'],
  };

  async handler(
    args: { workflowId: string; input?: Record<string, unknown> },
    toolCtx?: ToolExecutionContext,
  ) {
    const { services } = requireToolContext(toolCtx, this.id);
    try {
      const orchestration = services.workflowOrchestrationService;
      if (!orchestration) {
        return {
          ok: false,
          errorCode: 'SERVICE_UNAVAILABLE',
          message: '工作流引擎未初始化',
          hint: '可在 /ops 查看运行记录',
        };
      }
      const result = await orchestration.run({
        workflowId: args.workflowId,
        input: args.input ?? {},
        source: 'api',
      });
      const meta = extractRunMeta(result);
      return {
        ok: true,
        workflowId: args.workflowId,
        runId: meta.runId,
        status: meta.status,
        result,
      };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, errorCode: 'RUN_WORKFLOW_FAILED', message, hint: '可在 /ops 查看运行记录' };
    }
  }
}

class TriggerScoringTool extends BaseTool {
  readonly id = 'trigger_scoring';
  readonly name = 'trigger_scoring';
  readonly displayName = '触发新闻评分';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly execution = MEDIUM;
  readonly description =
    '触发新闻评分管线(feed_scoring_pipeline_workflow),对未评分素材(ai_scored_at 为空)批量评分。' +
    '调用前应先调 list_unevaluated_news 确认未评分条数并告知用户。无需参数。返回 runId。';
  readonly parameters = { type: 'object', properties: {} };

  async handler(_args: Record<string, never>, toolCtx?: ToolExecutionContext) {
    const { services } = requireToolContext(toolCtx, this.id);
    try {
      const orchestration = services.workflowOrchestrationService;
      if (!orchestration) {
        return { ok: false, errorCode: 'SERVICE_UNAVAILABLE', message: '工作流引擎未初始化' };
      }
      const workflowId = 'feed_scoring_pipeline_workflow';
      const result = await orchestration.run({
        workflowId,
        input: {},
        source: 'api',
      });
      const meta = extractRunMeta(result);
      return {
        ok: true,
        workflowId,
        runId: meta.runId,
        status: meta.status,
        hint: '进度可调 list_workflow_runs,结果在 /selection 查看',
      };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, errorCode: 'TRIGGER_SCORING_FAILED', message };
    }
  }
}

class DecideWorkflowStepTool extends BaseTool {
  readonly id = 'decide_workflow_step';
  readonly name = 'decide_workflow_step';
  readonly displayName = '审批工作流步骤';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly execution = MEDIUM;
  readonly description =
    '审批或拒绝一个工作流的待审批步骤。必填 runId/stepId/decision(approve|reject);可选 comment。' +
    '调用前应先调 list_workflow_runs(status=awaiting_approval) 让用户选 runId 与 stepId。';
  readonly parameters = {
    type: 'object',
    properties: {
      runId: { type: 'string', description: '工作流运行 id' },
      stepId: { type: 'string', description: '待审批步骤 id' },
      decision: { type: 'string', enum: ['approve', 'reject'], description: 'approve=批准, reject=拒绝' },
      comment: { type: 'string', description: '审批意见(可选)' },
    },
    required: ['runId', 'stepId', 'decision'],
  };

  async handler(
    args: { runId: string; stepId: string; decision: 'approve' | 'reject'; comment?: string },
    toolCtx?: ToolExecutionContext,
  ) {
    const { store, services } = requireToolContext(toolCtx, this.id);
    try {
      const run = await services.workflowRunRegistry.get(args.runId);
      if (!run?.pendingStepApproval) {
        return {
          ok: false,
          errorCode: 'NO_PENDING_APPROVAL',
          message: `工作流运行 ${args.runId} 没有待审批步骤`,
          hint: '调 list_workflow_runs 查看待审批运行',
        };
      }
      if (!matchesPendingStep(run.pendingStepApproval, args.stepId)) {
        return {
          ok: false,
          errorCode: 'STEP_MISMATCH',
          message: `步骤 ${args.stepId} 与待审批步骤 ${run.pendingStepApproval.stepId} 不一致`,
        };
      }

      const workflowRunService = new WorkflowRunService(store, services);
      const permissionId = run.pendingStepApproval.permissionId;

      if (args.decision === 'approve') {
        const result = await workflowRunService.approveWorkflowStep(args.runId, permissionId, {
          reason: args.comment,
        });
        return {
          ok: true,
          runId: args.runId,
          stepId: args.stepId,
          decision: args.decision,
          result,
        };
      }

      const result = await workflowRunService.rejectWorkflowStep(args.runId, permissionId, {
        reason: args.comment,
      });
      return {
        ok: true,
        runId: args.runId,
        stepId: args.stepId,
        decision: args.decision,
        result,
      };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, errorCode: 'DECIDE_STEP_FAILED', message };
    }
  }
}

export const workflowTools: BaseTool[] = [
  new RunWorkflowTool(),
  new TriggerScoringTool(),
  new DecideWorkflowStepTool(),
];
