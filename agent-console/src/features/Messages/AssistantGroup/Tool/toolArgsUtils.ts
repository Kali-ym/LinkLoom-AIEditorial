import type { ToolPayload } from '../../../../domain/types/tool';
import { safeParsePartialJSON } from '../../../../utils/safeParsePartialJSON';

export function resolveToolRequestArgs(tool: ToolPayload): string {
  if (tool.argumentsRaw) return tool.argumentsRaw;
  const args = tool.params ?? tool.arguments ?? tool.args;
  if (!args) return '{}';
  try {
    return JSON.stringify(args);
  } catch {
    return '{}';
  }
}

export function resolveToolIdentifier(tool: ToolPayload): string {
  return tool.identifier ?? tool.plugin ?? '';
}

export function resolveToolApiName(tool: ToolPayload): string {
  return tool.apiName ?? tool.api ?? '';
}

export function detectArgumentsStreaming(tool: ToolPayload, requestArgs: string): boolean {
  if (tool.isArgumentsStreaming) return true;
  try {
    JSON.parse(requestArgs || '{}');
    return false;
  } catch {
    return true;
  }
}

export function hasToolResult(tool: ToolPayload): boolean {
  return Boolean(tool.resultText?.trim());
}

export function parseToolArgs(tool: ToolPayload): Record<string, unknown> {
  const requestArgs = resolveToolRequestArgs(tool);
  if (detectArgumentsStreaming(tool, requestArgs)) {
    return safeParsePartialJSON(requestArgs);
  }
  try {
    const parsed = JSON.parse(requestArgs) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // fall through
  }
  const fallback = tool.params ?? tool.arguments ?? tool.args;
  return (fallback as Record<string, unknown>) ?? {};
}
