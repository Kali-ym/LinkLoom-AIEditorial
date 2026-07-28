import type { Message } from '../domain/types';

const LONG_PARAGRAPH =
  '这是一段用于演示 CollapsibleContent 折叠的长用户消息。'.repeat(12);

/** Demo messages for §C.10 extras — merged via adapter only. */
export const USER_MESSAGE_EXTRAS: Message[] = [
  {
    id: 'user-dm-demo',
    role: 'user',
    content: '这条消息仅对指定 Agent 可见（DM 演示）',
    createdAt: '12:58',
    text: '这条消息仅对指定 Agent 可见（DM 演示）',
    targetId: 'inbox',
  },
  {
    id: 'user-long-collapse',
    role: 'user',
    content: LONG_PARAGRAPH,
    createdAt: '12:59',
    text: LONG_PARAGRAPH,
    pageSelections: [
      {
        id: 'sel-1',
        pageId: 'page-changelog',
        content: '选区引用：@lobehub/ui Changelog 中 ThemeProvider 与 cssVar 迁移说明。',
      },
    ],
    imageList: [
      {
        id: 'img-1',
        url: 'https://avatars.githubusercontent.com/u/131470832?s=200&v=4',
        alt: 'LinkLoom',
      },
    ],
    fileList: [
      {
        id: 'file-1',
        name: 'component-mapping.md',
        url: '#',
        size: 12_400,
      },
    ],
  },
];
