import { AppError } from '../../../domain/errors.js';
import type { AgentSession } from '../engine/AgentSession.js';
import type { AgentWorkspaceState, WorkspacePlanState, WorkspaceTodoItem } from './AgentWorkspaceState.js';
import { toRenderTodos, toWorkspaceTodos, todosFromAdds } from './AgentWorkspaceState.js';

type SessionReader = (runId: string) => Promise<AgentSession | null>;
type SessionWriter = (session: AgentSession) => Promise<void>;

export class WorkspaceStateService {
  constructor(
    private readonly readSession: SessionReader,
    private readonly writeSession: SessionWriter,
  ) {}

  async setTodos(runId: string, todos: WorkspaceTodoItem[]) {
    const session = await this.requireSession(runId);
    const workspaceState: AgentWorkspaceState = {
      ...(session.workspaceState ?? {}),
      todos,
    };
    await this.writeSession({ ...session, workspaceState });
    return this.buildTodosResult(todos);
  }

  async createTodos(
    runId: string,
    input: { todos?: Array<{ id?: string; content?: string; completed?: boolean }>; adds?: string[] },
  ) {
    const todos = input.todos?.length
      ? toWorkspaceTodos(input.todos)
      : Array.isArray(input.adds)
        ? todosFromAdds(input.adds)
        : [];
    return this.setTodos(runId, todos);
  }

  async updateTodos(
    runId: string,
    input: {
      todos?: Array<{ id?: string; content?: string; completed?: boolean }>;
      updates?: Array<{ id?: string; content?: string; completed?: boolean }>;
      replace?: boolean;
    },
  ) {
    const session = await this.requireSession(runId);
    const current = session.workspaceState?.todos ?? [];

    if (input.replace === true && input.todos?.length) {
      return this.setTodos(runId, toWorkspaceTodos(input.todos));
    }

    if (input.todos?.length) {
      const byId = new Map(current.map((todo) => [todo.id, todo]));
      for (const item of toWorkspaceTodos(input.todos)) {
        byId.set(item.id, { ...byId.get(item.id), ...item });
      }
      return this.setTodos(runId, [...byId.values()]);
    }

    if (input.updates?.length) {
      const byId = new Map(current.map((todo) => [todo.id, { ...todo }]));
      for (const update of input.updates) {
        const id = update.id?.trim();
        if (!id || !byId.has(id)) continue;
        const existing = byId.get(id)!;
        byId.set(id, {
          ...existing,
          ...(update.content !== undefined ? { content: String(update.content) } : {}),
          ...(update.completed !== undefined ? { completed: update.completed === true } : {}),
        });
      }
      return this.setTodos(runId, [...byId.values()]);
    }

    return this.buildTodosResult(current);
  }

  async clearTodos(runId: string) {
    return this.setTodos(runId, []);
  }

  async setPlan(runId: string, plan: WorkspacePlanState) {
    const session = await this.requireSession(runId);
    const workspaceState: AgentWorkspaceState = {
      ...(session.workspaceState ?? {}),
      plan,
    };
    await this.writeSession({ ...session, workspaceState });
    return this.buildPlanResult(plan);
  }

  async createPlan(runId: string, plan: WorkspacePlanState) {
    return this.setPlan(runId, plan);
  }

  async updatePlan(runId: string, patch: WorkspacePlanState) {
    const session = await this.requireSession(runId);
    const current = session.workspaceState?.plan ?? {};
    const next = {
      ...current,
      ...(patch.goal !== undefined ? { goal: patch.goal } : {}),
      ...(patch.context !== undefined ? { context: patch.context } : {}),
    };
    return this.setPlan(runId, next);
  }

  private async requireSession(runId: string): Promise<AgentSession> {
    const session = await this.readSession(runId);
    if (!session) {
      throw new AppError(404, `Agent session not found for run: ${runId}`);
    }
    return session;
  }

  private buildTodosResult(todos: WorkspaceTodoItem[]) {
    return {
      todos: toRenderTodos(todos),
      count: todos.length,
      summary: todos.length > 0 ? `已更新 ${todos.length} 项待办` : '待办已清空',
    };
  }

  private buildPlanResult(plan: WorkspacePlanState) {
    return {
      goal: plan.goal,
      context: plan.context,
      plan,
      summary: plan.goal ? `计划：${plan.goal}` : '计划已更新',
    };
  }
}
