import { requireToolContext, type ToolExecutionContext } from '../../../services/ToolExecutionContext.js';
import { BaseTool } from '../../base/BaseTool.js';
import { requireAgentRun, requireWorkspaceStateService } from './workspaceToolSupport.js';

export class ClearTodosTool extends BaseTool {
  readonly id = 'clear_todos';
  readonly name = 'clear_todos';
  readonly displayName = '清空待办';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    '清空当前 Agent 运行会话中的全部待办项。' +
    '仅在用户明确要求重置待办、或同一多步任务全部完成且不再续接时调用。' +
    '禁止:回答新问题时顺带清空、介绍工具能力时调用。无需参数。';
  readonly parameters = {
    type: 'object',
    properties: {},
  };

  async handler(_args: Record<string, unknown>, toolCtx?: ToolExecutionContext) {
    const context = requireToolContext(toolCtx, this.id);
    const run = requireAgentRun(context, this.id);
    const service = requireWorkspaceStateService(context, this.id);
    return service.clearTodos(run.runId);
  }
}
