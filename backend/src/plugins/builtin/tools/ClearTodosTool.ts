import { requireToolContext, type ToolExecutionContext } from '../../../services/ToolExecutionContext.js';
import { BaseTool } from '../../base/BaseTool.js';
import { requireAgentRun, requireWorkspaceStateService } from './workspaceToolSupport.js';
import { tryWriteLinkloomTodosFile } from './linkloomWorkspaceSync.js';
import { LINKLOOM_TODOS_PATH } from './linkloomWorkspaceArtifacts.js';

/** 兼容别名：优先 writeFile 将 `.linkloom/todos.json` 写为 []。 */
export class ClearTodosTool extends BaseTool {
  readonly id = 'clear_todos';
  readonly name = 'clear_todos';
  readonly displayName = '清空待办';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    `兼容别名：优先 writeFile 将 ${LINKLOOM_TODOS_PATH} 写为 []。清空会话全部待办。无需参数。`;
  readonly parameters = {
    type: 'object',
    properties: {},
  };

  async handler(_args: Record<string, unknown>, toolCtx?: ToolExecutionContext) {
    const context = requireToolContext(toolCtx, this.id);
    const run = requireAgentRun(context, this.id);
    const service = requireWorkspaceStateService(context, this.id);
    const result = await service.clearTodos(run.runId);
    await tryWriteLinkloomTodosFile([], context);
    return result;
  }
}
