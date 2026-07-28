import type { ToolPayload } from '../../../domain/types';
import {
  TIME_MS_PER_SECOND,
  TOOL_FIRST_DETAIL_MAX_CHARS,
  WORKFLOW_PROSE_HEADLINE_MAX_CHARS,
} from './constants';
import { TOOL_API_DISPLAY_LABELS } from './toolApiDisplayNames';

const toTitleCase = (apiName: string): string =>
  apiName
    .replaceAll(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();

export const getToolDisplayName = (apiName: string): string =>
  TOOL_API_DISPLAY_LABELS[apiName] ?? toTitleCase(apiName);

export const shapeProseForWorkflowHeadline = (raw: string): string => {
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';
  if (trimmed.length <= WORKFLOW_PROSE_HEADLINE_MAX_CHARS) return trimmed;
  const slice = trimmed.slice(0, WORKFLOW_PROSE_HEADLINE_MAX_CHARS);
  const lastSpace = slice.lastIndexOf(' ');
  return `${(lastSpace > 40 ? slice.slice(0, lastSpace) : slice).trim()}…`;
};

export const getWorkflowSummaryText = (tools: ToolPayload[]): string => {
  const failed = tools.filter((t) => t.state === 'error').length;
  const total = tools.length;
  if (failed > 0) return `${total} 次技能调用 · ${failed} 失败`;
  return `${total} 次技能调用 · 已完成`;
};

export type WorkflowCompletionStatus = 'success' | 'error' | 'warning' | 'working';

export const isTerminalToolState = (state: ToolPayload['state'] | undefined): boolean =>
  state === 'success' ||
  state === 'error' ||
  state === 'warning' ||
  state === 'rejected' ||
  state === 'aborted';

export const getWorkflowCompletionStatus = (tools: ToolPayload[]): WorkflowCompletionStatus => {
  if (tools.some((t) => t.state === 'executing' || t.state === 'pending')) return 'working';
  if (tools.some((t) => !isTerminalToolState(t.state))) return 'working';
  if (tools.some((t) => t.state === 'error')) return 'error';
  if (tools.some((t) => t.state === 'warning')) return 'warning';
  return 'success';
};

export const getWorkflowStreamingHeadline = (tools: ToolPayload[], streaming: boolean): string => {
  if (!streaming) return getWorkflowSummaryText(tools);
  const active = tools.find((t) => t.state === 'executing' || t.state === 'pending');
  if (active?.customTitle) return active.customTitle;
  const apiName = active?.apiName ?? active?.api;
  if (apiName) return getToolDisplayName(apiName);
  const args = active?.args ?? active?.params;
  const firstArg = args ? Object.values(args).find((v) => typeof v === 'string') : undefined;
  if (typeof firstArg === 'string') {
    return firstArg.length > TOOL_FIRST_DETAIL_MAX_CHARS
      ? `${firstArg.slice(0, TOOL_FIRST_DETAIL_MAX_CHARS)}…`
      : firstArg;
  }
  return '处理中...';
};

export const formatWorkflowDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

export { TIME_MS_PER_SECOND };
