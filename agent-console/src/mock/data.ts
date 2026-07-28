/**
 * @deprecated Demo constants — prefer `adapters/mock/seeds` and `getAgentConsolePorts()`.
 * Types re-exported from domain for backward compatibility.
 */
import type { Agent, DocumentNode, TodoItem, WebPage } from '../domain/types';

export type MockAgent = Agent;
export type MockDocumentNode = DocumentNode;
export type MockWebPage = WebPage;

export const MOCK_AGENTS: MockAgent[] = [
  {
    id: 'topic_copilot',
    name: '选题 Copilot',
    description: '对话式 AI 辅助，基于选题数据 KV 智能推荐选题',
    gradient: 'linear-gradient(135deg, #6366f1, #8b5cf6, #ec4899)',
    isPrimary: true,
    consoleVisible: true,
    welcome:
      '你好，我是 **选题 Copilot**。你可以向我提问、创建任务，或使用 `@` 将任务分配给其他智能体。',
    openingQuestions: [
      '介绍一下你的能力',
      '帮我总结今天的 RSS 资讯',
      'LinkLoom 如何接入 Agent SSE？',
      '读取 changelog 并总结',
    ],
  },
  {
    id: 'super_admin',
    name: '超级管理员',
    description: 'LinkLoom 超级管理员：引导用户完成 admin 运维任务并实际执行（cron/评分/日报/工作流）',
    gradient: 'linear-gradient(135deg, #1e293b, #7c3aed, #f59e0b)',
    isPrimary: false,
    consoleVisible: true,
    welcome:
      '我是 **LinkLoom 超级管理员**,可以帮你创建定时任务、触发新闻评分、生成并发布日报、运行和审批工作流。告诉我你想做什么。',
    openingQuestions: [
      '帮我创建一个定时任务',
      '给未评分新闻评分',
      '生成今天的日报',
      '运行某个工作流',
    ],
  },
  {
    id: 'code',
    name: '代码助手',
    description: '编程与代码审查',
    gradient: 'linear-gradient(135deg, #0ea5e9, #06b6d4)',
    consoleVisible: false,
    welcome: '我是代码助手，可以帮你阅读代码、审查 PR、编写脚本。',
    openingQuestions: ['解释这段 TypeScript', '帮我写一个单元测试', 'Review 这个 PR'],
    isLocalSystemEnabled: true,
    workingDirectory: '~/linkloom/studio',
    repoType: 'git',
  },
  {
    id: 'group-collab',
    name: '团队协作',
    description: '多 Agent 群聊协作',
    gradient: 'linear-gradient(135deg, #10b981, #3b82f6)',
    consoleVisible: false,
    welcome: '这是一个群聊协作会话，可查看成员数量与督导消息。',
    openingQuestions: ['汇总各成员进展', '分配下一个任务'],
    sessionType: 'group',
    groupMembers: ['收件箱助手', '代码助手', '资讯分析'],
  },
  {
    id: 'design',
    name: '设计助手',
    description: 'UI 与设计系统',
    gradient: 'linear-gradient(135deg, #a855f7, #ec4899)',
    consoleVisible: false,
    welcome: '我可以帮你审查 UI、对齐设计规范。',
    openingQuestions: ['审查这个组件', '建议配色方案'],
  },
  {
    id: 'rss',
    name: '资讯分析',
    description: 'RSS 与资讯摘要',
    gradient: 'linear-gradient(135deg, #f59e0b, #ef4444)',
    consoleVisible: false,
    welcome: '我可以整理 RSS 订阅、生成资讯摘要与趋势分析。',
    openingQuestions: ['总结今日 RSS', '对比两篇文章观点', '提取关键词'],
  },
];

export const MOCK_TODOS: TodoItem[] = [
  { id: 't1', label: '解析用户意图与项目上下文', done: true, status: 'completed' },
  { id: 't2', label: '读取 Changelog 与 @lobehub/ui 文档', done: true, status: 'completed' },
  { id: 't3', label: '整理组件映射与接入路径', done: false, status: 'processing' },
  { id: 't4', label: '输出 LinkLoom studio 接入建议', done: false, status: 'todo' },
];

export const MOCK_DOCUMENTS: DocumentNode[] = [
  {
    id: 'docs',
    name: 'docs/design/agent-console',
    badge: '4',
    children: [
      { id: 'guide', name: 'LOBEHUB-USAGE-GUIDE.md', path: 'docs/design/agent-console/LOBEHUB-USAGE-GUIDE.md' },
      { id: 'plan', name: 'IMPLEMENTATION-PLAN.md', path: 'docs/design/agent-console/IMPLEMENTATION-PLAN.md' },
      { id: 'runbook', name: 'RUNBOOK.md', path: 'docs/design/agent-console/RUNBOOK.md' },
      { id: 'mapping', name: 'component-mapping.md', path: 'component-mapping.md' },
    ],
  },
  { id: 'skill', name: 'SKILL.md', path: '.agents/skills/web-browsing/SKILL.md' },
];

export const MOCK_WEB_PAGES: WebPage[] = [
  {
    id: 'w1',
    title: '@lobehub/ui Changelog',
    url: 'https://docs.example.com/changelog',
    updatedAt: '2026-06-18T08:00:00',
  },
  {
    id: 'w2',
    title: 'example/ui-lib',
    url: 'https://github.com/example/ui-lib',
    updatedAt: '2026-06-17T14:30:00',
  },
  {
    id: 'w3',
    title: 'LinkLoom Agent API',
    url: 'https://linkloom.local/docs/agent-api',
    updatedAt: '2026-06-16T10:00:00',
  },
];
