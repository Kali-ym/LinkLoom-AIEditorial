/** Extracted from index.html IIFE `SKILL_CATALOG` + agent dropdown + topic list. */

import type { SkillCatalog } from '../domain/types/skill';
import type { Topic, TopicThread } from '../domain/types/topic';

export type {
  AgentSkill,
  CatalogAgent,
  CatalogTool,
  ProjectSkill,
  SkillCatalog,
  SkillCommand,
  UserSkill,
} from '../domain/types/skill';
export type { Topic, TopicStatus, TopicThread } from '../domain/types/topic';

/** @deprecated use Topic from domain/types */
export type MockTopic = Topic;

/** @deprecated use TopicThread from domain/types */
export type MockThread = TopicThread;

/** index.html `SKILL_CATALOG` (lines ~3177–3203). */
export const SKILL_CATALOG: SkillCatalog = {
  commands: [
    { category: 'command', label: '开启新话题', type: 'newTopic', desc: '清空当前对话并回到空态' },
    { category: 'command', label: '压缩上下文', type: 'compact', desc: '压缩历史消息以节省 token' },
  ],
  agentSkills: [
    {
      id: 'agent-doc-linkloom',
      name: 'LinkLoom 接入',
      description: 'studio 包接入 @lobehub/ui 指南',
      fileCount: 3,
      files: ['SKILL.md', 'mapping.md', 'examples/studio.md'],
    },
    {
      id: 'agent-doc-rss',
      name: 'RSS 分析',
      description: '资讯聚合与摘要工作流',
      fileCount: 2,
      files: ['SKILL.md', 'prompts/summary.md'],
    },
  ],
  projectSkills: [
    { id: 'proj-fe', name: 'frontend-design', description: '前端设计规范与组件约束' },
    { id: 'proj-test', name: 'test-runner', description: '运行 monorepo 测试套件' },
  ],
  userSkills: [
    {
      id: 'linkloom-skills-web-browsing',
      name: '网页读取',
      description: '抓取与解析外部网页',
      source: 'market',
    },
    { id: 'user-summarize', name: '长文摘要', description: '用户自定义摘要技能', source: 'user' },
  ],
  tools: [
    { id: 'web-browsing', name: 'web-browsing', description: '网页抓取与搜索' },
    { id: 'linkloom-sandbox', name: 'linkloom-sandbox', description: '沙盒 shell 与文件操作' },
    { id: 'linkloom-artifacts', name: 'linkloom-artifacts', description: '创建与编辑文档产物' },
  ],
  agents: [
    { id: 'inbox', name: '收件箱助手', gradient: 'linear-gradient(135deg,#6366f1,#8b5cf6,#ec4899)' },
    { id: 'code', name: '代码助手', gradient: 'linear-gradient(135deg,#0ea5e9,#06b6d4)' },
    { id: 'group-collab', name: '团队协作', gradient: 'linear-gradient(135deg,#10b981,#3b82f6)' },
  ],
};

/** Topic list from index.html `#topicList`. */
export const MOCK_TOPICS: MockTopic[] = [
  { id: 'temp', title: '新话题', status: 'temp', tag: '临时', agentId: 'topic_copilot' },
  {
    id: 'skills',
    title: 'Agent 有哪些技能',
    status: 'completed',
    group: 'yesterday',
    active: true,
    agentId: 'topic_copilot',
    updatedAt: new Date(Date.now() - 86_400_000).toISOString(),
    createdAt: new Date(Date.now() - 86_400_000 * 2).toISOString(),
  },
  {
    id: 'changelog',
    title: '抓取 Changelog 页面',
    status: 'running',
    group: 'yesterday',
    elapsed: '01:23',
    workingDirectory: '~/linkloom/studio',
    updatedAt: new Date(Date.now() - 86_400_000).toISOString(),
    createdAt: new Date(Date.now() - 86_400_000 * 3).toISOString(),
  },
  {
    id: 'approval',
    title: '等待审批：web_browse',
    status: 'waiting',
    group: 'yesterday',
    updatedAt: new Date(Date.now() - 86_400_000 * 1.5).toISOString(),
  },
  {
    id: 'rss',
    title: 'RSS 订阅源整理',
    status: 'completed',
    group: 'earlier',
    updatedAt: new Date(Date.now() - 86_400_000 * 10).toISOString(),
  },
  {
    id: 'linkloom',
    title: 'LinkLoom 接入方案',
    status: 'unread',
    group: 'earlier',
    updatedAt: new Date(Date.now() - 86_400_000 * 12).toISOString(),
  },
  {
    id: 'failed',
    title: '部署失败排查',
    status: 'failed',
    group: 'earlier',
    updatedAt: new Date(Date.now() - 86_400_000 * 14).toISOString(),
  },
  {
    id: 'telegram',
    title: 'Telegram 频道同步',
    status: 'platform',
    group: 'earlier',
    platform: 'telegram',
    updatedAt: new Date(Date.now() - 86_400_000 * 20).toISOString(),
  },
  {
    id: 'msg-types',
    title: '消息类型示例',
    status: 'completed',
    group: 'earlier',
    updatedAt: new Date(Date.now() - 86_400_000 * 25).toISOString(),
  },
  {
    id: 'streaming-tools',
    title: 'StreamingRenderer 示例',
    status: 'completed',
    group: 'earlier',
    updatedAt: new Date(Date.now() - 86_400_000 * 26).toISOString(),
  },
  {
    id: 'render-tools',
    title: 'Builtin Render 完成态',
    status: 'completed',
    group: 'earlier',
    updatedAt: new Date(Date.now() - 86_400_000 * 27).toISOString(),
  },
  {
    id: 'fav-demo',
    title: '收藏话题示例',
    status: 'completed',
    fav: true,
    tag: 'fav',
    updatedAt: new Date().toISOString(),
  },
];

export const MOCK_THREADS: MockThread[] = [
  { id: 'main', label: '主对话', active: true },
  { id: 'branch-1', label: '分支：Changelog 深入分析' },
];
