import type { TaskGroup } from '../domain/types/task';
import { MOCK_TASK_GROUPS } from '../fixtures/mockTasks';

/** Mock taskService.groupList — 未来 apiAdapter 替换。 */
export async function fetchTaskGroupsForAgent(agentId: string): Promise<TaskGroup[]> {
  await new Promise((r) => window.setTimeout(r, 120));
  void agentId;
  return MOCK_TASK_GROUPS.map((group) => ({
    ...group,
    tasks: group.tasks.map((task) => ({ ...task })),
  }));
}
