import { TOOL_SHOWCASE_ACCORDIONS } from './showcaseTools';

const TASK_THREAD_BLOCKS = [
  {
    id: 'task-block-1',
    content: '正在分析 Changelog 页面结构…',
    tools: [TOOL_SHOWCASE_ACCORDIONS[0]],
  },
  {
    id: 'task-block-2',
    content: '已提取版本列表，正在生成摘要。',
  },
];

const BATCH_TASK = (id: string, title: string, status: 'Completed' | 'Processing' | 'Failed', agentId: string) => ({
  id,
  role: 'task' as const,
  agentId,
  content: '',
  createdAt: '2026-06-18T11:01:00',
  metadata: { taskTitle: title, instruction: `执行：${title}` },
  taskDetail: {
    status,
    title,
    instruction: `执行：${title}`,
    duration: status === 'Completed' ? 125_000 : undefined,
    startTime: status === 'Processing' ? Date.now() - 45_000 : undefined,
    totalToolCalls: status === 'Completed' ? 4 : status === 'Processing' ? 2 : 0,
    totalSteps: 3,
    threadId: `thread-${id}`,
    error: status === 'Failed' ? { message: '连接超时', code: 'ETIMEDOUT' } : undefined,
  },
  taskThreadMessages:
    status === 'Processing' || status === 'Completed'
      ? [
          {
            id: `${id}-tm1`,
            role: 'assistant' as const,
            children: TASK_THREAD_BLOCKS,
          },
        ]
      : undefined,
});

/** §C.17 / §C.47 demo messages — topic `msg-types` */
export const MSG_TYPES_DEMO_MESSAGES: import('../domain/types').Message[] = [
  {
    id: 'msg-types-u1',
    role: 'user',
    content: '展示各类特殊消息类型',
    createdAt: '2026-06-18T11:00:00',
  },
  {
    id: 'msg-types-supervisor',
    role: 'supervisor',
    content: '',
    createdAt: '2026-06-18T11:00:10',
    metadata: { isSupervisor: true },
    children: [
      {
        id: 'sup-block-1',
        content: '已接管本轮对话，正在协调子 Agent 执行任务。',
      },
      {
        id: 'sup-block-2',
        content: '子 Agent A 已完成检索，子 Agent B 正在生成报告。',
        tools: [TOOL_SHOWCASE_ACCORDIONS[0]],
      },
    ],
  },
  {
    id: 'msg-types-council',
    role: 'agentCouncil',
    content: '',
    createdAt: '2026-06-18T11:00:15',
    members: [
      {
        id: 'council-m1',
        role: 'assistant',
        agentId: 'researcher',
        content: '我从文档中找到了 3 条相关 API 变更。',
        createdAt: '2026-06-18T11:00:16',
      },
      {
        id: 'council-m2',
        role: 'assistant',
        agentId: 'writer',
        content: '建议将发布说明整理为按版本分组的 Markdown 列表。',
        createdAt: '2026-06-18T11:00:18',
        tools: [TOOL_SHOWCASE_ACCORDIONS[1]],
      },
      {
        id: 'council-m3',
        role: 'assistant',
        agentId: 'reviewer',
        content: '需要补充破坏性变更与迁移指南章节。',
        createdAt: '2026-06-18T11:00:20',
      },
    ],
  },
  {
    id: 'msg-types-task',
    role: 'task',
    agentId: 'code',
    content: '',
    createdAt: '2026-06-18T11:00:20',
    metadata: {
      taskTitle: '抓取 Changelog 页面',
      instruction: '打开 https://example.com/changelog 并提取最新三个版本的变更说明。',
    },
    taskDetail: {
      status: 'Processing',
      title: '抓取 Changelog 页面',
      threadId: 'thread-task-demo',
      startTime: Date.now() - 83_000,
      totalToolCalls: 5,
    },
    taskThreadMessages: [
      {
        id: 'task-demo-tm1',
        role: 'assistant',
        children: TASK_THREAD_BLOCKS,
      },
    ],
  },
  {
    id: 'msg-types-tool',
    role: 'tool',
    content: '',
    createdAt: '2026-06-18T11:00:30',
    tool: TOOL_SHOWCASE_ACCORDIONS[2],
  },
  {
    id: 'msg-types-verify',
    role: 'verify',
    content: '',
    createdAt: '2026-06-18T11:00:40',
    verifyOperationId: 'verify-demo-2',
    verifyTitle: '验证结果 #2',
    verifyAssertion: "assert page.title.includes('Changelog') — passed",
  },
  {
    id: 'msg-types-compressed',
    role: 'compressedGroup',
    content: '',
    createdAt: '2026-06-18T11:00:50',
    compressedSummary:
      '**摘要**：用户请求展示特殊消息类型；助手演示了 supervisor、council、verify 与压缩历史。',
    compressedExpanded: true,
    compressedMessages: [
      {
        id: 'cmp-u1',
        role: 'user',
        content: '之前讨论过哪些消息类型？',
        createdAt: '2026-06-18T10:50:00',
      },
      {
        id: 'cmp-a1',
        role: 'assistant',
        content: '包括 supervisor、task、verify、tool 与 compressedGroup。',
        createdAt: '2026-06-18T10:50:30',
      },
      {
        id: 'cmp-a2',
        role: 'assistant',
        content: 'AgentCouncil 用于多 Agent 横向对比输出。',
        createdAt: '2026-06-18T10:51:00',
      },
    ],
  },
  {
    id: 'msg-types-compressed-stream',
    role: 'compressedGroup',
    content: '正在生成压缩摘要…',
    createdAt: '2026-06-18T11:00:55',
    isGeneratingSummary: true,
    compressedSummary: '',
  },
  {
    id: 'msg-types-tasks',
    role: 'tasks',
    content: '',
    createdAt: '2026-06-18T11:01:00',
    tasks: [
      BATCH_TASK('batch-1', '抓取首页', 'Completed', 'code'),
      BATCH_TASK('batch-2', '解析 RSS', 'Processing', 'inbox'),
      BATCH_TASK('batch-3', '写入数据库', 'Failed', 'code'),
    ],
  },
  {
    id: 'msg-types-group-tasks',
    role: 'groupTasks',
    content: '',
    createdAt: '2026-06-18T11:01:30',
    tasks: [
      BATCH_TASK('group-1', '检索文档', 'Completed', 'code'),
      BATCH_TASK('group-2', '撰写摘要', 'Processing', 'inbox'),
      BATCH_TASK('group-3', '代码审查', 'Processing', 'rss'),
    ],
  },
];
