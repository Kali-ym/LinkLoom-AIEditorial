import { requireToolContext, type ToolExecutionContext } from '../../../services/ToolExecutionContext.js';
import { BaseTool } from '../../base/BaseTool.js';
import { requireAgentRun, requireWorkspaceStateService } from './workspaceToolSupport.js';
import { tryWriteLinkloomPlanFile } from './linkloomWorkspaceSync.js';
import { LINKLOOM_PLAN_PATH } from './linkloomWorkspaceArtifacts.js';

/** 兼容别名：优先 writeFile 写入 `.linkloom/plan.md`。 */
export class CreatePlanTool extends BaseTool {
  readonly id = 'create_plan';
  readonly name = 'create_plan';
  readonly displayName = '创建计划';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    `兼容别名：优先 writeFile 写入 ${LINKLOOM_PLAN_PATH}。` +
    '创建/覆盖会话计划（3 步以上 SOP）。必填 goal；可选 context。';
  readonly parameters = {
    type: 'object',
    properties: {
      goal: { type: 'string', description: 'Primary goal of the plan' },
      context: { type: 'string', description: 'Supporting context or steps in markdown' },
    },
    required: ['goal'],
  };

  async handler(args: { goal?: string; context?: string }, toolCtx?: ToolExecutionContext) {
    const context = requireToolContext(toolCtx, this.id);
    const run = requireAgentRun(context, this.id);
    const service = requireWorkspaceStateService(context, this.id);
    const plan = {
      goal: args.goal?.trim() || undefined,
      context: args.context?.trim() || undefined,
    };
    const result = await service.createPlan(run.runId, plan);
    await tryWriteLinkloomPlanFile(plan, context);
    return result;
  }
}
