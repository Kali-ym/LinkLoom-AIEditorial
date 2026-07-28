import { banSvg, checkSvg, handSvg, pauseSvg, warnSvg, xSvg } from './icons';
import { escapeHtml } from './htmlUtils';
import type { ToolPayload, ToolState } from '../../domain/types/tool';

export const TOOL_DEMO_STATES: ToolState[] = [
  'executing',
  'pending',
  'success',
  'error',
  'warning',
  'rejected',
  'aborted',
];

export function buildToolStatusHtml(state: ToolState | string = 'success'): string {
  const cls = `tool-status ${state || 'success'}`;
  let inner = checkSvg;
  if (state === 'executing') inner = '<span class="tool-status-spinner"></span>';
  else if (state === 'pending') inner = handSvg;
  else if (state === 'error') inner = xSvg;
  else if (state === 'warning') inner = `${checkSvg}<span class="warning-badge">${warnSvg}</span>`;
  else if (state === 'rejected') inner = banSvg;
  else if (state === 'aborted') inner = pauseSvg;
  return `<span class="${cls}">${inner}</span>`;
}

export function formatToolTitleHtml(tool: ToolPayload): string {
  if (tool.customTitle) return escapeHtml(tool.customTitle);
  const plugin = tool.plugin || tool.identifier || 'plugin';
  const api = tool.api || tool.apiName || 'api';
  const params = tool.params || tool.arguments || {};
  let html =
    `<span class="plugin-name">${escapeHtml(plugin)}</span>` +
    '<span class="tool-chevron">›</span>' +
    `<span class="api-name">${escapeHtml(api)}</span>`;
  const keys = Object.keys(params);
  if (keys.length > 0) {
    const k = keys[0];
    let val = String(params[k]);
    if (val.length > 50) val = `${val.slice(0, 50)}...`;
    html +=
      `<span class="param-key"> (</span><span class="param-key">${escapeHtml(k)}:</span> ` +
      `<span class="param-val">${escapeHtml(val)}</span><span class="param-key">)</span>`;
  }
  return html;
}

export function buildToolDetailHtml(tool: ToolPayload): string {
  const args = tool.params || tool.arguments || tool.args || { url: tool.url || 'https://example.com' };
  const argsJson = JSON.stringify(args, null, 2);
  const resultText = tool.resultText || (tool.state === 'error' ? '' : '工具执行完成。');
  let banner = '';
  if (tool.state === 'error') {
    banner = `<div class="tool-response-banner error">错误：${escapeHtml(tool.error || 'Tool execution failed')}</div>`;
  } else if (tool.state === 'rejected') {
    banner = `<div class="tool-response-banner rejected">已拒绝：${escapeHtml(tool.rejectedReason || '用户拒绝了此工具调用')}</div>`;
  } else if (tool.state === 'aborted') {
    banner = '<div class="tool-response-banner aborted">工具调用已终止</div>';
  }
  const portalBtn =
    tool.state === 'success' && !tool.hidePortal
      ? '<button class="btn btn-ghost open-portal-btn" style="font-size:12px;padding:4px 10px" type="button">在 Portal 中查看详情 →</button>'
      : '';
  const debug =
    tool.debug ??
    `toolCallId: ${tool.id || 'tc_demo'}\nidentifier: ${tool.plugin || tool.identifier || ''}\napiName: ${tool.api || tool.apiName || ''}\nstate: ${tool.state || 'success'}`;
  const bodyHtml = resultText
    ? `<div class="tool-result-text">${escapeHtml(resultText)}</div>${portalBtn}`
    : `<pre class="tool-args-pre">${escapeHtml(argsJson)}</pre>`;
  return (
    banner +
    `<div class="tool-detail-body">${bodyHtml}</div>` +
    `<pre class="tool-debug-panel">${escapeHtml(debug)}</pre>`
  );
}

export function buildToolAccordionHtml(
  tool: ToolPayload,
  opts: { open?: boolean; showActions?: boolean } = {},
): string {
  const state = tool.state || 'success';
  const executing = state === 'executing';
  const isOpen = opts.open || executing;
  const titleClass = `tool-title-line${executing ? ' shiny' : ''}`;
  const duration = executing
    ? '0.0s'
    : `${tool.duration || '1.2'}${String(tool.duration ?? '').includes('s') ? '' : 's'}`;
  const showActions = opts.showActions !== false && !executing && state !== 'pending';
  const actionsHtml = showActions
    ? '<span class="tool-head-actions">' +
      '<button class="tool-action-btn" type="button" title="切换渲染视图" data-tool-action="toggle-render"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M3 9h18"></path></svg></button>' +
      '<button class="tool-action-btn" type="button" title="Debug 面板" data-tool-action="toggle-debug"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"></path></svg></button>' +
      '<button class="tool-action-btn" type="button" title="插件设置" data-tool-action="settings"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path></svg></button>' +
      '<button class="tool-action-btn danger" type="button" title="删除工具调用" data-tool-action="delete"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>' +
      '</span>'
    : '';
  return (
    `<div class="tool-accordion accordion${isOpen ? ' open' : ''}" data-type="tool">` +
    '<div class="tool-head">' +
    `<button class="accordion-head tool-head-toggle" type="button" aria-expanded="${isOpen ? 'true' : 'false'}">` +
    '<span class="accordion-chevron"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg></span>' +
    '<span class="tool-head-main">' +
    buildToolStatusHtml(state) +
    `<span class="${titleClass}">${formatToolTitleHtml(tool)}</span>` +
    `<span class="tool-duration">${duration}</span>` +
    '</span></button>' +
    actionsHtml +
    '</div>' +
    `<div class="accordion-body"><div class="tool-detail">${buildToolDetailHtml(tool)}</div></div></div>`
  );
}

export function buildWorkflowHtml(
  tools: ToolPayload[],
  opts: { open?: boolean; streaming?: boolean; duration?: string } = {},
): string {
  const streaming = opts.streaming ?? false;
  const open = opts.open !== false;
  const completed = tools.every((t) => t.state === 'success' || t.state === 'warning');
  const hasError = tools.some((t) => t.state === 'error');
  const hasPending = tools.some((t) => t.state === 'pending');
  const wfState: ToolState = streaming
    ? 'executing'
    : hasPending
      ? 'pending'
      : hasError
        ? 'error'
        : tools.some((t) => t.state === 'warning')
          ? 'warning'
          : 'success';
  const titleText = streaming
    ? `${tools.length} 次工具调用`
    : completed
      ? `${tools.length} 次工具调用 · 已完成`
      : '正在执行工具调用…';
  const titleClass = `workflow-title${streaming ? ' shiny' : ''}`;
  const duration = opts.duration || '3.4s';
  const toolsHtml = tools
    .map((t) => buildToolAccordionHtml(t, { open: streaming, showActions: !streaming }))
    .join('');
  return (
    `<div class="workflow-block${open ? ' open' : ''}" data-type="workflow">` +
    `<button class="workflow-head" type="button" aria-expanded="${open ? 'true' : 'false'}">` +
    '<span class="workflow-head-main">' +
    buildToolStatusHtml(wfState) +
    `<span class="${titleClass}">${escapeHtml(titleText)}</span>` +
    `<span class="workflow-duration">${duration}</span>` +
    '</span>' +
    '<span class="accordion-chevron"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg></span>' +
    '</button>' +
    `<div class="workflow-body" style="display:${open ? 'block' : 'none'}">${toolsHtml}</div></div>`
  );
}
