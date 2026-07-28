import type { AIMessage } from '../../../types/index.js';
import type { AgentMessage } from '../engine/AgentRunSpec.js';
import { normalizeRuntimeMessageContent } from '../engine/responseContextCache.js';

interface PersistedToolCallRecord {
  id: string;
  name: string;
  arguments?: unknown;
  content?: string;
  data?: unknown;
  error?: string;
  success?: boolean;
}

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
        data: record.data,
        error: typeof record.error === 'string' ? record.error : undefined,
        success: record.success === false ? false : record.success === true ? true : undefined,
      },
    ];
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

/** Expand persisted assistant toolCalls into assistant + tool AIMessages for provider APIs. */
export function expandAgentMessageToRuntimeMessages(message: AgentMessage): AIMessage[] {
  if (message.role !== 'assistant') {
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
      },
    ];
  }

  const toolCalls = readPersistedToolCalls(message.metadata);
  const reasoning = readAssistantReasoning(message.metadata);
  const content = normalizeRuntimeMessageContent(message.content);
  const runtimeToolCalls = toolCalls.map((toolCall) => ({
    id: toolCall.id,
    name: toolCall.name,
    arguments: toolCall.arguments ?? {},
  }));

  const messages: AIMessage[] = [
    {
      role: 'assistant',
      content: content || null,
      name: message.name,
      reasoning,
      tool_calls: runtimeToolCalls.length > 0 ? runtimeToolCalls : undefined,
      raw_parts: Array.isArray(message.metadata?.rawParts) ? message.metadata.rawParts : undefined,
    },
  ];

  for (const toolCall of toolCalls) {
    messages.push({
      role: 'tool',
      tool_call_id: toolCall.id,
      name: toolCall.name,
      content: formatPersistedToolResult(toolCall),
    });
  }

  return messages;
}
