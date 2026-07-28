import { create } from 'zustand';

import type { AgentConsoleSnapshot } from '../adapters/types';
import type { Message } from '../domain/types';
import type { MessageFileItem, MessageImageItem } from '../domain/types';
import type { UserTurnPayload } from '../domain/types/userTurn';
import type { StreamEvent } from '../services/streaming/streamEvent';
import { mapRefsToMessageAttachments } from '../utils/userTurnAttachments';
import {
  createStreamTimingMeta,
  reduceStreamEvent,
  type StreamTimingMeta,
} from '../services/streaming/streamReducer';
import { toStaticTurnSegment } from '../services/streaming/streamSegments';
import { syncTopicMessagesQuery } from '../hooks/data/messagesQuerySync';
import { DEFAULT_TOPIC_ID, type StreamingMessage } from './types';
import { matchesToolReference } from '../domain/utils/toolReference';
import { isAgentConsoleApiMode } from '../adapters/registry';
import { applyMockAdminToolSuccess } from '../fixtures/mockAdminTools';
const MINIMAP_THRESHOLD = 3;

type ToolPatcher = <T extends NonNullable<Message['tool']>>(tool: T) => T;

function patchMessagesAndStreaming(
  s: ChatState,
  topicId: string,
  patchTool: ToolPatcher,
): Pick<ChatState, 'messagesByTopicId' | 'streamingByTopicId'> {
  const patchTurnSegments = (segments?: Message['turnSegments']) =>
    segments?.map((segment) => {
      if (segment.kind === 'tool') {
        return { ...segment, tool: patchTool(segment.tool) };
      }
      if (segment.kind === 'tools') {
        return { ...segment, tools: segment.tools.map((tool) => patchTool(tool)) };
      }
      return segment;
    });

  const streamingMessage = s.streamingByTopicId[topicId];
  const patchStreamingSegments = streamingMessage?.segments?.map((segment) => {
    if (segment.kind === 'tool') {
      return { ...segment, tool: patchTool(segment.tool) };
    }
    if (segment.kind === 'tools') {
      return { ...segment, tools: segment.tools.map((tool) => patchTool(tool)) };
    }
    return segment;
  });

  return {
    messagesByTopicId: {
      ...s.messagesByTopicId,
      [topicId]: (s.messagesByTopicId[topicId] ?? []).map((msg) => {
        if (msg.role !== 'assistant') return msg;
        return {
          ...msg,
          tool: msg.tool ? patchTool(msg.tool) : msg.tool,
          tools: msg.tools?.map((t) => patchTool(t)),
          turnSegments: patchTurnSegments(msg.turnSegments),
        };
      }),
    },
    streamingByTopicId:
      streamingMessage && patchStreamingSegments
        ? {
            ...s.streamingByTopicId,
            [topicId]: { ...streamingMessage, segments: patchStreamingSegments },
          }
        : s.streamingByTopicId,
  };
}

interface ChatState {
  /** @deprecated Read via useMessages(); writes kept for streaming pipeline until Phase 2 complete */
  messagesByTopicId: Record<string, Message[]>;
  reactions: Record<string, string[]>;
  minimapActiveIndex: number;
  streamingByTopicId: Record<string, StreamingMessage>;
  streamTimingMetaByTopicId: Record<string, StreamTimingMeta>;
  streamUserTextByTopicId: Record<string, string>;
  showcaseMode: boolean;
  scrollToBottomVisible: boolean;
  chatInputOverlayHeight: number;
  editingMessageId: string | null;

  hydrate: (snapshot: Pick<AgentConsoleSnapshot, 'messagesByTopicId'>) => void;
  getMessages: (topicId?: string | null) => Message[];
  setMessages: (topicId: string, messages: Message[]) => void;
  appendMessage: (topicId: string, message: Message) => void;
  updateUserMessage: (topicId: string, messageId: string, payload: UserTurnPayload) => void;
  toggleMessageEditing: (messageId: string, editing?: boolean) => void;
  setMessageCreating: (topicId: string, messageId: string, creating: boolean) => void;
  getStreamingMessage: (topicId: string) => StreamingMessage | null;
  startStreamingMessage: (messageId: string, topicId: string, userText?: string) => void;
  /** Align streaming assistant id with backend `${runId}:thread:assistant` for merge/refresh. */
  remapStreamingAssistantId: (topicId: string, messageId: string) => void;
  applyStreamEvent: (event: StreamEvent, topicId?: string) => number;
  finalizeStreamingMessage: (topicId: string, options?: { stopped?: boolean }) => void;
  clearStreamingMessage: (topicId: string) => void;
  setMinimapActiveIndex: (index: number) => void;
  shouldShowMinimap: (topicId?: string | null) => boolean;
  setReaction: (messageId: string, emojis: string[]) => void;
  addReaction: (messageId: string, emoji: string) => void;
  deleteMessage: (topicId: string, messageId: string) => void;
  removeToolFromMessage: (topicId: string, messageId: string, toolCallId: string) => void;
  toggleMessageCollapsed: (messageId: string) => void;
  collapsedByMessageId: Record<string, boolean>;
  setScrollToBottomVisible: (visible: boolean) => void;
  setChatInputOverlayHeight: (height: number) => void;
  resolveIntervention: (
    topicId: string,
    toolCallId: string,
    action: 'approve' | 'reject',
    options?: { reason?: string },
  ) => void;
  /** Clear pending approval UI and show tool as executing (post-approve, before SSE catches up). */
  releasePendingIntervention: (topicId: string, toolCallId: string) => void;
  updatePluginArguments: (
    topicId: string,
    toolCallId: string,
    args: Record<string, unknown>,
  ) => void;
  submitToolInteraction: (
    topicId: string,
    toolCallId: string,
    payload: Record<string, unknown>,
  ) => void;
  skipToolInteraction: (
    topicId: string,
    toolCallId: string,
    reason?: string,
  ) => void;
  toggleCompressedGroupExpanded: (topicId: string, messageId: string) => void;
  cancelCompression: (topicId: string, messageId: string) => void;
  addAIMessage: (topicId: string, content?: string) => void;
  addUserMessage: (topicId: string, content: string) => void;
}

function splitPayloadAttachments(payload: UserTurnPayload): {
  fileList: MessageFileItem[];
  imageList: MessageImageItem[];
} {
  if (!payload.files?.length) {
    return { fileList: [], imageList: [] };
  }
  const refs = payload.files.map((file) => ({
    uploadId: file.fileId,
    fileId: file.fileId,
    name: file.name ?? file.fileId,
    mime: file.mimeType ?? 'application/octet-stream',
    url: file.url ?? '',
    size: file.size ?? 0,
  }));
  return mapRefsToMessageAttachments(refs);
}

export const useChatStore = create<ChatState>((set, get) => ({
  messagesByTopicId: {},
  reactions: {},
  collapsedByMessageId: {},
  minimapActiveIndex: 0,
  streamingByTopicId: {},
  streamTimingMetaByTopicId: {},
  streamUserTextByTopicId: {},
  showcaseMode: false,
  scrollToBottomVisible: false,
  chatInputOverlayHeight: 0,
  editingMessageId: null,

  hydrate: (snapshot) => set({ messagesByTopicId: snapshot.messagesByTopicId }),

  getMessages: (topicId) => {
    const id = topicId ?? DEFAULT_TOPIC_ID;
    return get().messagesByTopicId[id] ?? [];
  },

  setMessages: (topicId, messages) => {
    set((s) => ({
      messagesByTopicId: { ...s.messagesByTopicId, [topicId]: messages },
    }));
    syncTopicMessagesQuery(topicId, messages);
  },

  appendMessage: (topicId, message) => {
    const nextMessages = [...(get().messagesByTopicId[topicId] ?? []), message];
    set((s) => ({
      messagesByTopicId: {
        ...s.messagesByTopicId,
        [topicId]: nextMessages,
      },
    }));
    syncTopicMessagesQuery(topicId, nextMessages);
  },

  updateUserMessage: (topicId, messageId, payload) => {
    const trimmed = payload.message.trim();
    const { fileList, imageList } = splitPayloadAttachments(payload);
    set((s) => ({
      messagesByTopicId: {
        ...s.messagesByTopicId,
        [topicId]: (s.messagesByTopicId[topicId] ?? []).map((msg) =>
          msg.id === messageId && msg.role === 'user'
            ? {
                ...msg,
                content: trimmed,
                text: trimmed,
                linkLine: undefined,
                linkCard: undefined,
                ...(payload.editorData !== undefined ? { editorData: payload.editorData } : {}),
                fileList: fileList.length > 0 ? fileList : undefined,
                imageList: imageList.length > 0 ? imageList : undefined,
              }
            : msg,
        ),
      },
    }));
  },

  toggleMessageEditing: (messageId, editing) =>
    set((s) => ({
      editingMessageId:
        editing === undefined
          ? s.editingMessageId === messageId
            ? null
            : messageId
          : editing
            ? messageId
            : s.editingMessageId === messageId
              ? null
              : s.editingMessageId,
    })),

  setMessageCreating: (topicId, messageId, creating) =>
    set((s) => ({
      messagesByTopicId: {
        ...s.messagesByTopicId,
        [topicId]: (s.messagesByTopicId[topicId] ?? []).map((msg) =>
          msg.id === messageId ? { ...msg, isCreating: creating } : msg,
        ),
      },
    })),

  getStreamingMessage: (topicId) => get().streamingByTopicId[topicId] ?? null,

  startStreamingMessage: (messageId, topicId, userText = '') =>
    set((s) => ({
      streamingByTopicId: {
        ...s.streamingByTopicId,
        [topicId]: {
          id: messageId,
          role: 'assistant',
          content: '',
          streaming: true,
        },
      },
      streamTimingMetaByTopicId: {
        ...s.streamTimingMetaByTopicId,
        [topicId]: createStreamTimingMeta(),
      },
      streamUserTextByTopicId: {
        ...s.streamUserTextByTopicId,
        [topicId]: userText,
      },
    })),

  remapStreamingAssistantId: (topicId, messageId) =>
    set((s) => {
      const streamingMessage = s.streamingByTopicId[topicId];
      if (!streamingMessage || !messageId.trim()) return s;
      if (streamingMessage.id === messageId) return s;
      return {
        streamingByTopicId: {
          ...s.streamingByTopicId,
          [topicId]: { ...streamingMessage, id: messageId },
        },
      };
    }),

  applyStreamEvent: (event, topicId) => {
    if (!topicId) return 0;
    const streamingMessage = get().streamingByTopicId[topicId];
    if (!streamingMessage) {
      return 0;
    }
    const streamTimingMeta =
      get().streamTimingMetaByTopicId[topicId] ?? createStreamTimingMeta();
    const streamUserText = get().streamUserTextByTopicId[topicId] ?? '';
    const { message, meta, tokenDelta } = reduceStreamEvent(
      streamingMessage,
      event,
      streamTimingMeta,
      streamUserText,
    );
    set((s) => ({
      streamingByTopicId: { ...s.streamingByTopicId, [topicId]: message },
      streamTimingMetaByTopicId: { ...s.streamTimingMetaByTopicId, [topicId]: meta },
    }));
    return tokenDelta;
  },

  finalizeStreamingMessage: (topicId, options) => {
    const streamingMessage = get().streamingByTopicId[topicId];
    if (!streamingMessage) return;

    const turnSegments =
      streamingMessage.segments
        ?.map((segment) => toStaticTurnSegment(segment))
        .filter((segment): segment is NonNullable<typeof segment> => segment != null) ?? [];

    const msg: Message = {
      id: streamingMessage.id,
      role: 'assistant',
      content: streamingMessage.content,
      createdAt: new Date().toISOString(),
      grounding: streamingMessage.grounding,
      turnSegments: turnSegments.length > 0 ? turnSegments : undefined,
      images: streamingMessage.images,
      stopped: options?.stopped ?? streamingMessage.stopped,
    };

    const prev = get().messagesByTopicId[topicId] ?? [];
    const replaceIndex = prev.findIndex((m) => m.id === msg.id);
    const nextMessages =
      replaceIndex >= 0
        ? prev.map((m, index) => (index === replaceIndex ? msg : m))
        : [...prev, msg];

    set((s) => {
      const { [topicId]: _removedStream, ...streamingByTopicId } = s.streamingByTopicId;
      const { [topicId]: _removedMeta, ...streamTimingMetaByTopicId } = s.streamTimingMetaByTopicId;
      const { [topicId]: _removedText, ...streamUserTextByTopicId } = s.streamUserTextByTopicId;

      return {
        messagesByTopicId: { ...s.messagesByTopicId, [topicId]: nextMessages },
        streamingByTopicId,
        streamTimingMetaByTopicId,
        streamUserTextByTopicId,
      };
    });
    syncTopicMessagesQuery(topicId, nextMessages);
  },

  clearStreamingMessage: (topicId) =>
    set((s) => {
      const { [topicId]: _removedStream, ...streamingByTopicId } = s.streamingByTopicId;
      const { [topicId]: _removedMeta, ...streamTimingMetaByTopicId } = s.streamTimingMetaByTopicId;
      const { [topicId]: _removedText, ...streamUserTextByTopicId } = s.streamUserTextByTopicId;
      return {
        streamingByTopicId,
        streamTimingMetaByTopicId,
        streamUserTextByTopicId,
      };
    }),

  setMinimapActiveIndex: (index) =>
    set((s) => (s.minimapActiveIndex === index ? s : { minimapActiveIndex: index })),

  shouldShowMinimap: (topicId) => {
    const msgs = get().getMessages(topicId);
    return msgs.filter((m) => m.role === 'user').length > MINIMAP_THRESHOLD;
  },

  setReaction: (messageId, emojis) =>
    set((s) => ({ reactions: { ...s.reactions, [messageId]: emojis } })),

  addReaction: (messageId, emoji) =>
    set((s) => {
      const prev = s.reactions[messageId] ?? [];
      if (prev.includes(emoji)) return s;
      return { reactions: { ...s.reactions, [messageId]: [...prev, emoji] } };
    }),

  deleteMessage: (topicId, messageId) =>
    set((s) => ({
      messagesByTopicId: {
        ...s.messagesByTopicId,
        [topicId]: (s.messagesByTopicId[topicId] ?? []).filter((m) => m.id !== messageId),
      },
      editingMessageId: s.editingMessageId === messageId ? null : s.editingMessageId,
    })),

  removeToolFromMessage: (topicId, messageId, toolCallId) =>
    set((s) => ({
      messagesByTopicId: {
        ...s.messagesByTopicId,
        [topicId]: (s.messagesByTopicId[topicId] ?? [])
          .map((msg) => {
            if (msg.id !== messageId) return msg;
            const matchId = (t: Message['tool']) =>
              t && (t.toolCallId ?? t.id) === toolCallId;

            if (msg.tools?.length) {
              const nextTools = msg.tools.filter((t) => (t.toolCallId ?? t.id) !== toolCallId);
              if (nextTools.length === 0) {
                const { tools: _t, tool: _single, ...rest } = msg;
                return { ...rest, content: msg.content || '' };
              }
              if (nextTools.length === 1) {
                return { ...msg, tool: nextTools[0], tools: undefined };
              }
              return { ...msg, tools: nextTools };
            }
            if (matchId(msg.tool)) return null;
            return msg;
          })
          .filter((msg): msg is Message => msg !== null),
      },
    })),

  toggleMessageCollapsed: (messageId) =>
    set((s) => ({
      collapsedByMessageId: {
        ...s.collapsedByMessageId,
        [messageId]: !s.collapsedByMessageId[messageId],
      },
    })),

  setScrollToBottomVisible: (visible) =>
    set((s) => (s.scrollToBottomVisible === visible ? s : { scrollToBottomVisible: visible })),

  setChatInputOverlayHeight: (height) =>
    set((s) => (s.chatInputOverlayHeight === height ? s : { chatInputOverlayHeight: height })),

  resolveIntervention: (topicId, toolCallId, action, options) =>
    set((s) => {
      const matchesToolCall = (tool: NonNullable<Message['tool']>) =>
        matchesToolReference(tool, toolCallId);

      const patchTool = <T extends NonNullable<Message['tool']>>(tool: T): T => {
        if (!matchesToolCall(tool)) return tool;
        if (action === 'approve') {
          const approved = {
            ...tool,
            customTitle: undefined,
            intervention: { status: 'resolved' as const },
            state: 'executing' as const,
          };
          if (!isAgentConsoleApiMode()) {
            const mockSuccess = applyMockAdminToolSuccess(approved);
            if (mockSuccess) return mockSuccess as T;
          }
          return approved;
        }
        return {
          ...tool,
          customTitle: undefined,
          intervention: { status: 'resolved' as const },
          state: 'rejected' as const,
          rejectedReason: options?.reason?.trim() || '用户拒绝了此工具调用',
        };
      };

      return patchMessagesAndStreaming(s, topicId, patchTool);
    }),

  releasePendingIntervention: (topicId, toolCallId) =>
    set((s) => {
      const patchTool = <T extends NonNullable<Message['tool']>>(tool: T): T => {
        if (!matchesToolReference(tool, toolCallId) || tool.intervention?.status !== 'pending') {
          return tool;
        }
        return {
          ...tool,
          customTitle: undefined,
          intervention: { status: 'resolved' as const },
          state: 'executing' as const,
        };
      };
      return patchMessagesAndStreaming(s, topicId, patchTool);
    }),

  updatePluginArguments: (topicId, toolCallId, args) =>
    set((s) => {
      const patchTool = <T extends NonNullable<Message['tool']>>(tool: T): T => {
        if (!matchesToolReference(tool, toolCallId)) return tool;
        return { ...tool, params: args, arguments: args };
      };
      return patchMessagesAndStreaming(s, topicId, patchTool);
    }),

  submitToolInteraction: (topicId, toolCallId, payload) => {
    get().updatePluginArguments(topicId, toolCallId, payload);
    get().resolveIntervention(topicId, toolCallId, 'approve');
  },

  skipToolInteraction: (topicId, toolCallId, reason) => {
    get().resolveIntervention(topicId, toolCallId, 'reject', { reason: reason || '用户跳过' });
  },

  toggleCompressedGroupExpanded: (topicId, messageId) =>
    set((s) => ({
      messagesByTopicId: {
        ...s.messagesByTopicId,
        [topicId]: (s.messagesByTopicId[topicId] ?? []).map((msg) =>
          msg.id === messageId
            ? {
                ...msg,
                compressedExpanded: !(msg.compressedExpanded ?? true),
              }
            : msg,
        ),
      },
    })),

  cancelCompression: (topicId, messageId) =>
    set((s) => ({
      messagesByTopicId: {
        ...s.messagesByTopicId,
        [topicId]: (s.messagesByTopicId[topicId] ?? []).filter((msg) => msg.id !== messageId),
      },
    })),

  addAIMessage: (topicId, content = '') => {
    const id = `ai-dev-${Date.now()}`;
    get().appendMessage(topicId, {
      id,
      role: 'assistant',
      content,
      createdAt: new Date().toISOString(),
    });
  },

  addUserMessage: (topicId, content) => {
    const text = content.trim();
    if (!text) return;
    const id = `user-dev-${Date.now()}`;
    get().appendMessage(topicId, {
      id,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    });
  },
}));
