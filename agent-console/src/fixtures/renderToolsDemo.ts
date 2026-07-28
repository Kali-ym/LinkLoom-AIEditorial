import type { ToolPayload } from '../domain/types/tool';

/** §C.45 — 完成态 Builtin Render demo fixtures */
export const RENDER_TOOL_DEMOS: ToolPayload[] = [
  {
    apiName: 'Bash',
    arguments: { command: 'pnpm typecheck' },
    identifier: 'claude-code',
    plugin: 'claude-code',
    pluginState: { exitCode: 0, output: 'Done in 4.2s', command: 'pnpm typecheck' },
    resultContent: 'Done in 4.2s',
    state: 'success',
    toolCallId: 'render-bash',
  },
  // 新建文件 — 全绿 +
{
  apiName: 'writeFile',
  identifier: 'linkloom-local-system',
  plugin: 'linkloom-local-system',
  arguments: {
    path: 'admin/src/components/SidebarNav.tsx',
    content: 'import { NavItem } from "./NavItem";\n\nexport function SidebarNav() {\n  return <nav />;\n}\n',
  },
  state: 'success',
  toolCallId: 'render-write',
},
// 修改文件 — 红删绿增
{
  apiName: 'editFile',
  identifier: 'linkloom-local-system',
  plugin: 'linkloom-local-system',
  arguments: {
    path: 'admin/src/components/SidebarNav.tsx',
    old_string: "import { isAgentSubRoute } from '../../constants/agentConsoleRoutes';",
    new_string: "import { agentConsoleTopicsPath } from '../../constants/agentConsoleRoutes';",
  },
  state: 'success',
  toolCallId: 'render-edit',
},
// claude-code 的 Write / Edit 同理，identifier 改为 'claude-code'，apiName 用 'Write' / 'Edit'，字段用 file_path
  {
    apiName: 'TodoWrite',
    arguments: {
      todos: [
        { content: '搭建 Render registry', status: 'completed' },
        { content: '接入 ToolDetail', status: 'in_progress', activeForm: '运行 typecheck' },
        { content: '更新 GAPS', status: 'pending' },
      ],
    },
    identifier: 'claude-code',
    plugin: 'claude-code',
    state: 'success',
    toolCallId: 'render-todo',
  },
  {
    apiName: 'runCommand',
    arguments: { command: 'ls -la' },
    identifier: 'linkloom-local-system',
    plugin: 'linkloom-local-system',
    pluginState: { output: 'README.md\npackage.json\nsrc/' },
    resultContent: 'README.md\npackage.json\nsrc/',
    state: 'success',
    toolCallId: 'render-local-cmd',
  },
  {
    apiName: 'mcp__claude_ai_Linear__get_issue',
    identifier: 'claude-code',
    plugin: 'claude-code',
    pluginState: {
      title: 'Agent Console §C.45',
      identifier: 'LIN-451',
      status: 'In Progress',
      type: 'Issue',
      fields: [
        { label: 'Priority', value: 'High' },
        { label: 'Assignee', value: 'LinkLoom' },
      ],
      description: 'Builtin Render 全表 151 项完成态接线。',
    },
    resultContent: '{"title":"Agent Console §C.45"}',
    state: 'success',
    toolCallId: 'render-linear',
  },
  {
    apiName: 'generateVerifyPlan',
    identifier: 'linkloom-delivery-checker',
    plugin: 'linkloom-delivery-checker',
    pluginState: {
      standard: 'Admin Agent Console parity',
      criteria: [
        { name: 'Render registry 151 entries', required: true },
        { name: 'ToolDetail → ToolRender', required: true },
        { name: 'typecheck pass', required: false },
      ],
    },
    state: 'success',
    toolCallId: 'render-verify',
  },
];

export const RENDER_TOOLS_DEMO_MESSAGES = [
  {
    id: 'render-tools-u1',
    role: 'user' as const,
    content: '展示 Builtin Render 完成态（§C.45）',
    createdAt: '2026-06-19T11:00:00',
  },
  {
    id: 'render-tools-a1',
    role: 'assistant' as const,
    content: '以下为完成态 Render：Bash+pluginState、TodoWrite、local-system runCommand、Linear MCP、generateVerifyPlan。',
    createdAt: '2026-06-19T11:00:10',
    tools: RENDER_TOOL_DEMOS,
  },
];
