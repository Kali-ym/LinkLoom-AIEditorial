import type { GroundingData } from '../domain/types/grounding';

export type {
  StaticAssistantMessage,
  StaticReasoningBlock,
  StaticUserMessage,
  UserLinkCard,
  UserLinkLine,
} from '../domain/types/conversation';

import type {
  StaticAssistantMessage,
  StaticConversation,
  StaticUserMessage,
} from '../domain/types/conversation';

/** Changelog user bubble + `#assistantMsg` from index.html static conversation. */
export const STATIC_CHANGELOG_USER: StaticUserMessage = {
  id: 'user-changelog',
  time: '13:06',
  text: '看一下这个项目',
  linkCard: {
    url: 'https://docs.example.com/changelog',
    title: 'UI 更新日志',
    host: 'docs.example.com/changelog',
    letter: 'L',
  },
};

export const STATIC_CHANGELOG_GROUNDING: GroundingData = {
  searchQueries: ['UI changelog', '@lobehub/ui components'],
  citations: [
    {
      favicon: 'docs.example.com',
      title: '@lobehub/ui Changelog',
      url: 'https://docs.example.com/changelog',
    },
    {
      favicon: 'github.com',
      title: 'example/ui-lib — React component library',
      url: 'https://github.com/example/ui-lib',
    },
  ],
};

export const STATIC_ASSISTANT_MSG: StaticAssistantMessage = {
  id: 'assistantMsg',
  agentName: '收件箱助手',
  time: '13:08',
  grounding: STATIC_CHANGELOG_GROUNDING,
  reasoningBeforeTool: {
    id: 'reasoningBlock1',
    label: '已深度思考（1.1s）',
    duration: '1.1',
    thinking: false,
    open: false,
    paragraphs: [
      '用户询问技能并提供了 Changelog 链接，需要先理解意图，再决定是否抓取页面。',
    ],
  },
  tool: {
    customTitle: '读取页面内容：https://docs.example.com/changelog',
    plugin: 'web-browsing',
    api: 'fetchPage',
    params: { url: 'https://docs.example.com/changelog', format: 'markdown' },
    args: { url: 'https://docs.example.com/changelog', format: 'markdown' },
    state: 'success',
    duration: '1.2',
    resultText:
      '页面已抓取，包含 v2.x 组件更新、@lobehub/ui 新 API、ThemeProvider 变更等条目。',
    debug: `toolCallId: tc_fetch_001
identifier: web-browsing
apiName: fetchPage
state: success
durationMs: 1200`,
  },
  reasoningAfterTool: {
    id: 'reasoningBlock2',
    label: '已深度思考（1.3s）',
    duration: '1.3',
    thinking: false,
    open: false,
    paragraphs: [
      '页面内容已获取，现在结合用户问题组织结构化回答，突出技能列表与 Changelog 要点。',
    ],
  },
  markdown: {
    title: 'UI 更新日志 概览',
    intro: '根据页面内容，**@lobehub/ui v5.x** 近期主要更新包括：',
    bullets: [
      { term: 'ThemeProvider', detail: '支持 cssVar key 自定义，与 antd-style 深度集成' },
      { term: 'Accordion / ScrollArea', detail: '用于 Reasoning 与 Workflow 折叠面板' },
      { term: 'DraggablePanel', detail: '右侧工作面板可拖拽调宽（300–720px）' },
      { term: 'LoadingDots', detail: '流式输出时的加载动画组件' },
    ],
    footer:
      '我的可用技能包括：网页读取、代码分析、RSS 聚合、任务规划与多 Agent 协作。你可以在右侧「空间 › 技能」查看完整列表。',
  },
};

/** index.html 静态对话前序：技能问答 + 斐波那契（13:02–13:04） */
export const STATIC_PRELUDE_MESSAGES = [
  {
    user: {
      id: 'user-skills-q',
      time: '13:02',
      text: '介绍一下你的能力',
    },
    assistant: {
      agentName: '收件箱助手',
      time: '13:02',
      content:
        '我可以帮你做网页读取、代码分析、RSS 聚合、任务规划与多 Agent 协作。右侧「空间 › 技能」可查看完整列表。',
    },
  },
  {
    user: {
      id: 'user-fib',
      time: '13:04',
      text: '帮我写一个斐波那契数列函数',
    },
    assistant: {
      agentName: '收件箱助手',
      time: '13:04',
      content: `function fib(n: number): number {
  if (n <= 1) return n;
  let a = 0, b = 1;
  for (let i = 2; i <= n; i++) [a, b] = [b, a + b];
  return b;
}`,
      codeBlock: true,
    },
  },
] ;

export const STATIC_CONVERSATION: StaticConversation = {
  topicTitle: 'Agent 有哪些技能',
  prelude: STATIC_PRELUDE_MESSAGES,
  user: STATIC_CHANGELOG_USER,
  assistant: STATIC_ASSISTANT_MSG,
  followUpUser: {
    id: 'user-followup',
    time: '13:10',
    text: '你的聊天窗口中所能展现的功能与组件有哪些？请尽可能完整列出。',
  },
  followUpAssistant: {
    agentName: '收件箱助手',
    time: '13:11',
    content:
      '中间聊天区支持 Reasoning、Tool、Grounding、Workflow、流式正文、图片、消息操作栏等；右侧有 ChatMiniMap 可快速定位历史用户消息。',
  },
};
