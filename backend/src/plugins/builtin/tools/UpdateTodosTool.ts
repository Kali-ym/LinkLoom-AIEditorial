import { requireToolContext, type ToolExecutionContext } from '../../../services/ToolExecutionContext.js';
import { BaseTool } from '../../base/BaseTool.js';
import { requireAgentRun, requireWorkspaceStateService } from './workspaceToolSupport.js';
import { tryWriteLinkloomTodosFile } from './linkloomWorkspaceSync.js';
import { LINKLOOM_TODOS_PATH } from './linkloomWorkspaceArtifacts.js';

/** 兼容别名：优先 writeFile/editFile 更新 `.linkloom/todos.json`。 */
export class UpdateTodosTool extends BaseTool {
  readonly id = 'update_todos';
  readonly name = 'update_todos';
  readonly displayName = '更新待办';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    `兼容别名：优先 writeFile/editFile 更新 ${LINKLOOM_TODOS_PATH}。` +
    '按 id 增量更新，或 replace=true 整体替换。';
  readonly parameters = {
    type: 'object',
    properties: {
      todos: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            content: { type: 'string' },
            completed: { type: 'boolean' },
          },
        },
      },
      updates: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            content: { type: 'string' },
            completed: { type: 'boolean' },
          },
          required: ['id'],
        },
      },
      replace: { type: 'boolean' },
    },
  };

  async handler(
    args: {
      todos?: Array<{ id?: string; content?: string; completed?: boolean }>;
      updates?: Array<{ id?: string; content?: string; completed?: boolean }>;
      replace?: boolean;
    },
    toolCtx?: ToolExecutionContext,
  ) {
    const context = requireToolContext(toolCtx, this.id);
    const run = requireAgentRun(context, this.id);
    const service = requireWorkspaceStateService(context, this.id);
    const result = await service.updateTodos(run.runId, args);
    await tryWriteLinkloomTodosFile(result.todos ?? [], context);
    return result;
  }
}
