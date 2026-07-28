import { AppError } from '../../../domain/errors.js';
import type { ToolExecutionContext } from '../../../services/ToolExecutionContext.js';
import type { WorkspaceStateService } from '../../../services/agents/workspace/WorkspaceStateService.js';

export interface AgentRunToolContext {
  sessionId: string;
  runId: string;
}

export function requireAgentRun(
  ctx: ToolExecutionContext | undefined,
  toolId: string,
): AgentRunToolContext {
  const context = ctx;
  if (!context?.agentRun?.runId || !context.agentRun.sessionId) {
    throw new AppError(400, `Tool "${toolId}" requires an active agent run context`);
  }
  return context.agentRun;
}

export function requireWorkspaceStateService(
  ctx: ToolExecutionContext | undefined,
  toolId: string,
): WorkspaceStateService {
  const service = ctx?.services.workspaceStateService;
  if (!service) {
    throw new AppError(500, `WorkspaceStateService is unavailable for tool "${toolId}"`);
  }
  return service;
}
