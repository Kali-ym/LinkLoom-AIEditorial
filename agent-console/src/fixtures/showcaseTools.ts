import type { ToolPayload } from '../domain/types/tool';
import { buildToolAccordionHtml, buildWorkflowHtml } from '../services/mock/toolBuilder';

/** Single-tool demos from index.html `mountToolShowcase`. */
export const TOOL_SHOWCASE_ACCORDIONS: ToolPayload[] = [
  {
    plugin: 'web-browsing',
    api: 'fetchPage',
    params: { url: 'https://docs.example.com/changelog' },
    state: 'executing',
  },
  {
    plugin: 'linkloom-sandbox',
    api: 'execute_shell',
    params: { command: 'npm run build' },
    state: 'pending',
  },
  {
    plugin: 'web-browsing',
    api: 'crawlSinglePage',
    params: { url: 'https://github.com/example/ui-lib' },
    state: 'success',
    duration: '1.2',
    resultText: '页面已抓取，包含 README 与 package.json 信息。',
  },
  {
    plugin: 'linkloom-artifacts',
    api: 'createDocument',
    params: { title: '接入方案' },
    state: 'error',
    error: 'API rate limit exceeded',
    resultText: '',
  },
  {
    plugin: 'linkloom-activator',
    api: 'activateTools',
    params: { tools: ['missing-tool'] },
    state: 'warning',
    duration: '0.8',
    resultText: '部分工具未找到，已激活 0 个。',
  },
  {
    plugin: 'linkloom-sandbox',
    api: 'write_file',
    params: { path: '/tmp/out.txt' },
    state: 'rejected',
    rejectedReason: '用户拒绝了文件写入',
  },
  {
    plugin: 'web-browsing',
    api: 'search',
    params: { query: 'UI changelog' },
    state: 'aborted',
  },
];

export const WORKFLOW_SHOWCASE_COMPLETED = {
  tools: [
    {
      plugin: 'web-browsing',
      api: 'search',
      params: { query: 'linkloom agent' },
      state: 'success' as const,
      duration: '0.9',
    },
    {
      plugin: 'web-browsing',
      api: 'crawlSinglePage',
      params: { url: 'https://github.com/...' },
      state: 'success' as const,
      duration: '1.4',
    },
    {
      plugin: 'linkloom-artifacts',
      api: 'createDocument',
      params: { title: '调研报告' },
      state: 'success' as const,
      duration: '0.6',
      resultText: '文档已创建。',
    },
  ],
  opts: { open: true, duration: '3.4s' },
};

export const WORKFLOW_SHOWCASE_STREAMING = {
  tools: [
    {
      plugin: 'web-browsing',
      api: 'search',
      params: { query: 'react streaming' },
      state: 'success' as const,
      duration: '0.8',
    },
    {
      plugin: 'linkloom-sandbox',
      api: 'execute_shell',
      params: { command: 'npm test' },
      state: 'executing' as const,
    },
    {
      plugin: 'linkloom-artifacts',
      api: 'updateDocument',
      params: { id: 'doc_1' },
      state: 'pending' as const,
    },
  ],
  opts: { open: true, streaming: true, duration: '2.1s' },
};

/** Pre-built HTML matching index.html `#toolDemoMount`. */
export function buildToolShowcaseHtml(): string {
  const parts = TOOL_SHOWCASE_ACCORDIONS.map((t) => buildToolAccordionHtml(t));
  parts.push(buildWorkflowHtml(WORKFLOW_SHOWCASE_COMPLETED.tools, WORKFLOW_SHOWCASE_COMPLETED.opts));
  parts.push(buildWorkflowHtml(WORKFLOW_SHOWCASE_STREAMING.tools, WORKFLOW_SHOWCASE_STREAMING.opts));
  return parts.join('');
}

export const TOOL_SHOWCASE_TITLE = '工具调用状态示例（单工具 / Workflow / 7 种状态）';
