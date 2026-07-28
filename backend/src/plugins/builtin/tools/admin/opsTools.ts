import {
  requireToolContext,
  type ToolExecutionContext,
} from '../../../../services/ToolExecutionContext.js';
import { AgentGovernanceService } from '../../../../services/agents/AgentGovernanceService.js';
import { NewsPipelineService } from '../../../../services/agents/NewsPipelineService.js';
import { PlatformPipelineService } from '../../../../services/agents/PlatformPipelineService.js';
import { AgentRunService } from '../../../../services/api/AgentRunService.js';
import { WorkflowRunService } from '../../../../services/api/WorkflowRunService.js';
import type { WorkflowRun } from '../../../../services/agents/WorkflowRun.js';
import { BaseTool } from '../../../base/BaseTool.js';

function extractEditorialPlan(run: WorkflowRun): unknown | undefined {
  const plan = run.metadata?.editorialPlan;
  return plan === undefined ? undefined : plan;
}

function buildWorkflowRunPayload(run: WorkflowRun): Record<string, unknown> {
  const editorialPlan = extractEditorialPlan(run);
  return editorialPlan === undefined ? { ok: true, run } : { ok: true, run, editorialPlan };
}

class GetWorkflowRunTool extends BaseTool {
  readonly id = 'get_workflow_run';
  readonly name = 'get_workflow_run';
  readonly displayName = '查工作流运行';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    '查询单次工作流运行详情(步骤/状态/待审批等)。必填 runId。若 metadata 含 editorialPlan 则一并返回。';
  readonly parameters = {
    type: 'object',
    properties: { runId: { type: 'string', description: '工作流运行 id' } },
    required: ['runId'],
  };

  async handler(args: { runId: string }, toolCtx?: ToolExecutionContext) {
    const { store, services } = requireToolContext(toolCtx, this.id);
    try {
      const service = new WorkflowRunService(store, services);
      const run = await service.getWorkflowRun(args.runId);
      return buildWorkflowRunPayload(run);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      const notFound = message.includes('not found');
      return {
        ok: false,
        errorCode: notFound ? 'NOT_FOUND' : 'GET_WORKFLOW_RUN_FAILED',
        message,
        hint: '调 list_workflow_runs 查看可用运行',
      };
    }
  }
}

class ListPendingApprovalsTool extends BaseTool {
  readonly id = 'list_pending_approvals';
  readonly name = 'list_pending_approvals';
  readonly displayName = '列待审批步骤';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    '列出所有待人工审批的工作流步骤(含 runId/stepId/toolName)。用户要处理审批或查看待办时调用。';
  readonly parameters = { type: 'object', properties: {} };

  async handler(_args: Record<string, never>, toolCtx?: ToolExecutionContext) {
    const { store, services } = requireToolContext(toolCtx, this.id);
    try {
      const service = new WorkflowRunService(store, services);
      const items = await service.listPendingWorkflowApprovals();
      return { ok: true, count: items.length, items };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        errorCode: 'LIST_PENDING_APPROVALS_FAILED',
        message,
        hint: '可在 /ops 页面查看待审批',
      };
    }
  }
}

class GetPlatformStatusTool extends BaseTool {
  readonly id = 'get_platform_status';
  readonly name = 'get_platform_status';
  readonly displayName = '查平台管线状态';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    '查询新闻生产管线与平台 digest 管线的健康状态。用户问管线/平台运维概况时调用。';
  readonly parameters = { type: 'object', properties: {} };

  async handler(_args: Record<string, never>, toolCtx?: ToolExecutionContext) {
    const { store, services } = requireToolContext(toolCtx, this.id);
    try {
      const newsPipeline = new NewsPipelineService(store, services);
      const platformPipelines = new PlatformPipelineService(store, services);
      const [newsPipelineStatus, platformPipelinesStatus] = await Promise.all([
        newsPipeline.getStatus(),
        platformPipelines.getStatus(),
      ]);
      return {
        ok: true,
        newsPipeline: newsPipelineStatus,
        platformPipelines: platformPipelinesStatus,
      };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        errorCode: 'GET_PLATFORM_STATUS_FAILED',
        message,
        hint: '可在 /ops 页面查看管线状态',
      };
    }
  }
}

class GetGovernanceStatusTool extends BaseTool {
  readonly id = 'get_governance_status';
  readonly name = 'get_governance_status';
  readonly displayName = '查 Agent 治理状态';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description = '查询 Agent 治理/权限策略状态。用户问治理、权限矩阵概况时调用。';
  readonly parameters = { type: 'object', properties: {} };

  async handler(_args: Record<string, never>, toolCtx?: ToolExecutionContext) {
    const { store, services } = requireToolContext(toolCtx, this.id);
    try {
      const governance = new AgentGovernanceService(store, services);
      const status = await governance.getStatus();
      return { ok: true, governance: status };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        errorCode: 'GET_GOVERNANCE_STATUS_FAILED',
        message,
        hint: '可在 /ops 页面查看治理状态',
      };
    }
  }
}

class GetAgentMetricsTool extends BaseTool {
  readonly id = 'get_agent_metrics';
  readonly name = 'get_agent_metrics';
  readonly displayName = '查 Agent 可观测指标';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    '查询 Agent 运行可观测指标(会话/工具调用/延迟等)。用户问运维指标或 agent 健康时调用。';
  readonly parameters = { type: 'object', properties: {} };

  async handler(_args: Record<string, never>, toolCtx?: ToolExecutionContext) {
    const { store, services } = requireToolContext(toolCtx, this.id);
    try {
      const agentRunService = new AgentRunService(store, services);
      const metrics = await agentRunService.getObservabilityMetrics();
      return { ok: true, metrics };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        errorCode: 'GET_AGENT_METRICS_FAILED',
        message,
        hint: '可在 /ops 页面查看 Agent 指标',
      };
    }
  }
}

export const opsTools: BaseTool[] = [
  new GetWorkflowRunTool(),
  new ListPendingApprovalsTool(),
  new GetPlatformStatusTool(),
  new GetGovernanceStatusTool(),
  new GetAgentMetricsTool(),
];
