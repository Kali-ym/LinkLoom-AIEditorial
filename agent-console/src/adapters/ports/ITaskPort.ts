import type { SidebarTask, TaskGroup } from '../../domain/types/task';
import type { TaskDetailPageData } from '../../domain/types/taskDetailPage';
import type { TaskDetailPatch } from '../types';

export interface ITaskPort {
  getTaskGroups(agentId: string): Promise<TaskGroup[]>;
  fetchTaskGroups(agentId: string): Promise<TaskGroup[]>;
  fetchTaskDetail(task: SidebarTask | undefined): Promise<TaskDetailPageData | null>;
  saveTaskDetail(taskId: string, patch: TaskDetailPatch): Promise<void>;
}
