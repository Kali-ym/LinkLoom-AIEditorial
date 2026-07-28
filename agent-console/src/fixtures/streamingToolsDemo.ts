import type { ToolPayload } from '../domain/types/tool';

/** §C.43 StreamingRenderer demo tools — topic `streaming-tools` */
export const STREAMING_TOOL_DEMOS: ToolPayload[] = [
  {
    id: 'stream-run-cmd',
    identifier: 'linkloom-local-system',
    apiName: 'runCommand',
    customTitle: 'runCommand',
    state: 'executing',
    isArgumentsStreaming: true,
    argumentsRaw: '{"command": "pnpm typecheck && pnpm build"}',
    hasStreamingRenderer: true,
    renderDisplayControl: 'expand',
  },
  {
    id: 'stream-write-file',
    identifier: 'linkloom-local-system',
    apiName: 'writeFile',
    state: 'executing',
    isArgumentsStreaming: true,
    hasStreamingRenderer: true,
    renderDisplayControl: 'expand',
    params: {
      path: 'admin/src/components/SidebarNav.tsx',
      content: 'import { NavItem } from "./NavItem";\n',
    },
  },
  {
    id: 'stream-todo',
    identifier: 'claude-code',
    apiName: 'TodoWrite',
    customTitle: 'TodoWrite',
    state: 'executing',
    params: {
      todos: [
        { content: '读取 COMPONENT-INVENTORY §C.43', status: 'completed' },
        { content: '实现 StreamingRenderer registry', status: 'in_progress', activeForm: '编写 registry.ts' },
        { content: '更新 GAPS 与 typecheck', status: 'pending' },
      ],
    },
    hasStreamingRenderer: true,
    renderDisplayControl: 'expand',
  },
  {
    id: 'stream-create-doc',
    identifier: 'linkloom-agent-documents',
    apiName: 'createDocument',
    customTitle: 'createDocument',
    state: 'executing',
    params: {
      title: 'Agent Console 设计文档',
      content: '## StreamingRenderer\n\n按 identifier + apiName 注册流式 UI…',
    },
    hasStreamingRenderer: true,
    renderDisplayControl: 'expand',
  },
  {
    id: 'stream-init-page',
    identifier: 'linkloom-page-agent',
    apiName: 'initPage',
    customTitle: 'initPage',
    state: 'executing',
    params: {
      markdown: '# Release Notes\n\n- §C.43 Builtin StreamingRenderer\n- 27 apiName 注册\n',
    },
    hasStreamingRenderer: true,
    renderDisplayControl: 'expand',
  },
  {
    id: 'stream-update-prompt',
    identifier: 'linkloom-agent-builder',
    apiName: 'updatePrompt',
    customTitle: 'updatePrompt',
    state: 'executing',
    params: {
      prompt: '你是一名资深前端工程师，按上游参考实现 1:1 复刻 Agent Console UI。',
    },
    hasStreamingRenderer: true,
    renderDisplayControl: 'expand',
  },
  {
    id: 'stream-exec-code',
    identifier: 'linkloom-cloud-sandbox',
    apiName: 'executeCode',
    customTitle: 'executeCode',
    state: 'executing',
    params: {
      code: 'console.log("Hello StreamingRenderer");',
      language: 'javascript',
    },
    hasStreamingRenderer: true,
    renderDisplayControl: 'expand',
  },
];

export const STREAMING_TOOLS_DEMO_MESSAGES = [
  {
    id: 'streaming-tools-u1',
    role: 'user' as const,
    content: '展示 Builtin StreamingRenderer（§C.43）',
    createdAt: '2026-06-19T10:00:00',
  },
  {
    id: 'streaming-tools-a1',
    role: 'assistant' as const,
    content: '以下为 6 种代表性流式工具 UI：runCommand、TodoWrite、createDocument、initPage、updatePrompt、executeCode。',
    createdAt: '2026-06-19T10:00:10',
    tools: STREAMING_TOOL_DEMOS,
  },
];
