import type { TaskGroup } from '../domain/types/task';

/** Sidebar task groups — aligned with upstream `SIDEBAR_GROUPS` mock data. */
export const MOCK_TASK_GROUPS: TaskGroup[] = [
  {
    key: 'needsInput',
    tasks: [
      {
        id: 'task-approval',
        identifier: 'web_browse',
        name: '审批工具调用：web_browse',
        status: 'paused',
        topicId: 'approval',
      },
      {
        id: 'task-failed-demo',
        identifier: 'deploy_check',
        name: '部署检查失败',
        status: 'failed',
        topicId: 'changelog',
      },
    ],
  },
  {
    key: 'backlog',
    tasks: [
      {
        id: 'task-backlog-1',
        identifier: 'refactor_sidebar',
        name: '重构侧栏布局',
        status: 'backlog',
        topicId: 'skills',
      },
    ],
  },
  {
    key: 'running',
    tasks: [
      {
        id: 'task-changelog',
        identifier: 'changelog',
        name: '抓取 Changelog 页面',
        status: 'running',
        topicId: 'changelog',
      },
      {
        id: 'task-scheduled',
        identifier: 'nightly_sync',
        status: 'scheduled',
        topicId: 'skills',
      },
    ],
  },
];
