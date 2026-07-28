import type { Message } from '../domain/types';

/** §C.15 demo — topic `changelog` running task with in-progress tool. */
export const CHANGELOG_DEMO_MESSAGES: Message[] = [
  {
    id: 'changelog-u1',
    role: 'user',
    content: '抓取 https://docs.example.com/changelog 并总结要点',
    createdAt: '2026-06-17T10:00:00',
  },
  {
    id: 'changelog-a1',
    role: 'assistant',
    content: '正在读取 Changelog 页面…',
    createdAt: '2026-06-17T10:00:05',
    tools: [
      {
        id: 'changelog-tool-1',
        toolCallId: 'tc_fetch_page',
        plugin: 'web-browsing',
        identifier: 'web-browsing',
        api: 'fetchPage',
        apiName: 'fetchPage',
        params: { url: 'https://docs.example.com/changelog', format: 'markdown' },
        state: 'executing',
      },
    ],
  },
];
