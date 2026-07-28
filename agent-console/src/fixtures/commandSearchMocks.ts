import type { CommandSearchResult } from '../domain/types/commandSearch';

/** Mock 索引条目 — 仅 catalogSearch 使用，供 §C.41 12 类型演示 */
export const COMMAND_SEARCH_EXTRA_MOCKS: CommandSearchResult[] = [
  {
    description: '用户偏好 · 2026-01-12',
    id: 'mem-pref-1',
    title: '代码风格偏好',
    type: 'memory',
  },
  {
    description: 'draft · 2026-03-01',
    id: 'page-doc-1',
    title: 'Agent Console 设计稿',
    type: 'page',
  },
  {
    description: 'linkloom/studio/src/App.tsx',
    id: 'file-app-tsx',
    title: 'App.tsx',
    type: 'file',
  },
  {
    description: 'docs/',
    id: 'folder-docs',
    title: '文档',
    type: 'folder',
  },
  {
    description: 'LinkLoom 产品知识',
    id: 'kb-linkloom',
    title: 'LinkLoom KB',
    type: 'knowledgeBase',
  },
  {
    description: 'filesystem',
    id: 'mcp-filesystem',
    identifier: 'filesystem',
    title: 'Filesystem MCP',
    type: 'mcp',
  },
  {
    description: 'linkloom-web-browsing',
    id: 'plugin-browsing',
    identifier: 'linkloom-web-browsing',
    title: '网页浏览',
    type: 'plugin',
  },
  {
    description: '社区助理',
    id: 'community-coder',
    identifier: 'coder',
    title: 'Coder Agent',
    type: 'communityAgent',
  },
];
