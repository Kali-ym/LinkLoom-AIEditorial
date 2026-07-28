import type { TaskDetailPageData } from '../domain/types/taskDetailPage';

export type TaskDetailPatch = Partial<
  Pick<TaskDetailPageData, 'title' | 'status' | 'subtasks' | 'instruction'>
>;

/** §C.54 — task detail persist mock */
export async function saveTaskDetailPage(
  taskId: string,
  patch: TaskDetailPatch,
): Promise<void> {
  await new Promise((r) => window.setTimeout(r, 200));
  void taskId;
  void patch;
}
