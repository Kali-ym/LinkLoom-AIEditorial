import type { ToolExecutionContext } from '../../../services/ToolExecutionContext.js';
import { writeWorkspaceFile } from './workspaceFileToolSupport.js';
import {
  formatPlanMarkdown,
  formatTodosJson,
  isLinkloomPlanPath,
  isLinkloomTodosPath,
  LINKLOOM_PLAN_PATH,
  LINKLOOM_TODOS_PATH,
  parsePlanMarkdown,
  parseTodosJson,
  type LinkloomTodoItem,
} from './linkloomWorkspaceArtifacts.js';
import { requireAgentRun, requireWorkspaceStateService } from './workspaceToolSupport.js';

/** After writing `.linkloom/*`, mirror into session workspaceState for Console UI. */
export async function syncLinkloomArtifactToSession(
  filePath: string,
  content: string,
  context?: ToolExecutionContext
): Promise<void> {
  if (!context?.agentRun || !context.services.workspaceStateService) return;

  try {
    if (isLinkloomPlanPath(filePath)) {
      const plan = parsePlanMarkdown(content);
      const run = requireAgentRun(context, 'linkloom_sync');
      const service = requireWorkspaceStateService(context, 'linkloom_sync');
      await service.setPlan(run.runId, plan);
      return;
    }
    if (isLinkloomTodosPath(filePath)) {
      const todos = parseTodosJson(content);
      const run = requireAgentRun(context, 'linkloom_sync');
      const service = requireWorkspaceStateService(context, 'linkloom_sync');
      await service.setTodos(
        run.runId,
        todos.map((t) => ({
          id: t.id,
          content: t.content,
          completed: t.completed === true,
        }))
      );
    }
  } catch {
    // File write already succeeded; session mirror is best-effort for UI.
  }
}

/** Plan/todo shims: mirror session state into workspace file (no session re-sync). */
export async function tryWriteLinkloomPlanFile(
  plan: { goal?: string; context?: string },
  context?: ToolExecutionContext
): Promise<void> {
  if (!context?.workspace) return;
  try {
    await writeWorkspaceFile(LINKLOOM_PLAN_PATH, formatPlanMarkdown(plan), context);
  } catch {
    // Session already updated; file mirror is optional.
  }
}

export async function tryWriteLinkloomTodosFile(
  todos: LinkloomTodoItem[],
  context?: ToolExecutionContext
): Promise<void> {
  if (!context?.workspace) return;
  try {
    await writeWorkspaceFile(LINKLOOM_TODOS_PATH, formatTodosJson(todos), context);
  } catch {
    // Session already updated; file mirror is optional.
  }
}
