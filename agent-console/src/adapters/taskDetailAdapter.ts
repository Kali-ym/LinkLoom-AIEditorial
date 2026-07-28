import type { SidebarTask } from '../domain/types/task';
import type { TaskDetailPageData } from '../domain/types/taskDetailPage';

function mockEnrich(task: SidebarTask): TaskDetailPageData {
  const title = task.name?.trim() || task.identifier;
  return {
    id: task.id,
    identifier: task.identifier,
    title,
    status: task.status,
    instruction: `执行「${title}」的说明与验收标准（mock）。`,
    model: 'gpt-4o',
    assignee: '收件箱助手',
    parentLabel: task.status === 'backlog' ? undefined : 'Agent Console 演示',
    topicId: task.topicId ?? 'demo-topic-1',
    subtasks: [
      { id: `${task.id}-s1`, title: '收集上下文', done: task.status !== 'backlog' },
      { id: `${task.id}-s2`, title: '执行主流程', done: task.status === 'running' },
      { id: `${task.id}-s3`, title: '汇总结果', done: false },
    ],
    artifacts: [
      { id: `${task.id}-a1`, name: 'output.md', type: 'markdown' },
      { id: `${task.id}-a2`, name: 'screenshot.png', type: 'image' },
    ],
    activities: [
      { id: `${task.id}-act1`, label: '任务创建', at: '2026-06-18T09:00:00' },
      { id: `${task.id}-act2`, label: '状态更新', at: '2026-06-18T10:15:00' },
    ],
  };
}

/** §C.54 — mock task detail; future apiAdapter */
export async function fetchTaskDetailPage(
  task: SidebarTask | undefined,
): Promise<TaskDetailPageData | null> {
  await new Promise((r) => window.setTimeout(r, 280));
  if (!task) return null;
  return mockEnrich(task);
}
