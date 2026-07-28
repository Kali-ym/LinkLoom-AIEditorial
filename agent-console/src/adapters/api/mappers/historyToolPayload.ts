import { enrichToolPayload } from '../../consoleDataMode';
import type { Message } from '../../../domain/types';
import type { ToolPayload } from '../../../domain/types/tool';
import type { AgentMessageContentPart } from '../types/messageParts';
import type { BackendAgentMessageDto } from '../types/message';
import { resolveLinkLoomToolIdentity } from './toolIdentityMapper';
import { isPermissionPauseToolError } from '../../../domain/utils/toolReference';
import {
  resolvePayloadPluginState,
  resolveToolErrorDisplay,
} from './toolResultPayload';

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function normalizeToolArguments(argumentsValue: unknown): Record<string, unknown> | undefined {
  if (argumentsValue === undefined || argumentsValue === null) return undefined;
  if (typeof argumentsValue === 'object' && !Array.isArray(argumentsValue)) {
    return argumentsValue as Record<string, unknown>;
  }
  return { input: argumentsValue };
}

function resolveMcpServerId(record: Record<string, unknown>): string | undefined {
  const direct = asString(record.mcpServerId);
  if (direct) return direct;
  const execution = asRecord(record.execution);
  const mcp = asRecord(execution?.mcp);
  return asString(mcp?.serverId) || undefined;
}

function formatDurationMs(durationMs: number): string {
  return `${(durationMs / 1000).toFixed(1)}s`;
}

function partPayload(part: AgentMessageContentPart): Record<string, unknown> {
  return {
    ...(asRecord(part.metadata) ?? {}),
    ...(asRecord(part.data) ?? {}),
  };
}

function resolveToolCallId(record: Record<string, unknown>, fallback?: string): string {
  return asString(record.toolCallId) || asString(record.id) || fallback || 'tool';
}

function resolveToolName(record: Record<string, unknown>): string {
  return asString(record.toolName) || asString(record.name) || asString(record.exposedName) || 'tool';
}

function buildBaseToolPayload(input: {
  toolCallId: string;
  toolName: string;
  exposedName?: string;
  mcpServerId?: string;
  arguments?: unknown;
  state?: ToolPayload['state'];
}): ToolPayload {
  const identity = resolveLinkLoomToolIdentity({
    toolName: input.toolName,
    exposedName: input.exposedName,
    mcpServerId: input.mcpServerId,
  });
  const args = normalizeToolArguments(input.arguments);
  return enrichToolPayload({
    id: input.toolCallId,
    toolCallId: input.toolCallId,
    identifier: identity.identifier,
    apiName: identity.apiName,
    api: identity.apiName,
    plugin: identity.plugin,
    state: input.state ?? 'executing',
    arguments: args,
    params: args,
  });
}

function resolveResultText(record: Record<string, unknown>, fallbackText?: string): string | undefined {
  const content = asString(record.content);
  if (content) return content;
  if (fallbackText) return fallbackText;

  const data = record.data;
  if (data === undefined || data === null) return undefined;
  if (typeof data === 'string') return data;
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}

function resolvePluginState(
  record: Record<string, unknown>,
  toolName: string,
  args?: Record<string, unknown>,
): unknown {
  return resolvePayloadPluginState(record, toolName, args);
}

function isPermissionPauseResult(record: Record<string, unknown>): boolean {
  const error = asString(record.error).toLowerCase();
  return record.success === false && error.includes('permission required');
}

function resolveObservationStatus(record: Record<string, unknown>): string | undefined {
  const data = asRecord(record.data);
  if (asString(data?.status)) return asString(data?.status);
  const content = asString(record.content);
  if (!content) return undefined;
  try {
    const parsed = JSON.parse(content) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return asString((parsed as Record<string, unknown>).status);
    }
  } catch {
    // ignore non-JSON tool payloads
  }
  return undefined;
}

function isUserDeniedResult(record: Record<string, unknown>): boolean {
  if (resolveObservationStatus(record) === 'user_denied') return true;
  const error = asString(record.error).toLowerCase();
  return record.success === false && error.includes('permission denied');
}

function applyToolResult(tool: ToolPayload, record: Record<string, unknown>, fallbackText?: string): ToolPayload {
  if (isPermissionPauseResult(record)) {
    return enrichToolPayload({
      ...tool,
      state: tool.intervention?.status === 'pending' ? 'executing' : tool.state ?? 'executing',
    });
  }
  if (isUserDeniedResult(record)) {
    const reason = asString(record.error) || '用户拒绝了此工具调用';
    return enrichToolPayload({
      ...tool,
      state: 'rejected',
      rejectedReason: reason,
      intervention: { status: 'resolved' },
      error: undefined,
    });
  }
  const success = record.success !== false && !asString(record.error);
  const state: ToolPayload['state'] = success ? 'success' : 'error';
  const resultText = resolveResultText(record, fallbackText);
  const durationMs = typeof record.durationMs === 'number' ? record.durationMs : undefined;
  const toolName = resolveToolName(record);
  const args = normalizeToolArguments(record.arguments ?? tool.arguments ?? tool.params);
  const pluginState = resolvePluginState(record, toolName, args);
  const errorDisplay =
    state === 'error' ? resolveToolErrorDisplay(record, pluginState) : undefined;

  return enrichToolPayload({
    ...tool,
    state,
    ...(state === 'success' ? { intervention: { status: 'resolved' as const } } : {}),
    ...(durationMs !== undefined ? { duration: formatDurationMs(durationMs) } : {}),
    ...(state === 'success'
      ? {
          ...(resultText ? { resultText, resultContent: resultText } : {}),
          ...(pluginState !== undefined ? { pluginState } : {}),
        }
      : {
          error: errorDisplay?.error ?? (asString(record.error) || resultText || '失败'),
          ...(pluginState !== undefined ? { pluginState } : {}),
          ...(errorDisplay?.resultContent
            ? { resultText: errorDisplay.resultContent, resultContent: errorDisplay.resultContent }
            : resultText
              ? { resultText, resultContent: resultText }
              : {}),
        }),
  });
}

function parseToolRoleContent(content: string): { text?: string; data?: unknown } {
  const trimmed = content.trim();
  if (!trimmed) return {};
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const record = parsed as Record<string, unknown>;
      const text = asString(record.content) || asString(record.summary);
      return {
        text: text || undefined,
        data: record.data ?? (text ? undefined : parsed),
      };
    }
    if (typeof parsed === 'string') return { text: parsed };
    return { text: trimmed, data: parsed };
  } catch {
    return { text: trimmed };
  }
}

export interface ToolResultRef {
  toolCallId: string;
  toolName?: string;
  content?: string;
  data?: unknown;
  success?: boolean;
  error?: string;
  durationMs?: number;
}

export function buildToolResultsIndex(messages: BackendAgentMessageDto[]): Map<string, ToolResultRef> {
  const index = new Map<string, ToolResultRef>();

  for (const message of messages) {
    if (message.role !== 'tool' || !message.toolCallId) continue;
    const parsed = typeof message.content === 'string' ? parseToolRoleContent(message.content) : {};
    index.set(message.toolCallId, {
      toolCallId: message.toolCallId,
      toolName: message.name,
      content: parsed.text,
      data: parsed.data,
      success: true,
    });
  }

  return index;
}

function mergeIndexedToolResult(tool: ToolPayload, result?: ToolResultRef): ToolPayload {
  if (!result) return tool;
  return applyToolResult(
    tool,
    {
      toolName: result.toolName,
      content: result.content,
      data: result.data,
      success: result.success,
      error: result.error,
      durationMs: result.durationMs,
    },
    result.content,
  );
}

function toolsFromMetadataToolCalls(
  metadata: Record<string, unknown> | undefined,
  toolResultsByCallId: Map<string, ToolResultRef>,
): { tools: ToolPayload[]; absorbedToolCallIds: string[] } {
  const raw = metadata?.toolCalls;
  if (!Array.isArray(raw) || raw.length === 0) {
    return { tools: [], absorbedToolCallIds: [] };
  }

  const tools: ToolPayload[] = [];
  const absorbedToolCallIds: string[] = [];

  for (const item of raw) {
    const record = asRecord(item);
    if (!record) continue;
    const toolCallId = resolveToolCallId(record);
    const success = record.success !== false && !asString(record.error);
    const state: ToolPayload['state'] = success ? 'success' : 'error';
    const durationMs = typeof record.durationMs === 'number' ? record.durationMs : undefined;
    const resultText = asString(record.content) || undefined;
    const tool = mergeIndexedToolResult(
      buildBaseToolPayload({
        toolCallId,
        toolName: resolveToolName(record),
        exposedName: asString(record.exposedName) || undefined,
        mcpServerId: resolveMcpServerId(record),
        arguments: record.arguments,
        state,
      }),
      toolResultsByCallId.get(toolCallId),
    );
    const enriched = applyToolResult(
      tool,
      {
        toolName: resolveToolName(record),
        content: resultText,
        data: record.data,
        success,
        error: asString(record.error) || undefined,
        durationMs,
      },
      resultText,
    );
    tools.push(enriched);
    if (toolResultsByCallId.has(toolCallId)) {
      absorbedToolCallIds.push(toolCallId);
    }
  }

  return { tools, absorbedToolCallIds };
}

function toolsFromContentParts(
  parts: AgentMessageContentPart[],
  toolResultsByCallId: Map<string, ToolResultRef>,
): { tools: ToolPayload[]; absorbedToolCallIds: string[] } {
  const byCallId = new Map<string, ToolPayload>();
  const absorbedToolCallIds = new Set<string>();

  for (const part of parts) {
    if (part.kind !== 'tool_call' && part.kind !== 'tool_result') continue;
    const record = partPayload(part);
    const toolCallId = resolveToolCallId(record);

    if (part.kind === 'tool_call') {
      byCallId.set(
        toolCallId,
        buildBaseToolPayload({
          toolCallId,
          toolName: resolveToolName(record),
          exposedName: asString(record.exposedName) || undefined,
          mcpServerId: resolveMcpServerId(record),
          arguments: record.arguments,
          state: 'executing',
        }),
      );
      continue;
    }

    const existing =
      byCallId.get(toolCallId) ??
      buildBaseToolPayload({
        toolCallId,
        toolName: resolveToolName(record),
        exposedName: asString(record.exposedName) || undefined,
        mcpServerId: resolveMcpServerId(record),
      });
    byCallId.set(toolCallId, applyToolResult(existing, record, part.text));
    if (toolResultsByCallId.has(toolCallId)) {
      absorbedToolCallIds.add(toolCallId);
    }
  }

  const tools = [...byCallId.values()].map((tool) => {
    const key = tool.toolCallId ?? tool.id ?? '';
    const indexed = toolResultsByCallId.get(key);
    if (!indexed) return tool;
    absorbedToolCallIds.add(key);
    return mergeIndexedToolResult(tool, indexed);
  });

  return { tools, absorbedToolCallIds: [...absorbedToolCallIds] };
}

export function extractAssistantTools(
  message: BackendAgentMessageDto,
  toolResultsByCallId: Map<string, ToolResultRef>,
): { tools: ToolPayload[]; absorbedToolCallIds: string[] } {
  const fromParts =
    Array.isArray(message.content) && message.content.length > 0
      ? toolsFromContentParts(message.content, toolResultsByCallId)
      : { tools: [], absorbedToolCallIds: [] };

  const fromMetadata = toolsFromMetadataToolCalls(message.metadata, toolResultsByCallId);

  if (fromParts.tools.length === 0) {
    return fromMetadata;
  }
  if (fromMetadata.tools.length === 0) {
    return fromParts;
  }

  const merged = new Map<string, ToolPayload>();
  for (const tool of [...fromMetadata.tools, ...fromParts.tools]) {
    const key = tool.toolCallId ?? tool.id ?? '';
    const existing = merged.get(key);
    merged.set(key, existing ? { ...existing, ...tool } : tool);
  }

  return {
    tools: [...merged.values()],
    absorbedToolCallIds: [...new Set([...fromMetadata.absorbedToolCallIds, ...fromParts.absorbedToolCallIds])],
  };
}

export function applyPermissionPauseFromRunMetadata(
  tools: ToolPayload[],
  metadata?: Record<string, unknown>,
): ToolPayload[] {
  if (metadata?.stopReason !== 'permission_required') return tools;

  const pendingPermission = metadata.pendingPermission;
  const permissionId =
    pendingPermission &&
    typeof pendingPermission === 'object' &&
    !Array.isArray(pendingPermission) &&
    typeof (pendingPermission as Record<string, unknown>).permissionId === 'string'
      ? ((pendingPermission as Record<string, unknown>).permissionId as string)
      : undefined;

  return tools.map((tool) => {
    const paused =
      isPermissionPauseToolError(tool) ||
      (tool.state === 'error' &&
        `${tool.error ?? tool.resultText ?? ''}`.toLowerCase().includes('permission required'));
    if (!paused && tool.state !== 'executing') return tool;

    return enrichToolPayload({
      ...tool,
      permissionId: permissionId ?? tool.permissionId,
      intervention: { status: 'pending' },
      state: 'executing',
      error: undefined,
      customTitle: tool.customTitle ?? `等待批准：${tool.apiName ?? tool.api ?? 'tool'}`,
    });
  });
}

export function attachToolsToAssistantMessage(message: Message, tools: ToolPayload[]): Message {
  if (tools.length === 0) return message;
  if (tools.length === 1) {
    return { ...message, tool: tools[0], tools: undefined };
  }
  return { ...message, tools, tool: undefined };
}
