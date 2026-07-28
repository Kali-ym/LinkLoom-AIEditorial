import { requireToolContext, type ToolExecutionContext } from '../../../services/ToolExecutionContext.js';
import { BaseTool } from '../../base/BaseTool.js';
import { requireAgentRun, requireWorkspaceStateService } from './workspaceToolSupport.js';

export class UpdatePlanTool extends BaseTool {
  readonly id = 'update_plan';
  readonly name = 'update_plan';
  readonly displayName = '更新计划';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    '更新当前 Agent 运行会话中的执行计划字段。执行中途调整目标或补充上下文时调用。至少提供 goal 或 context 之一。';
  readonly parameters = {
    type: 'object',
    properties: {
      goal: { type: 'string' },
      context: { type: 'string' },
    },
  };

  async handler(args: { goal?: string; context?: string }, toolCtx?: ToolExecutionContext) {
    const context = requireToolContext(toolCtx, this.id);
    const run = requireAgentRun(context, this.id);
    const service = requireWorkspaceStateService(context, this.id);
    return service.updatePlan(run.runId, {
      ...(args.goal !== undefined ? { goal: args.goal } : {}),
      ...(args.context !== undefined ? { context: args.context } : {}),
    });
  }
}
