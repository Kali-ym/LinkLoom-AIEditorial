import { requireToolContext, type ToolExecutionContext } from '../../../services/ToolExecutionContext.js';
import { BaseTool } from '../../base/BaseTool.js';
import { requireAgentRun, requireWorkspaceStateService } from './workspaceToolSupport.js';

export class CreatePlanTool extends BaseTool {
  readonly id = 'create_plan';
  readonly name = 'create_plan';
  readonly displayName = '创建计划';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    '为当前 Agent 运行创建或覆盖会话执行计划。仅当同一回合需连续执行 3 步以上的复杂 SOP 时使用(如评分管线、日报发布全流程)。' +
    '单次读查询或介绍工具时不要调用。必填：goal；可选 context（Markdown 补充说明）。';
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
    return service.createPlan(run.runId, {
      goal: args.goal?.trim() || undefined,
      context: args.context?.trim() || undefined,
    });
  }
}
