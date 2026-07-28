import type { Message } from '../domain/types';
import { threadBubblesToMessages } from '../domain/utils/threadBubbles';

export { threadBubblesToMessages };
export type { ThreadBubble } from '../domain/utils/threadBubbles';

/** §C.21 Portal thread fixture — 注入 messagesByTopicId */
export const PORTAL_THREAD_MESSAGES: Message[] = [
  {
    id: 'thread-u1',
    role: 'user',
    content: '请深入分析 Changelog 中与 Agent 相关的更新',
    createdAt: '13:01',
    threadId: 'branch-1',
  },
  {
    id: 'thread-a1',
    role: 'assistant',
    content:
      '已定位 3 条与 Agent 控制台相关的更新：Portal view stack、ChatMiniMap、StreamingHandler 优化。',
    createdAt: '13:02',
    threadId: 'branch-1',
  },
  {
    id: 'thread-u2',
    role: 'user',
    content: '帮我整理成接入 checklist',
    createdAt: '13:03',
    threadId: 'branch-1',
  },
  {
    id: 'thread-a2',
    role: 'assistant',
    content:
      '1. ThemeProvider 包裹\n2. 拆分 Conversation / Portal / WorkingSidebar\n3. mock SSE → 真后端',
    createdAt: '13:04',
    threadId: 'branch-1',
  },
];

/** GroupThread DM 演示消息 */
export const PORTAL_DM_MESSAGES: Message[] = [
  {
    id: 'dm-u1',
    role: 'user',
    content: '探索一下这个仓库的 Agent Console 目录结构',
    createdAt: '14:01',
    targetId: 'inbox',
  },
  {
    id: 'dm-a1',
    role: 'assistant',
    agentId: 'inbox',
    content: '已找到 `admin/src/pages/agentConsole/`，含 features/Portal、stores、adapters 三层。',
    createdAt: '14:02',
  },
  {
    id: 'dm-u2',
    role: 'user',
    content: 'Portal 有哪些子视图？',
    createdAt: '14:03',
    targetId: 'inbox',
  },
  {
    id: 'dm-a2',
    role: 'assistant',
    agentId: 'inbox',
    content: '共 11 种：Home、Artifact、Document、Notebook、FilePreview、LocalFile、MessageDetail、ToolUI、Thread、GroupThread、VerifyResult。',
    createdAt: '14:04',
  },
];
