import type { AIMessage } from '../../../types/index.js';
import type { AgentMessage } from '../engine/AgentRunSpec.js';
import { normalizeRuntimeMessageContent } from '../engine/responseContextCache.js';
import { CANONICAL_MESSAGE_SERIALIZATION_VERSION } from '../engine/canonicalMessageSerializer.js';
import { isLegacyResultBearingToolCall } from '../engine/runtimeHistoryRehydrator.js';

interface PersistedToolCallRecord {
  id: string;
  name: string;
  arguments?: unknown;
  content?: string;
  canonicalMessageContent?: string;
  data?: unknown;
  error?: string;
  success?: boolean;
}

type PersistedTurnSegment =
  | { kind: 'reasoning'; text?: string }
  | { kind: 'text'; text?: string }
  | { kind: 'tool'; toolCallId?: string }
  | { kind: 'tools'; toolCallIds?: string[] };

function readPersistedToolCalls(metadata: AgentMessage['metadata']): PersistedToolCallRecord[] {
  if (!metadata?.toolCalls || !Array.isArray(metadata.toolCalls)) return [];
  return metadata.toolCalls.flatMap((raw) => {
    if (!raw || typeof raw !== 'object') return [];
    const record = raw as Record<string, unknown>;
    const id = typeof record.id === 'string' ? record.id.trim() : '';
    const name = typeof record.name === 'string' ? record.name.trim() : '';
    if (!id || !name) return [];
    return [
      {
        id,
        name,
        arguments: record.arguments,
        content: typeof record.content === 'string' ? record.content : undefined,
        canonicalMessageContent:
          typeof record.canonicalMessageContent === 'string'
            ? record.canonicalMessageContent
            : undefined,
        data: record.data,
        error: typeof record.error === 'string' ? record.error : undefined,
        success: record.success === false ? false : record.success === true ? true : undefined,
      },
    ];
  });
}

function readTurnSegments(metadata: AgentMessage['metadata']): PersistedTurnSegment[] {
  if (!metadata?.turnSegments || !Array.isArray(metadata.turnSegments)) return [];
  return metadata.turnSegments.flatMap((raw): PersistedTurnSegment[] => {
    if (!raw || typeof raw !== 'object') return [];
    const record = raw as Record<string, unknown>;
    const kind = record.kind;
    if (kind === 'reasoning' || kind === 'text') {
      return [{ kind, text: typeof record.text === 'string' ? record.text : undefined }];
    }
    if (kind === 'tool') {
      return [
        {
          kind,
          toolCallId:
            typeof record.toolCallId === 'string' ? record.toolCallId : undefined,
        },
      ];
    }
    if (kind === 'tools' && Array.isArray(record.toolCallIds)) {
      return [
        {
          kind,
          toolCallIds: record.toolCallIds.filter(
            (id): id is string => typeof id === 'string' && id.trim().length > 0,
          ),
        },
      ];
    }
    return [];
  });
}

function readAssistantReasoning(metadata: AgentMessage['metadata']): string | undefined {
  const parts: string[] = [];
  const before = metadata?.reasoning;
  if (before && typeof before === 'object' && !Array.isArray(before)) {
    const text = (before as Record<string, unknown>).text;
    if (typeof text === 'string' && text.trim()) parts.push(text.trim());
  }
  const after = metadata?.reasoningAfter;
  if (after && typeof after === 'object' && !Array.isArray(after)) {
    const text = (after as Record<string, unknown>).text;
    if (typeof text === 'string' && text.trim()) parts.push(text.trim());
  }
  return parts.length > 0 ? parts.join('\n\n') : undefined;
}

function formatPersistedToolResult(toolCall: PersistedToolCallRecord): string {
  if (typeof toolCall.canonicalMessageContent === 'string') {
    return toolCall.canonicalMessageContent;
  }
  if (typeof toolCall.content === 'string' && toolCall.content.trim()) {
    return toolCall.content;
  }
  if (toolCall.data !== undefined) {
    try {
      return JSON.stringify(toolCall.data);
    } catch {
      return String(toolCall.data);
    }
  }
  if (typeof toolCall.error === 'string' && toolCall.error.trim()) {
    return JSON.stringify({ success: false, error: toolCall.error });
  }
  if (toolCall.success === false) {
    return JSON.stringify({ success: false, error: 'tool failed' });
  }
  return '{}';
}

function toRuntimeToolCall(toolCall: PersistedToolCallRecord) {
  return {
    id: toolCall.id,
    name: toolCall.name,
    arguments: toolCall.arguments ?? {},
  };
}

function toolCallCanonicalVersion(toolCall: PersistedToolCallRecord): string | undefined {
  return !isLegacyResultBearingToolCall(toolCall)
    ? CANONICAL_MESSAGE_SERIALIZATION_VERSION
    : undefined;
}

function buildToolCallMap(
  toolCalls: PersistedToolCallRecord[],
): Map<string, PersistedToolCallRecord> {
  return new Map(toolCalls.map((toolCall) => [toolCall.id, toolCall]));
}

function expandAssistantFromTurnSegments(
  message: AgentMessage,
  toolCalls: PersistedToolCallRecord[],
  turnSegments: PersistedTurnSegment[],
): AIMessage[] {
  const toolCallById = buildToolCallMap(toolCalls);
  const canonicalToolHistory =
    toolCalls.length === 0 ||
    toolCalls.every((toolCall) => !isLegacyResultBearingToolCall(toolCall));
  const rawParts = Array.isArray(message.metadata?.rawParts)
    ? message.metadata.rawParts
    : undefined;

  const messages: AIMessage[] = [];
  let pendingReasoning: string | undefined;
  let emittedText = false;

  const appendReasoning = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    pendingReasoning = pendingReasoning ? `${pendingReasoning}\n\n${trimmed}` : trimmed;
  };

  const pushToolRound = (roundToolCalls: PersistedToolCallRecord[]) => {
    if (roundToolCalls.length === 0) return;
    messages.push({
      role: 'assistant',
      content: null,
      name: message.name,
      reasoning: pendingReasoning,
      tool_calls: roundToolCalls.map(toRuntimeToolCall),
      canonical_message_version: canonicalToolHistory
        ? CANONICAL_MESSAGE_SERIALIZATION_VERSION
        : undefined,
    });
    pendingReasoning = undefined;
    for (const toolCall of roundToolCalls) {
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        name: toolCall.name,
        content: formatPersistedToolResult(toolCall),
        canonical_message_version: toolCallCanonicalVersion(toolCall),
      });
    }
  };

  for (const segment of turnSegments) {
    if (segment.kind === 'reasoning') {
      if (segment.text) appendReasoning(segment.text);
      continue;
    }
    if (segment.kind === 'text') {
      const text = segment.text?.trim() ?? '';
      if (!text) continue;
      emittedText = true;
      messages.push({
        role: 'assistant',
        content: text,
        name: message.name,
        reasoning: pendingReasoning,
        raw_parts: undefined,
        canonical_message_version: canonicalToolHistory
          ? CANONICAL_MESSAGE_SERIALIZATION_VERSION
          : undefined,
      });
      pendingReasoning = undefined;
      continue;
    }
    if (segment.kind === 'tool') {
      const toolCallId = segment.toolCallId?.trim();
      if (!toolCallId) continue;
      const toolCall = toolCallById.get(toolCallId);
      if (!toolCall) continue;
      pushToolRound([toolCall]);
      continue;
    }
    if (segment.kind === 'tools') {
      const roundToolCalls = (segment.toolCallIds ?? [])
        .map((toolCallId) => toolCallById.get(toolCallId))
        .filter((toolCall): toolCall is PersistedToolCallRecord => Boolean(toolCall));
      pushToolRound(roundToolCalls);
    }
  }

  const trailingContent = normalizeRuntimeMessageContent(message.content);
  if (!emittedText && trailingContent) {
    messages.push({
      role: 'assistant',
      content: trailingContent,
      name: message.name,
      reasoning: pendingReasoning,
      raw_parts: rawParts,
      canonical_message_version: canonicalToolHistory
        ? CANONICAL_MESSAGE_SERIALIZATION_VERSION
        : undefined,
    });
    pendingReasoning = undefined;
  } else if (rawParts && messages.length > 0) {
    let lastAssistantIndex = -1;
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index]?.role === 'assistant') {
        lastAssistantIndex = index;
        break;
      }
    }
    if (lastAssistantIndex >= 0) {
      messages[lastAssistantIndex] = {
        ...messages[lastAssistantIndex],
        raw_parts: rawParts,
      };
    }
  }

  return messages;
}

function expandAssistantFlat(
  message: AgentMessage,
  toolCalls: PersistedToolCallRecord[],
): AIMessage[] {
  const reasoning = readAssistantReasoning(message.metadata);
  const content = normalizeRuntimeMessageContent(message.content);
  const canonicalToolHistory =
    toolCalls.length === 0 ||
    toolCalls.every((toolCall) => !isLegacyResultBearingToolCall(toolCall));
  const runtimeToolCalls = toolCalls.map(toRuntimeToolCall);

  const messages: AIMessage[] = [
    {
      role: 'assistant',
      content: content || null,
      name: message.name,
      reasoning,
      tool_calls: runtimeToolCalls.length > 0 ? runtimeToolCalls : undefined,
      raw_parts: Array.isArray(message.metadata?.rawParts) ? message.metadata.rawParts : undefined,
      canonical_message_version: canonicalToolHistory
        ? CANONICAL_MESSAGE_SERIALIZATION_VERSION
        : undefined,
    },
  ];

  for (const toolCall of toolCalls) {
    messages.push({
      role: 'tool',
      tool_call_id: toolCall.id,
      name: toolCall.name,
      content: formatPersistedToolResult(toolCall),
      canonical_message_version: toolCallCanonicalVersion(toolCall),
    });
  }

  return messages;
}

/** Expand persisted assistant toolCalls into assistant + tool AIMessages for provider APIs. */
export function expandAgentMessageToRuntimeMessages(message: AgentMessage): AIMessage[] {
  if (message.role !== 'assistant') {
    const canonicalMessageVersion =
      typeof message.metadata?.canonicalMessageVersion === 'string'
        ? message.metadata.canonicalMessageVersion
        : undefined;
    return [
      {
        role: message.role,
        content:
          typeof message.content === 'string'
            ? message.content
            : JSON.stringify(message.content),
        name: message.name,
        tool_call_id: message.toolCallId,
        tool_calls: Array.isArray(message.metadata?.toolCalls)
          ? message.metadata.toolCalls
          : undefined,
        raw_parts: Array.isArray(message.metadata?.rawParts) ? message.metadata.rawParts : undefined,
        canonical_message_version: canonicalMessageVersion,
      },
    ];
  }

  const toolCalls = readPersistedToolCalls(message.metadata);
  const turnSegments = readTurnSegments(message.metadata);
  if (turnSegments.length > 0) {
    return expandAssistantFromTurnSegments(message, toolCalls, turnSegments);
  }
  return expandAssistantFlat(message, toolCalls);
}
