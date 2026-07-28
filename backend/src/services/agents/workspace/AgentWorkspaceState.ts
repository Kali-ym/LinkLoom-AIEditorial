export interface WorkspaceTodoItem {
  id: string;
  content: string;
  completed?: boolean;
}

export interface WorkspacePlanState {
  goal?: string;
  context?: string;
}

export interface AgentWorkspaceState {
  todos?: WorkspaceTodoItem[];
  plan?: WorkspacePlanState;
}

export interface WorkspaceTodoRenderItem {
  content: string;
  completed: boolean;
}

export function toWorkspaceTodos(
  items: Array<{ id?: string; content?: string; completed?: boolean }>,
  idPrefix = 'todo',
): WorkspaceTodoItem[] {
  return items.map((item, index) => ({
    id: item.id?.trim() || `${idPrefix}-${index + 1}`,
    content: item.content?.trim() || '',
    completed: item.completed === true,
  }));
}

export function todosFromAdds(adds: string[]): WorkspaceTodoItem[] {
  return adds
    .map((text) => text.trim())
    .filter(Boolean)
    .map((content, index) => ({
      id: `todo-${index + 1}`,
      content,
      completed: false,
    }));
}

export function toRenderTodos(todos: WorkspaceTodoItem[]): WorkspaceTodoRenderItem[] {
  return todos.map((todo) => ({
    content: todo.content,
    completed: todo.completed === true,
  }));
}
