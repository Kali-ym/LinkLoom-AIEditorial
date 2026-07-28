import { requireToolContext, type ToolExecutionContext } from '../../../services/ToolExecutionContext.js';
import { BaseTool } from '../../base/BaseTool.js';
import { requireAgentRun, requireWorkspaceStateService } from './workspaceToolSupport.js';

export class CreateTodosTool extends BaseTool {
  readonly id = 'create_todos';
  readonly name = 'create_todos';
  readonly displayName = '创建待办';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    '为当前 Agent 运行创建或替换会话待办列表。仅当同一回合需依次执行 3 个及以上独立步骤时使用。' +
    '禁止:单次 list/get/query 读操作、把用户问题复述成 todo、寒暄或介绍工具时调用。' +
    '必填：todos（对象数组，每项含 content）或 adds（纯文本行数组快捷创建）。';
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
    return service.createTodos(run.runId, args);
  }
}
