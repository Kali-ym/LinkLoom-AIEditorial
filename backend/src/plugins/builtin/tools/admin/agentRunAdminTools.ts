import {
  requireToolContext,
  type ToolExecutionContext,
} from '../../../../services/ToolExecutionContext.js';
import type { ToolExecutionPolicy } from '../../../../types/agent.js';
import { AgentRunService } from '../../../../services/api/AgentRunService.js';
import { BaseTool } from '../../../base/BaseTool.js';

const MEDIUM: ToolExecutionPolicy = { readonly: false, riskLevel: 'medium' };
const HIGH: ToolExecutionPolicy = { readonly: false, riskLevel: 'high' };

function agentRunService(toolCtx: ToolExecutionContext | undefined, toolId: string) {
  const { store, services } = requireToolContext(toolCtx, toolId);
  return new AgentRunService(store, services);
}

class ListAgentRunsTool extends BaseTool {
  readonly id = 'list_agent_runs';
  readonly name = 'list_agent_runs';
  readonly displayName = '列 Agent 运行';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    '列出 Agent 运行记录（与 /ops runs 同源）。可选 agentId/status/source/search/limit/offset/page。';
  readonly parameters = {
    type: 'object',
    properties: {
      agentId: { type: 'string' },
      workflowId: { type: 'string' },
      status: { type: 'string', description: '状态或逗号分隔多状态' },
      source: { type: 'string' },
      search: { type: 'string' },
      pendingPermission: { type: 'boolean' },
      createdAfter: { type: 'string' },
      createdBefore: { type: 'string' },
      limit: { type: 'number' },
      offset: { type: 'number' },
      page: { type: 'number' },
    },
  };

  async handler(args: Record<string, unknown>, toolCtx?: ToolExecutionContext) {
    try {
      const service = agentRunService(toolCtx, this.id);
      const limit = Number(args.limit) > 0 ? Number(args.limit) : 50;
      const page = Number(args.page) > 0 ? Number(args.page) : 0;
      const offset =
        args.offset !== undefined
          ? Math.max(0, Number(args.offset) || 0)
          : Math.max(0, (page - 1) * limit);
      const filter: Record<string, unknown> = {};
      if (args.agentId) filter.agentId = String(args.agentId);
      if (args.workflowId) filter.workflowId = String(args.workflowId);
      if (args.status) filter.status = String(args.status).includes(',')
        ? String(args.status).split(',').map((s) => s.trim())
        : String(args.status);
      if (args.source) filter.source = String(args.source);
      if (args.search) filter.search = String(args.search);
      if (typeof args.pendingPermission === 'boolean') {
        filter.pendingPermission = args.pendingPermission;
      }
      if (args.createdAfter) filter.createdAfter = String(args.createdAfter);
      if (args.createdBefore) filter.createdBefore = String(args.createdBefore);
      const result = await service.listRuns(filter as any, undefined, offset, limit);
      return { ok: true, ...result };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, errorCode: 'LIST_AGENT_RUNS_FAILED', message };
    }
  }
}

class GetAgentRunTool extends BaseTool {
  readonly id = 'get_agent_run';
  readonly name = 'get_agent_run';
  readonly displayName = '查 Agent 运行';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description = '获取单次 Agent 运行详情。必填 runId。';
  readonly parameters = {
    type: 'object',
    properties: { runId: { type: 'string' } },
    required: ['runId'],
  };

  async handler(args: { runId?: string }, toolCtx?: ToolExecutionContext) {
    try {
      const service = agentRunService(toolCtx, this.id);
      const run = await service.getRun(String(args.runId || ''));
      return { ok: true, run };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, errorCode: 'GET_AGENT_RUN_FAILED', message };
    }
  }
}

class ListAgentRunMessagesTool extends BaseTool {
  readonly id = 'list_agent_run_messages';
  readonly name = 'list_agent_run_messages';
  readonly displayName = '列 Agent 运行消息';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description = '列出某次 Agent 运行的消息。必填 runId。';
  readonly parameters = {
    type: 'object',
    properties: { runId: { type: 'string' } },
    required: ['runId'],
  };

  async handler(args: { runId?: string }, toolCtx?: ToolExecutionContext) {
    try {
      const service = agentRunService(toolCtx, this.id);
      const messages = await service.getRunMessages(String(args.runId || ''));
      return { ok: true, messages };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, errorCode: 'LIST_AGENT_RUN_MESSAGES_FAILED', message };
    }
  }
}

class CancelAgentRunTool extends BaseTool {
  readonly id = 'cancel_agent_run';
  readonly name = 'cancel_agent_run';
  readonly displayName = '取消 Agent 运行';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly execution = MEDIUM;
  readonly description = '取消正在进行的 Agent 运行。必填 runId。';
  readonly parameters = {
    type: 'object',
    properties: { runId: { type: 'string' } },
    required: ['runId'],
  };

  async handler(args: { runId?: string }, toolCtx?: ToolExecutionContext) {
    try {
      const service = agentRunService(toolCtx, this.id);
      const result = await service.cancelRun(String(args.runId || ''));
      return { ok: true, ...result };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, errorCode: 'CANCEL_AGENT_RUN_FAILED', message };
    }
  }
}

class RetryAgentRunTool extends BaseTool {
  readonly id = 'retry_agent_run';
  readonly name = 'retry_agent_run';
  readonly displayName = '重试 Agent 运行';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly execution = MEDIUM;
  readonly description = '重试失败的 Agent 运行。必填 runId。';
  readonly parameters = {
    type: 'object',
    properties: { runId: { type: 'string' } },
    required: ['runId'],
  };

  async handler(args: { runId?: string }, toolCtx?: ToolExecutionContext) {
    try {
      const service = agentRunService(toolCtx, this.id);
      const result = await service.retryRun(String(args.runId || ''));
      return { ok: true, ...result };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, errorCode: 'RETRY_AGENT_RUN_FAILED', message };
    }
  }
}

class ListPendingAgentHitlTool extends BaseTool {
  readonly id = 'list_pending_agent_hitl';
  readonly name = 'list_pending_agent_hitl';
  readonly displayName = '列待处理 HITL';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description = '列出待处理的 Agent HITL 请求。';
  readonly parameters = { type: 'object', properties: {} };

  async handler(_args: Record<string, never>, toolCtx?: ToolExecutionContext) {
    try {
      const service = agentRunService(toolCtx, this.id);
      const items = await service.listPendingHitl();
      return { ok: true, count: items.length, items };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, errorCode: 'LIST_PENDING_HITL_FAILED', message };
    }
  }
}

class ListPendingAgentPermissionsTool extends BaseTool {
  readonly id = 'list_pending_agent_permissions';
  readonly name = 'list_pending_agent_permissions';
  readonly displayName = '列待处理权限';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description = '列出待审批的 Agent 工具权限请求。';
  readonly parameters = { type: 'object', properties: {} };

  async handler(_args: Record<string, never>, toolCtx?: ToolExecutionContext) {
    try {
      const service = agentRunService(toolCtx, this.id);
      const items = await service.listPendingPermissions();
      return { ok: true, count: items.length, items };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, errorCode: 'LIST_PENDING_PERMISSIONS_FAILED', message };
    }
  }
}

class ApproveAgentPermissionTool extends BaseTool {
  readonly id = 'approve_agent_permission';
  readonly name = 'approve_agent_permission';
  readonly displayName = '批准 Agent 权限';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly execution = HIGH;
  readonly description = '批准 Agent 运行的权限请求。必填 runId、permissionId；可选 reason。';
  readonly parameters = {
    type: 'object',
    properties: {
      runId: { type: 'string' },
      permissionId: { type: 'string' },
      reason: { type: 'string' },
    },
    required: ['runId', 'permissionId'],
  };

  async handler(
    args: { runId?: string; permissionId?: string; reason?: string },
    toolCtx?: ToolExecutionContext,
  ) {
    try {
      const service = agentRunService(toolCtx, this.id);
      const result = await service.approvePermission(
        String(args.runId || ''),
        String(args.permissionId || ''),
        { reason: args.reason },
      );
      return { ok: true, result };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, errorCode: 'APPROVE_PERMISSION_FAILED', message };
    }
  }
}

class RejectAgentPermissionTool extends BaseTool {
  readonly id = 'reject_agent_permission';
  readonly name = 'reject_agent_permission';
  readonly displayName = '拒绝 Agent 权限';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly execution = HIGH;
  readonly description = '拒绝 Agent 运行的权限请求。必填 runId、permissionId；可选 reason。';
  readonly parameters = {
    type: 'object',
    properties: {
      runId: { type: 'string' },
      permissionId: { type: 'string' },
      reason: { type: 'string' },
    },
    required: ['runId', 'permissionId'],
  };

  async handler(
    args: { runId?: string; permissionId?: string; reason?: string },
    toolCtx?: ToolExecutionContext,
  ) {
    try {
      const service = agentRunService(toolCtx, this.id);
      const result = await service.rejectPermission(
        String(args.runId || ''),
        String(args.permissionId || ''),
        { reason: args.reason },
      );
      return { ok: true, result };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, errorCode: 'REJECT_PERMISSION_FAILED', message };
    }
  }
}

class ResolveAgentHitlTool extends BaseTool {
  readonly id = 'resolve_agent_hitl';
  readonly name = 'resolve_agent_hitl';
  readonly displayName = '解决 Agent HITL';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly execution = HIGH;
  readonly description =
    '解决 Agent HITL 请求。必填 runId、requestId；body 按 HITL 类型传入 decision/answers 等。';
  readonly parameters = {
    type: 'object',
    properties: {
      runId: { type: 'string' },
      requestId: { type: 'string' },
      decision: { type: 'string' },
      answers: { type: 'object', additionalProperties: true },
    },
    required: ['runId', 'requestId'],
    additionalProperties: true,
  };

  async handler(args: Record<string, unknown>, toolCtx?: ToolExecutionContext) {
    try {
      const service = agentRunService(toolCtx, this.id);
      const { runId, requestId, ...body } = args;
      const result = await service.resolveRunHitl(
        String(runId || ''),
        String(requestId || ''),
        body,
      );
      return { ok: true, result };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, errorCode: 'RESOLVE_HITL_FAILED', message };
    }
  }
}

class ListAgentSessionMessagesTool extends BaseTool {
  readonly id = 'list_agent_session_messages';
  readonly name = 'list_agent_session_messages';
  readonly displayName = '列会话消息';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description = '列出 Agent 会话消息。必填 sessionId。';
  readonly parameters = {
    type: 'object',
    properties: { sessionId: { type: 'string' } },
    required: ['sessionId'],
  };

  async handler(args: { sessionId?: string }, toolCtx?: ToolExecutionContext) {
    try {
      const service = agentRunService(toolCtx, this.id);
      const messages = await service.getSessionMessages(String(args.sessionId || ''));
      return { ok: true, messages };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, errorCode: 'LIST_SESSION_MESSAGES_FAILED', message };
    }
  }
}

export const agentRunAdminTools: BaseTool[] = [
  new ListAgentRunsTool(),
  new GetAgentRunTool(),
  new ListAgentRunMessagesTool(),
  new CancelAgentRunTool(),
  new RetryAgentRunTool(),
  new ListPendingAgentHitlTool(),
  new ListPendingAgentPermissionsTool(),
  new ApproveAgentPermissionTool(),
  new RejectAgentPermissionTool(),
  new ResolveAgentHitlTool(),
  new ListAgentSessionMessagesTool(),
];
