/** Reasoning showcase blocks from index.html `#reasoningShowcase`. */

export interface ReasoningShowcaseBlock {
  id?: string;
  label: string;
  thinking: boolean;
  open: boolean;
  duration?: string;
  content: string;
  /** When set, demo cycles through streaming chunks (live demo). */
  streamChunks?: string[];
}

export const REASONING_DEMO_FULL_TEXT =
  '用户询问技能并提供了 Changelog 链接，需要先理解意图，再决定是否抓取页面。';

export const REASONING_SHOWCASE_BLOCKS: ReasoningShowcaseBlock[] = [
  {
    id: 'reasoningDemoLive',
    label: '思考中…',
    thinking: true,
    open: true,
    content: REASONING_DEMO_FULL_TEXT,
    streamChunks: REASONING_DEMO_FULL_TEXT.match(/.{1,4}/g) ?? [REASONING_DEMO_FULL_TEXT],
  },
  {
    label: '已深度思考（1.1s）',
    thinking: false,
    open: false,
    duration: '1.1',
    content: '已完成态默认折叠；点击展开后 Atom 图标变为紫色（对齐 StatusIndicator）。',
  },
  {
    label: '已深度思考（2.4s）· 长内容',
    thinking: false,
    open: false,
    duration: '2.4',
    content: [
      '第 1 步：解析用户意图与上下文引用。',
      '第 2 步：评估是否需要调用 web-browsing 工具抓取外部页面。',
      '第 3 步：若抓取成功，提取 Changelog 中与 @lobehub/ui 相关的条目。',
      '第 4 步：结合 Agent 技能列表组织结构化回答。',
      '第 5 步：检查回答是否覆盖用户关心的组件与接入方式。',
      '第 6 步：补充右侧工作面板可查看的技能与文档入口。',
      '（面板最大高度 min(40vh, 320px)，超出可滚动 — 对齐 ScrollArea）',
    ].join('\n\n'),
  },
];

export const REASONING_SHOWCASE_TITLE =
  'Reasoning 状态示例（思考中 / 已完成 / 长内容滚动）';
