export type TaskStatus = 'paused' | 'failed' | 'backlog' | 'running' | 'scheduled';

export type TaskGroupKey = 'needsInput' | 'backlog' | 'running';

export interface SidebarTask {
  id: string;
  identifier: string;
  name?: string;
  status: TaskStatus;
  /** Mock navigation — maps task row to an existing topic for demo. */
  topicId?: string;
}

export interface TaskGroup {
  key: TaskGroupKey;
  tasks: SidebarTask[];
  total?: number;
  hasMore?: boolean;
}
