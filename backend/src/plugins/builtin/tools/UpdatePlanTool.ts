import { requireToolContext, type ToolExecutionContext } from '../../../services/ToolExecutionContext.js';
import { BaseTool } from '../../base/BaseTool.js';
import { requireAgentRun, requireWorkspaceStateService } from './workspaceToolSupport.js';
import { writeLinkloomPlan } from './linkloomWorkspaceSync.js';
import { LINKLOOM_PLAN_PATH } from './linkloomWorkspaceArtifacts.js';

/** @deprecated Prefer writeFile/editFile on `.linkloom/plan.md`. Compatibility shim. */
export class UpdatePlanTool extends BaseTool {
  readonly id = 'update_plan';
  readonly name = 'update_plan';
  readonly displayName = '更新计划';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    `【兼容别名】请优先用 writeFile/editFile 更新 ${LINKLOOM_PLAN_PATH}。` +
    '更新当前会话执行计划。至少提供 goal 或 context 之一。';
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
    const result = await service.updatePlan(run.runId, {
      ...(args.goal !== undefined ? { goal: args.goal } : {}),
      ...(args.context !== undefined ? { context: args.context } : {}),
    });
    try {
      const plan =
        result && typeof result === 'object' && 'plan' in (result as object)
          ? ((result as { plan?: { goal?: string; context?: string } }).plan ?? {})
          : {
              ...(args.goal !== undefined ? { goal: args.goal } : {}),
              ...(args.context !== undefined ? { context: args.context } : {}),
            };
      await writeLinkloomPlan(plan, context);
    } catch {
      // best-effort
    }
    return result;
  }
}
