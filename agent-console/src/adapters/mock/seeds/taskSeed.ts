import { MOCK_TASK_GROUPS } from '../../../fixtures/mockTasks';
import type { TaskGroup } from '../../../domain/types/task';

export function getMockTaskGroups(): TaskGroup[] {
  return MOCK_TASK_GROUPS;
}
