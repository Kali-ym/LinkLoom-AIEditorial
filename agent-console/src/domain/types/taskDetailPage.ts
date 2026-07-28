import type { TaskStatus } from './task';

export interface TaskDetailSubtask {
  id: string;
  title: string;
  done: boolean;
}

export interface TaskDetailArtifact {
  id: string;
  name: string;
  type: string;
}

export interface TaskDetailActivity {
  id: string;
  label: string;
  at: string;
}

/** §C.54 — agent `/task/:taskId` page model (distinct from message `TaskDetail`) */
export interface TaskDetailPageData {
  id: string;
  identifier: string;
  title: string;
  status: TaskStatus;
  instruction?: string;
  model?: string;
  assignee?: string;
  parentLabel?: string;
  topicId?: string;
  subtasks: TaskDetailSubtask[];
  artifacts: TaskDetailArtifact[];
  activities: TaskDetailActivity[];
}
