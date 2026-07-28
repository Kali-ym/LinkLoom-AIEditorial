import type { Message } from '../../../domain/types';
import type { MessageFileItem, MessageImageItem } from '../../../domain/types';
import type { MessageRole } from '../../../domain/types/message';
import type { StaticReasoningBlock } from '../../../domain/types/conversation';
import type { BackendAgentMessageDto } from '../types/message';
import type { AgentMessageContentPart } from '../types/messageParts';
import {
  applyPermissionPauseFromRunMetadata,
  buildToolResultsIndex,
  extractAssistantTools,
} from './historyToolPayload';
import { attachTurnSegmentsFromMetadata } from './turnSegmentsFromHistory';
import { resolveConsoleApiUrl } from '../../../domain/connection/consoleConnection';

const VISIBLE_ROLES = new Set(['user', 'assistant', 'tool']);

function stringifyContent(content: BackendAgentMessageDto['content'] | null | undefined): string {
  if (content == null) return '';
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((part) => {
      if (part.kind === 'reasoning' || part.kind === 'tool_call' || part.kind === 'tool_result') {
        return '';
      }
      if (part.kind === 'text' && part.text) return part.text;
      if (part.text) return part.text;
      return '';
    })
    .filter(Boolean)
    .join('\n');
}

function reasoningBlockFromPart(
  part: AgentMessageContentPart,
  messageId: string,
  suffix = 'reasoning',
): StaticReasoningBlock | undefined {
  if (part.kind !== 'reasoning' || !part.text?.trim()) return undefined;
  const duration =
    typeof part.metadata?.durationSec === 'string'
      ? part.metadata.durationSec
      : typeof part.metadata?.durationSec === 'number'
        ? part.metadata.durationSec.toFixed(1)
        : '0.0';
  return {
    id: `${messageId}-${suffix}`,
    label: `已深度思考（${duration}s）`,
    duration,
    thinking: false,
    open: false,
    paragraphs: part.text.split(/\n\n+/).filter(Boolean),
  };
}

function reasoningBlockFromMetadata(
  metadata: Record<string, unknown> | undefined,
  key: 'reasoning' | 'reasoningAfter',
  messageId: string,
  suffix: string,
): StaticReasoningBlock | undefined {
  const reasoningMeta = metadata?.[key];
  if (!reasoningMeta || typeof reasoningMeta !== 'object') return undefined;
  const record = reasoningMeta as Record<string, unknown>;
  const text = typeof record.text === 'string' ? record.text : '';
  if (!text.trim()) return undefined;
  const duration =
    typeof record.durationSec === 'string'
      ? record.durationSec
      : typeof record.durationSec === 'number'
        ? record.durationSec.toFixed(1)
        : '0.0';
  return {
    id: `${messageId}-${suffix}`,
    label: `已深度思考（${duration}s）`,
    duration,
    thinking: false,
    open: false,
    paragraphs: text.split(/\n\n+/).filter(Boolean),
  };
}

function extractReasoningBeforeTool(
  content: BackendAgentMessageDto['content'],
  messageId: string,
  metadata?: Record<string, unknown>,
): StaticReasoningBlock | undefined {
  if (Array.isArray(content)) {
    const reasoningParts = content.filter((part) => part.kind === 'reasoning');
    if (reasoningParts[0]) {
      return reasoningBlockFromPart(reasoningParts[0], messageId, 'reasoning-1');
    }
  }

  return reasoningBlockFromMetadata(metadata, 'reasoning', messageId, 'reasoning-1');
}

function extractReasoningAfterTool(
  content: BackendAgentMessageDto['content'],
  messageId: string,
  metadata?: Record<string, unknown>,
): StaticReasoningBlock | undefined {
  if (Array.isArray(content)) {
    const reasoningParts = content.filter((part) => part.kind === 'reasoning');
    if (reasoningParts.length > 1 && reasoningParts[1]) {
      return reasoningBlockFromPart(reasoningParts[1], messageId, 'reasoning-2');
    }
  }

  return reasoningBlockFromMetadata(metadata, 'reasoningAfter', messageId, 'reasoning-2');
}

function mapRole(role: BackendAgentMessageDto['role']): MessageRole | null {
  if (role === 'user') return 'user';
  if (role === 'assistant') return 'assistant';
  if (role === 'tool') return 'tool';
  return null;
}

function resolveApiUrl(path: string): string {
  return resolveConsoleApiUrl(path);
}

function normalizeImageList(value: unknown): MessageImageItem[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const items = value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    const id = typeof record.id === 'string' ? record.id : '';
    const url = typeof record.url === 'string' ? record.url : '';
    if (!id || !url) return [];
    return [
      {
        alt: typeof record.alt === 'string' ? record.alt : undefined,
        id,
        url: url.startsWith('http') ? url : resolveApiUrl(url),
      },
    ];
  });
  return items.length > 0 ? items : undefined;
}

function normalizeFileList(value: unknown): MessageFileItem[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const items = value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    const id = typeof record.id === 'string' ? record.id : '';
    const name = typeof record.name === 'string' ? record.name : '';
    if (!id || !name) return [];
    const url = typeof record.url === 'string' ? record.url : undefined;
    return [
      {
        fileType: typeof record.fileType === 'string' ? record.fileType : undefined,
        id,
        name,
        size: typeof record.size === 'number' ? record.size : undefined,
        url: url ? (url.startsWith('http') ? url : resolveApiUrl(url)) : undefined,
      },
    ];
  });
  return items.length > 0 ? items : undefined;
}

function readUserTurnMetadata(metadata?: Record<string, unknown>) {
  if (!metadata) return {};
  return {
    editorData: metadata.editorData,
    fileList: normalizeFileList(metadata.fileList),
    imageList: normalizeImageList(metadata.imageList),
  };
}

function fallbackMessageId(
  message: BackendAgentMessageDto,
  index: number,
  sessionId: string,
): string {
  const runId =
    typeof message.metadata?.runId === 'string' ? message.metadata.runId : 'run';
  return message.id ?? `${sessionId}:${runId}:${index}`;
}

export function mapBackendMessageToDomain(
  message: BackendAgentMessageDto,
  index: number,
  sessionId: string,
  defaultThreadId?: string,
  options?: {
    toolResultsByCallId?: ReturnType<typeof buildToolResultsIndex>;
    absorbedToolCallIds?: Set<string>;
  },
): Message | null {
  const role = mapRole(message.role);
  if (!role || !VISIBLE_ROLES.has(role)) {
    return null;
  }

  const content = stringifyContent(message.content);
  const threadIdFromMeta = message.metadata?.threadId;
  const threadId =
    typeof threadIdFromMeta === 'string' && threadIdFromMeta.length > 0
      ? threadIdFromMeta
      : defaultThreadId;

  if (import.meta.env.DEV && !message.createdAt) {
    console.warn('[message mapper] missing createdAt for message', message.id ?? index);
  }

  const messageId = fallbackMessageId(message, index, sessionId);
  const createdAtRaw = message.createdAt ?? new Date().toISOString();
  const userTurn = role === 'user' ? readUserTurnMetadata(message.metadata) : {};

  const stopped =
    role === 'assistant' &&
    (message.metadata?.stopped === true ||
      (typeof message.metadata?.stopReason === 'string' &&
        ['empty_response', 'budget_exceeded', 'tool_error', 'max_rounds', 'failed'].includes(
          message.metadata.stopReason,
        )));

  const baseMessage: Message = {
    id: messageId,
    role,
    content,
    text: role === 'user' ? content : undefined,
    createdAt: createdAtRaw,
    threadId: threadId === sessionId ? undefined : threadId,
    editorData: userTurn.editorData,
    fileList: userTurn.fileList,
    imageList: userTurn.imageList,
    stopped: stopped || undefined,
    reasoningBeforeTool:
      role === 'assistant'
        ? extractReasoningBeforeTool(message.content, messageId, message.metadata)
        : undefined,
    reasoningAfterTool:
      role === 'assistant'
        ? extractReasoningAfterTool(message.content, messageId, message.metadata)
        : undefined,
    tool:
      role === 'tool' && message.toolCallId
        ? {
            id: message.toolCallId,
            identifier: message.name ?? message.toolCallId,
            apiName: message.name ?? 'tool',
            toolCallId: message.toolCallId,
          }
        : undefined,
  };

  if (role === 'assistant' && options?.toolResultsByCallId) {
    const { tools, absorbedToolCallIds } = extractAssistantTools(message, options.toolResultsByCallId);
    for (const toolCallId of absorbedToolCallIds) {
      options.absorbedToolCallIds?.add(toolCallId);
    }
    const pausedTools = applyPermissionPauseFromRunMetadata(tools, message.metadata);
    return attachTurnSegmentsFromMetadata(baseMessage, message.metadata, pausedTools);
  }

  return baseMessage;
}

export function mapBackendMessagesToDomain(
  messages: BackendAgentMessageDto[],
  sessionId: string,
  defaultThreadId?: string,
): Message[] {
  const toolResultsByCallId = buildToolResultsIndex(messages);
  const absorbedToolCallIds = new Set<string>();

  return messages
    .map((message, index) =>
      mapBackendMessageToDomain(message, index, sessionId, defaultThreadId, {
        toolResultsByCallId,
        absorbedToolCallIds,
      }),
    )
    .filter((message): message is Message => {
      if (!message) return false;
      if (message.role !== 'tool') return true;
      const toolCallId = message.tool?.toolCallId ?? message.tool?.id;
      return !toolCallId || !absorbedToolCallIds.has(toolCallId);
    });
}
