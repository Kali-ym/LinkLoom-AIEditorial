/** Portal view stack demos from index.html `mountPortalShowcase` + render payloads. */

export type {
  PortalShowcaseEntry,
  PortalViewPayload,
  PortalViewType,
} from '../domain/types/portalView';
export { portalTitle } from '../adapters/portalTitle';

import type { PortalShowcaseEntry, PortalViewPayload, PortalViewType } from '../domain/types/portalView';

export interface PortalShowcaseButton {
  type: PortalViewType;
  label: string;
}

/** Buttons rendered in `#portalShowcaseGrid`. */
export const PORTAL_SHOWCASE_BUTTONS: PortalShowcaseButton[] = [
  { type: 'Home', label: 'Home 默认' },
  { type: 'ToolUI', label: 'ToolUI' },
  { type: 'Artifact', label: 'Artifact' },
  { type: 'Document', label: 'Document' },
  { type: 'Notebook', label: 'Notebook' },
  { type: 'FilePreview', label: 'FilePreview' },
  { type: 'LocalFile', label: 'LocalFile' },
  { type: 'MessageDetail', label: 'MessageDetail' },
  { type: 'Thread', label: 'Thread' },
  { type: 'GroupThread', label: 'GroupThread' },
  { type: 'VerifyResult', label: 'VerifyResult' },
];

/** Default reset payloads from `mountPortalShowcase` click handlers. */
export const PORTAL_SHOWCASE_ENTRIES: PortalShowcaseEntry[] = [
  { type: 'Home', label: 'Home 默认', payload: {} },
  {
    type: 'ToolUI',
    label: 'Web Search',
    payload: {
      plugin: 'linkloom-web-browsing',
      api: 'search',
      args: { query: 'UI changelog' },
      state: 'success',
    },
  },
  {
    type: 'ToolUI',
    label: 'Delivery Checker',
    payload: {
      plugin: 'linkloom-delivery-checker',
      api: 'generateVerifyPlan',
      toolUIParams: { index: 0 },
      state: 'success',
    },
  },
  { type: 'Artifact', label: 'Artifact', payload: { title: 'React 组件预览' } },
  { type: 'Document', label: 'Document', payload: { title: '设计文档' } },
  { type: 'Notebook', label: 'Notebook', payload: {} },
  {
    type: 'FilePreview',
    label: 'FilePreview',
    payload: { path: 'studio/src/App.tsx', name: 'App.tsx' },
  },
  { type: 'LocalFile', label: 'LocalFile', payload: {} },
  {
    type: 'MessageDetail',
    label: 'MessageDetail',
    payload: {
      title: '消息详情',
      content: '<p>这是 MessageDetail 视图的完整 Markdown 正文演示。</p>',
    },
  },
  { type: 'Thread', label: 'Thread', payload: { title: '分支演示', threadId: 'branch-1' } },
  { type: 'GroupThread', label: 'GroupThread', payload: { agentId: 'inbox', title: '收件箱助手' } },
  {
    type: 'VerifyResult',
    label: 'VerifyResult',
    payload: {
      id: 1,
      assertion: 'assert true',
      passed: true,
      confidence: 0.88,
      verifier: 'custom',
    },
  },
];

/** `#openPortalBtn` / tool render tab default ToolUI payload. */
export const PORTAL_TOOLUI_CHANGELOG: PortalViewPayload = {
  plugin: 'linkloom-web-browsing',
  api: 'crawlSinglePage',
  title: '读取页面内容',
  url: 'https://docs.example.com/zh/changelog',
  state: 'success',
  duration: '1.2s',
  args: { url: 'https://docs.example.com/zh/changelog', format: 'markdown' },
  result: '# Changelog\n\n## v1.x\n- Agent 控制台优化\n- Portal view stack 支持',
};

/** Static conversation verify chip click payload. */
export const PORTAL_VERIFY_RESULT_2: PortalViewPayload = {
  id: 2,
  assertion: "assert page.title.includes('Changelog')",
  passed: true,
  confidence: 0.92,
  verifier: 'playwright',
  instruction: '确认页面标题包含 Changelog 关键词',
};

export const PORTAL_SHOWCASE_TITLE = 'Portal 抽屉视图（11 种 view stack）';
