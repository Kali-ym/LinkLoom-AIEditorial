import { requireToolContext, type ToolExecutionContext } from '../../../services/ToolExecutionContext.js';
import { BaseTool } from '../../base/BaseTool.js';
import { requireAgentRun, requireWorkspaceStateService } from './workspaceToolSupport.js';
import { tryWriteLinkloomTodosFile } from './linkloomWorkspaceSync.js';
import { LINKLOOM_TODOS_PATH } from './linkloomWorkspaceArtifacts.js';

/** 兼容别名：优先 writeFile 写入 `.linkloom/todos.json`。 */
export class CreateTodosTool extends BaseTool {
  readonly id = 'create_todos';
  readonly name = 'create_todos';
  readonly displayName = '创建待办';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    `兼容别名：优先 writeFile 写入 ${LINKLOOM_TODOS_PATH}（JSON 数组）。` +
    '创建/替换会话待办（3 步及以上）。必填 todos 或 adds。';
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
          required: ['content'],
        },
      },
      adds: {
        type: 'array',
        items: { type: 'string' },
      },
    },
  };

  async handler(
    args: {
      todos?: Array<{ id?: string; content?: string; completed?: boolean }>;
      adds?: string[];
    },
    toolCtx?: ToolExecutionContext,
  ) {
    const context = requireToolContext(toolCtx, this.id);
    const run = requireAgentRun(context, this.id);
    const service = requireWorkspaceStateService(context, this.id);
    const result = await service.createTodos(run.runId, args);
    await tryWriteLinkloomTodosFile(result.todos ?? [], context);
    return result;
  }
}
