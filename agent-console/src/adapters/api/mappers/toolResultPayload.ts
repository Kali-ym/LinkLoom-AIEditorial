import type { ToolPayload } from '../../../domain/types/tool';
import { enrichWebBrowsingPluginState } from './webBrowsingState';

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function enrichExecuteCommandPluginState(
  toolName: string,
  pluginState: unknown,
  args?: Record<string, unknown>,
): unknown {
  const normalized = toolName.trim().toLowerCase().replace(/-/g, '_');
  if (normalized !== 'execute_command') return pluginState;
  const base =
    pluginState && typeof pluginState === 'object' && !Array.isArray(pluginState)
      ? (pluginState as Record<string, unknown>)
      : {};
  const command =
    typeof base.command === 'string'
      ? base.command
      : typeof args?.command === 'string'
        ? args.command
        : undefined;
  return {
    ...base,
    ...(command ? { command } : {}),
    output: base.output ?? base.stdout,
    exitCode: base.exitCode ?? base.code,
  };
}

export function resolvePayloadPluginState(
  payload: Record<string, unknown>,
  toolName: string,
  args?: Record<string, unknown>,
): unknown {
  const data = payload.data;
  if (data === undefined || data === null) return undefined;
  const enrichedCommand = enrichExecuteCommandPluginState(toolName, data, args);
  return enrichWebBrowsingPluginState(toolName, enrichedCommand, args);
}

export function resolveToolErrorDisplay(
  payload: Record<string, unknown>,
  pluginState?: unknown,
): { error: string; resultContent?: string } {
  const error = asString(payload.error) || asString(payload.content) || '失败';
  if (!pluginState || typeof pluginState !== 'object') {
    return { error, resultContent: error !== '失败' ? error : undefined };
  }
  const ps = pluginState as Record<string, unknown>;
  const stderr = asString(ps.stderr);
  const stdout = asString(ps.stdout) || asString(ps.output);
  const exitCode = ps.exitCode ?? ps.code;
  const parts = [
    error !== '失败' ? error : '',
    stderr ? `stderr:\n${stderr}` : '',
    stdout ? `stdout:\n${stdout}` : '',
    exitCode != null && exitCode !== '' ? `exit code: ${exitCode}` : '',
  ].filter(Boolean);
  const resultContent = parts.length > 0 ? parts.join('\n\n') : error;
  return { error, resultContent };
}

export function buildAbandonedToolFeedback(tool: ToolPayload): Pick<
  ToolPayload,
  'error' | 'resultContent' | 'resultText' | 'pluginState'
> {
  const message = '命令未在 Agent 继续下一步之前返回执行结果（可能未实际执行）。';
  const args = (tool.arguments ?? tool.params) as Record<string, unknown> | undefined;
  const command = typeof args?.command === 'string' ? args.command : undefined;
  const path = typeof args?.path === 'string' ? args.path : undefined;
  const api = tool.apiName ?? tool.api;

  if (api === 'runCommand') {
    return {
      error: message,
      resultText: message,
      resultContent: message,
      pluginState: {
        ...(command ? { command } : {}),
        output: message,
      },
    };
  }

  if (api === 'writeFile') {
    return {
      error: message,
      resultText: message,
      resultContent: message,
      pluginState: path ? { path, error: message } : { error: message },
    };
  }

  return {
    error: message,
    resultText: message,
    resultContent: message,
  };
}
