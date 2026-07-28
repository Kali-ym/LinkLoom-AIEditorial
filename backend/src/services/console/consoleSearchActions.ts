export type ConsoleSearchActionType = 'page' | 'memory' | 'knowledgeBase' | 'plugin';

export interface ConsoleSearchActionDefinition {
  id: string;
  title: string;
  description: string;
  type: ConsoleSearchActionType;
  keywords: string[];
}

/** Static CommandMenu actions — server-side filter in V1. */
export const CONSOLE_SEARCH_ACTIONS: ConsoleSearchActionDefinition[] = [
  {
    id: 'action-resource',
    title: '资源',
    description: '知识库与文档',
    type: 'knowledgeBase',
    keywords: ['resource', 'library', '资源', '知识库'],
  },
  {
    id: 'action-memory',
    title: '记忆',
    description: '偏好与长期记忆',
    type: 'memory',
    keywords: ['memory', 'preferences', '记忆'],
  },
  {
    id: 'action-page',
    title: '文稿',
    description: '页面与文档草稿',
    type: 'page',
    keywords: ['page', 'document', '文稿'],
  },
  {
    id: 'action-settings',
    title: '设置',
    description: '打开控制台设置',
    type: 'plugin',
    keywords: ['settings', '设置', 'config'],
  },
  {
    id: 'action-new-topic',
    title: '新建话题',
    description: '在当前助手中创建新话题',
    type: 'plugin',
    keywords: ['topic', 'new topic', '话题', '新建话题'],
  },
];
