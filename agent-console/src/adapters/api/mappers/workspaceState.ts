import { TOOLSET_IDS } from '../../../domain/constants/toolsetIdentifiers';
import type { TodoItem, ToolPayload, WorkspacePlan } from '../../../domain/types';

export interface BackendWorkspaceTodo {
  id: string;
  content: string;
  completed?: boolean;
}

export interface BackendWorkspaceState {
  todos?: BackendWorkspaceTodo[];
  plan?: WorkspacePlan;
}

export interface BackendWorkspaceTodoRender {
  content?: string;
  completed?: boolean;
}

export function mapBackendTodosToDomain(todos?: BackendWorkspaceTodo[]): TodoItem[] {
  if (!todos?.length) return [];
  return todos.map((todo) => ({
    id: todo.id,
    label: todo.content,
    done: todo.completed === true,
    status: todo.completed ? 'completed' : 'todo',
  }));
}

export function mapRenderTodosToDomain(todos: BackendWorkspaceTodoRender[]): TodoItem[] {
  return todos.map((todo, index) => ({
    id: `todo-${index + 1}`,
    label: todo.content ?? '',
    done: todo.completed === true,
    status: todo.completed ? 'completed' : 'todo',
  }));
}

export function mapPluginStatePlanToDomain(pluginState: unknown): WorkspacePlan | undefined {
  if (!pluginState || typeof pluginState !== 'object') return undefined;
  const record = pluginState as Record<string, unknown>;
  const nested = record.plan;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const plan = nested as WorkspacePlan;
    if (plan.goal || plan.context) return plan;
  }
  const goal = typeof record.goal === 'string' ? record.goal : undefined;
  const context = typeof record.context === 'string' ? record.context : undefined;
  if (!goal && !context) return undefined;
  return { goal, context };
}

const WORKSPACE_TODO_APIS = new Set(['createTodos', 'updateTodos', 'clearTodos']);
const WORKSPACE_PLAN_APIS = new Set(['createPlan', 'updatePlan']);
const WORKSPACE_FILE_MUTATION_APIS = new Set(['writeFile', 'editFile', 'deleteFile']);

export function normalizeWorkspaceRelativePath(inputPath: string): string {
  const trimmed = inputPath.trim().replace(/^\/workspace\//, '').replace(/^\//, '');
  return trimmed;
}

export function extractMutatedWorkspacePathsFromTools(tools: ToolPayload[]): string[] {
  const paths: string[] = [];

  for (const tool of tools) {
    if (tool.state !== 'success') continue;
    if (tool.identifier !== TOOLSET_IDS.LOCAL_SYSTEM) continue;

    const apiName = tool.apiName ?? tool.api;
    if (!apiName || !WORKSPACE_FILE_MUTATION_APIS.has(apiName)) continue;

    const args = (tool.arguments ?? tool.params) as Record<string, unknown> | undefined;
    const rawPath = typeof args?.path === 'string' ? args.path : '';
    const path = normalizeWorkspaceRelativePath(rawPath);
    if (path) paths.push(path);
  }

  return [...new Set(paths)];
}

export interface WorkspaceStorePatch {
  todos?: TodoItem[];
  plan?: WorkspacePlan;
}

export function deriveWorkspacePatchFromTools(tools: ToolPayload[]): WorkspaceStorePatch | null {
  const patch: WorkspaceStorePatch = {};
  let changed = false;

  for (const tool of tools) {
    if (tool.state !== 'success') continue;
    if (tool.identifier !== TOOLSET_IDS.AGENT) continue;

    const apiName = tool.apiName ?? tool.api;
    if (!apiName) continue;

    if (WORKSPACE_TODO_APIS.has(apiName)) {
      if (apiName === 'clearTodos') {
        patch.todos = [];
        changed = true;
        continue;
      }
      const pluginState = tool.pluginState;
      if (pluginState && typeof pluginState === 'object' && !Array.isArray(pluginState)) {
        const todos = (pluginState as { todos?: Array<{ content?: string; completed?: boolean }> }).todos;
        if (Array.isArray(todos)) {
          patch.todos = mapRenderTodosToDomain(todos);
          changed = true;
        }
      }
    }

    if (WORKSPACE_PLAN_APIS.has(apiName)) {
      const plan = mapPluginStatePlanToDomain(tool.pluginState);
      if (plan) {
        patch.plan = plan;
        changed = true;
      }
    }
  }

  return changed ? patch : null;
}
