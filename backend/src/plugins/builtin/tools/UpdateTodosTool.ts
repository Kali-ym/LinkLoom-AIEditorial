import { requireToolContext, type ToolExecutionContext } from '../../../services/ToolExecutionContext.js';
import { BaseTool } from '../../base/BaseTool.js';
import { requireAgentRun, requireWorkspaceStateService } from './workspaceToolSupport.js';

export class UpdateTodosTool extends BaseTool {
  readonly id = 'update_todos';
  readonly name = 'update_todos';
  readonly displayName = '更新待办';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    '按 id 增量更新当前会话待办项,或 replace=true 时整体替换列表。' +
    '仅当本回合已用 create_todos 建立过多步任务清单、且某一步完成/内容变化时调用。' +
    '禁止:为单次读查询建 todo、更新与当前用户问题无关的历史 todo。' +
    '必填：updates（含 id 的变更数组）或 todos；replace 为 true 时传完整 todos 列表。';
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
    return service.updateTodos(run.runId, args);
  }
}
