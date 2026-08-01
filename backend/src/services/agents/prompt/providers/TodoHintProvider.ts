import type { WorkspaceTodoItem } from '../../workspace/AgentWorkspaceState.js';
import { wrapTagRaw } from '../sanitize.js';
import type { PromptBuildContext, PromptContribution, PromptProvider } from '../types.js';

/**
 * tail_guidance 阶段注入会话 todo 状态。
 * 触发条件:options.sessionId 存在且 session 组内存在非空 todos
 * (在 AgentService.resolveTodoState 处判定,跨 run 继承最新非空 workspaceState)。
 * 放尾部利于 stable prefix cache;每轮 todo 变动只影响 tail 段。
 */
export class TodoHintProvider implements PromptProvider {
  id = 'todo_hint';
  // Keep todos after model/date/kb/memory/tool hints so the dynamic tail order
  // stays deterministic across turns.
  phase = 'tail_guidance' as const;
  priority = 50;

  build(ctx: PromptBuildContext): PromptContribution | null {
    const todos = ctx.todoState?.todos;
    if (!todos || todos.length === 0) return null;
    return {
      content: wrapTagRaw('todos', renderTodos(todos)),
      cacheClass: 'dynamic'
    };
  }
}

function renderTodos(todos: WorkspaceTodoItem[]): string {
  const lines = todos.map((todo) => {
    const mark = todo.completed ? '[x]' : '[ ]';
    return `- ${mark} ${todo.content}`;
  });
  return `当前任务进度:\n${lines.join('\n')}`;
}
