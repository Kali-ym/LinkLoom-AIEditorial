import { requireToolContext, type ToolExecutionContext } from '../../../services/ToolExecutionContext.js';
import { BaseTool } from '../../base/BaseTool.js';
import { requireAgentRun, requireWorkspaceStateService } from './workspaceToolSupport.js';
import { writeLinkloomTodos } from './linkloomWorkspaceSync.js';
import { LINKLOOM_TODOS_PATH } from './linkloomWorkspaceArtifacts.js';
import { toWorkspaceTodos, todosFromAdds } from '../../../services/agents/workspace/AgentWorkspaceState.js';

/** @deprecated Prefer writeFile to `.linkloom/todos.json`. Compatibility shim. */
export class CreateTodosTool extends BaseTool {
  readonly id = 'create_todos';
  readonly name = 'create_todos';
  readonly displayName = '创建待办';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    `【兼容别名】请优先用 writeFile 写入 ${LINKLOOM_TODOS_PATH}（JSON 数组）。` +
    '为当前 Agent 运行创建或替换会话待办列表。仅当同一回合需依次执行 3 个及以上独立步骤时使用。' +
    '必填：todos 或 adds。';
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
        description: 'Shortcut: create todos from plain text lines',
      },
    },
  };

  async handler(
    args: { todos?: Array<{ id?: string; content?: string; completed?: boolean }>; adds?: string[] },
    toolCtx?: ToolExecutionContext,
  ) {
    const context = requireToolContext(toolCtx, this.id);
    const run = requireAgentRun(context, this.id);
    const service = requireWorkspaceStateService(context, this.id);
    const result = await service.createTodos(run.runId, args);
    try {
      const todos = args.todos?.length
        ? toWorkspaceTodos(args.todos)
        : Array.isArray(args.adds)
          ? todosFromAdds(args.adds)
          : [];
      await writeLinkloomTodos(todos, context);
    } catch {
      // best-effort
    }
    return result;
  }
}
