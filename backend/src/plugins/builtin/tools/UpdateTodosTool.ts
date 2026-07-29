import { requireToolContext, type ToolExecutionContext } from '../../../services/ToolExecutionContext.js';
import { BaseTool } from '../../base/BaseTool.js';
import { requireAgentRun, requireWorkspaceStateService } from './workspaceToolSupport.js';
import { writeLinkloomTodos } from './linkloomWorkspaceSync.js';
import { LINKLOOM_TODOS_PATH } from './linkloomWorkspaceArtifacts.js';

/** @deprecated Prefer writeFile/editFile on `.linkloom/todos.json`. Compatibility shim. */
export class UpdateTodosTool extends BaseTool {
  readonly id = 'update_todos';
  readonly name = 'update_todos';
  readonly displayName = '更新待办';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    `【兼容别名】请优先用 writeFile/editFile 更新 ${LINKLOOM_TODOS_PATH}。` +
    '按 id 增量更新当前会话待办项,或 replace=true 时整体替换列表。';
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
    try {
      const todos =
        result && typeof result === 'object' && Array.isArray((result as { todos?: unknown }).todos)
          ? (
              (result as unknown as { todos: Array<{ id?: string; content: string; completed?: boolean }> })
                .todos
            ).map((t, i) => ({
              id: t.id || `todo-${i + 1}`,
              content: t.content,
              completed: t.completed === true,
            }))
          : [];
      await writeLinkloomTodos(todos, context);
    } catch {
      // best-effort
    }
    return result;
  }
}
