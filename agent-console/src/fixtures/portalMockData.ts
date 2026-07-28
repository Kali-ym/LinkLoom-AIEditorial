import type { PortalViewPayload } from './showcasePortal';
import { PORTAL_TOOLUI_CHANGELOG } from './showcasePortal';

/** index.html `renderPortalHome` file cards */
export interface PortalHomeFile {
  path: string;
  name: string;
  meta: string;
}

export interface PortalHomeArtifact {
  id: string;
  title: string;
  meta: string;
}

export interface PortalNotebookDoc {
  title: string;
  meta: string;
}

export interface PortalGroupThreadItem {
  title: string;
  meta: string;
}

export interface PortalThreadBubble {
  role: 'user' | 'assistant';
  html: string;
}

export interface PortalLocalFileTab {
  label: string;
  content: string;
  dirty?: boolean;
}

export const PORTAL_HOME_FILES: PortalHomeFile[] = [
  { path: 'studio/src/App.tsx', name: 'App.tsx', meta: 'studio/src/App.tsx · 已修改' },
  {
    path: 'docs/studio-full-mock-design.md',
    name: 'studio-full-mock-design.md',
    meta: 'docs/ · 设计说明',
  },
];

export const PORTAL_HOME_ARTIFACT: PortalHomeArtifact = {
  id: 'linkloom-arch',
  title: 'LinkLoom 接入架构图',
  meta: 'linkloom-artifacts › createDocument',
};

export const PORTAL_HOME_TOOL = PORTAL_TOOLUI_CHANGELOG;

export const PORTAL_NOTEBOOK_DOCS: PortalNotebookDoc[] = [
  { title: '接入方案', meta: '3 个段落 · 更新于 10 分钟前' },
  { title: '组件映射', meta: '12 个区域 · 更新于 1 小时前' },
];

export const PORTAL_GROUP_THREADS: PortalGroupThreadItem[] = [
  { title: '探索代码库', meta: 'Subagent · 运行中' },
  { title: '撰写报告', meta: 'Subagent · 已完成' },
];

export const PORTAL_THREAD_BUBBLES: PortalThreadBubble[] = [
  { role: 'user', html: '请深入分析 Changelog 中与 Agent 相关的更新' },
  {
    role: 'assistant',
    html: '已定位 3 条与 Agent 控制台相关的更新：Portal view stack、ChatMiniMap、StreamingHandler 优化。',
  },
  { role: 'user', html: '帮我整理成接入 checklist' },
  {
    role: 'assistant',
    html: '1. ThemeProvider 包裹<br>2. 拆分 Conversation / Portal / WorkingSidebar<br>3. mock SSE → 真后端',
  },
];

export const PORTAL_LOCAL_FILE_TABS: PortalLocalFileTab[] = [
  {
    label: 'SKILL.md',
    content: '# LinkLoom 接入技能\n\n用于指导 studio/ 包 scaffold 与 @lobehub/ui 集成。',
    dirty: true,
  },
  { label: 'README.md', content: '# Studio\n\nVite + React Router + @lobehub/ui' },
  { label: 'config.json', content: '{\n  "devPort": 5174,\n  "apiBase": "/api"\n}' },
];

export const PORTAL_ARTIFACT_PREVIEW = {
  title: 'LinkLoom 接入架构图',
  description: 'studio/ → @lobehub/ui ThemeProvider → mock SSE → backend AgentService',
};

export const PORTAL_ARTIFACT_CODE = `export function LinkLoomStudio() {
  return (
    <ThemeProvider>
      <AgentConsole />
    </ThemeProvider>
  );
}`;

export const PORTAL_DOCUMENT_DEFAULT = {
  title: 'LinkLoom Studio 接入方案',
  paragraphs: [
    '在 studio/ 包中复用 @lobehub/ui 组件，按 component-mapping.md 拆分 React 组件树。',
    '第一阶段使用 mock SSE，第二阶段接入 backend AgentService.streamAgent。',
  ],
};

export const PORTAL_FILE_PREVIEW_DEFAULT = `// studio/src/App.tsx
import { ThemeProvider } from '@lobehub/ui';

export default function App() {
  return <ThemeProvider><AgentConsole /></ThemeProvider>;
}`;

const FILE_PREVIEW_BY_PATH: Record<string, string> = {
  'studio/src/App.tsx': PORTAL_FILE_PREVIEW_DEFAULT,
  'linkloom/studio/src/App.tsx': PORTAL_FILE_PREVIEW_DEFAULT,
  'linkloom/studio/src/features/WorkingSidebar/index.tsx': `// studio/src/features/WorkingSidebar/index.tsx
import { DraggablePanel } from '@lobehub/ui';

export default function WorkingSidebar() {
  return <DraggablePanel>...</DraggablePanel>;
}`,
  'docs/studio-full-mock-design.md': `# Studio Full Mock Design

Agent 控制台三栏布局与 Portal view stack 设计说明。`,
  'demo/preview.html': `<!DOCTYPE html>
<html lang="zh">
<head><meta charset="utf-8"><title>Portal HTML Preview</title></head>
<body><h1>HTML 预览演示</h1><p>§C.21 FilePreview · HtmlPreview</p></body>
</html>`,
};

export function getFilePreviewContent(path?: string, content?: string): string {
  if (content) return content;
  if (path && FILE_PREVIEW_BY_PATH[path]) return FILE_PREVIEW_BY_PATH[path];
  const fallbackPath = path || 'studio/src/App.tsx';
  return `// ${fallbackPath}\nimport { ThemeProvider } from '@lobehub/ui';\n\nexport default function App() {\n  return <ThemeProvider><AgentConsole /></ThemeProvider>;\n}`;
}

export function resolveDocumentContent(payload: PortalViewPayload): {
  title: string;
  paragraphs: string[];
} {
  const title = payload.title || PORTAL_DOCUMENT_DEFAULT.title;
  if (payload.content) {
    return { title, paragraphs: [payload.content] };
  }
  return { title, paragraphs: [...PORTAL_DOCUMENT_DEFAULT.paragraphs] };
}

export function resolveToolUIPayload(payload: PortalViewPayload): Required<
  Pick<PortalViewPayload, 'plugin' | 'api' | 'state' | 'args'>
> &
  PortalViewPayload {
  return {
    plugin: payload.plugin || 'web-browsing',
    api: payload.api || 'fetchPage',
    state: payload.state || 'success',
    args: payload.args || { url: payload.url, format: 'markdown' },
    ...payload,
  };
}
