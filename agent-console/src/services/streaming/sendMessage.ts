import { createUserMessageFields } from '../messages/createUserMessageFields';
import {
  useAgentStore,
  useChatStore,
  useInputStore,
  useRouteStore,
  useStreamingStore,
  useTopicStore,
} from '../../stores';
import { showToast, showErrorToast } from '../ui/toast';
import { triggerFollowUpChips } from '../followUp/triggerFollowUpChips';
import { refreshAfterConversationTurn, refreshMessagesForTopic } from '../../hooks/data/invalidate';
import { isAgentConsoleApiMode } from '../../adapters/registry';
import { mapChatAttachmentRefsToFileRefs } from '../../adapters/api/mappers/upload';
import { AgentConsoleApiError } from '../../adapters/api/http';
import type { Message } from '../../domain/types';
import type { UserTurnPayload } from '../../domain/types/userTurn';
import { regenerateSessionMessage } from '../../adapters/api/sessionMessageActions';
import { subscribeAgentRunStream, runAgentConversationStream } from './agentStreamService';
import { assistantMessageIdForRun } from './assistantMessageId';
import { shouldConsumeReasoningStream } from './reasoningEnabled';
import { isTopicStreaming } from './streamingScope';
import { createTopicStreamHandler } from './topicStreamHandlers';
import { hasTopicPendingIntervention, PENDING_INTERVENTION_SEND_MESSAGE, syncStaleApprovalContext } from './interventionGate';
import {
  isPermissionPauseStreamEvent,
  shouldHydrateMessagesAfterPermissionPause,
} from './permissionPauseStream';
import { finalizeStreamTurn } from './finalizeStreamTurn';
import { mapTopicMessagesToRunContext } from '../../adapters/api/mappers/runContext';
import { useFollowUpActionStore } from '../../stores/followUpActionStore';
import { persistTopicModelForSend } from '../topic/topicModelBinding';

import {
  buildFilesOnlyPromptFromRefs,
  mapMessageAttachmentsToFileRefs,
  mapRefsToMessageAttachments,
} from '../../utils/userTurnAttachments';

async function refreshConversationAfterStream(topicId: string): Promise<void> {
  if (shouldHydrateMessagesAfterPermissionPause(topicId)) {
    await refreshMessagesForTopic(topicId);
    return;
  }
  await refreshAfterConversationTurn(topicId);
}

export type UserTurnSendInput = UserTurnPayload & {
  /** Staged uploads for optimistic bubble preview (cleared after send). */
  attachmentRefs?: import('../../adapters/ports/IUploadPort').ChatAttachmentRef[];
};

function normalizeSendInput(input: string | UserTurnSendInput): UserTurnSendInput {
  if (typeof input === 'string') {
    return { message: input };
  }
  return input;
}

/** Append user message and run mock/backend stream into chatStore. */
export async function sendUserMessage(
  topicId: string,
  input: string | UserTurnSendInput,
  options?: { skipAppendUser?: boolean },
): Promise<void> {
  const turn = normalizeSendInput(input);
  const chatUploadFileList = useInputStore.getState().chatUploadFileList;
  const attachmentRefs = turn.attachmentRefs ?? chatUploadFileList;
  const trimmed = turn.message.trim();
  if (!trimmed && attachmentRefs.length === 0) return;

  const bubbleContent = trimmed;
  const userFacingText = bubbleContent || buildFilesOnlyPromptFromRefs(attachmentRefs);

  if (hasTopicPendingIntervention(topicId)) {
    showToast(PENDING_INTERVENTION_SEND_MESSAGE);
    return;
  }

  const streaming = useStreamingStore.getState();
  if (isTopicStreaming(topicId)) {
    if (!options?.skipAppendUser) {
      streaming.enqueue(topicId, { text: userFacingText });
    }
    return;
  }

  persistTopicModelForSend(topicId);

  const activeTopic = useTopicStore.getState().topics.find((topic) => topic.id === topicId);
  if (activeTopic?.status === 'temp') {
    const now = new Date().toISOString();
    useTopicStore.setState((state) => ({
      topics: state.topics.map((topic) =>
        topic.id === topicId
          ? {
              ...topic,
              status: 'running' as const,
              title: userFacingText.slice(0, 80) || topic.title,
              tag: undefined,
              createdAt: topic.createdAt ?? now,
              updatedAt: now,
              active: true,
            }
          : topic,
      ),
    }));
  } else if (activeTopic) {
    const now = new Date().toISOString();
    useTopicStore.setState((state) => ({
      topics: state.topics.map((topic) =>
        topic.id === topicId
          ? {
              ...topic,
              title: userFacingText.slice(0, 80) || topic.title,
              updatedAt: now,
              active: true,
            }
          : topic,
      ),
    }));
  }

  const chat = useChatStore.getState();
  useFollowUpActionStore.getState().clear(topicId);

  syncStaleApprovalContext(topicId);
  if (chat.getStreamingMessage(topicId)) {
    chat.finalizeStreamingMessage(topicId);
  }

  const priorRunContext = mapTopicMessagesToRunContext(useChatStore.getState().getMessages(topicId));

  let userMsgId: string | undefined;

  if (!options?.skipAppendUser) {
    const createdAt = new Date().toISOString();
    const { fileList, imageList } = mapRefsToMessageAttachments(attachmentRefs);
    const userMsg = {
      ...createUserMessageFields(bubbleContent, `u-${Date.now()}`, createdAt, {
        editorData: turn.editorData,
        fileList: fileList.length > 0 ? fileList : undefined,
        imageList: imageList.length > 0 ? imageList : undefined,
      }),
      isCreating: true,
    };
    userMsgId = userMsg.id;
    chat.appendMessage(topicId, userMsg);
    useRouteStore.getState().showConversation(userFacingText.slice(0, 40));
  }

  const messageId = `a-${Date.now()}`;
  chat.startStreamingMessage(messageId, topicId, userFacingText);
  if (userMsgId) {
    chat.setMessageCreating(topicId, userMsgId, false);
  }
  const ac = streaming.beginStreaming(topicId);

  const agentState = useAgentStore.getState();
  const agentId = agentState.activeAgentId;
  const reasoningEnabled = shouldConsumeReasoningStream(
    agentId,
    agentState.plusStateByAgentId,
    agentState.getActivePlusState().chatConfig,
  );
  const files =
    turn.files && turn.files.length > 0
      ? turn.files
      : attachmentRefs.length > 0
        ? mapChatAttachmentRefsToFileRefs(attachmentRefs)
        : undefined;
  if (attachmentRefs.length > 0) {
    useInputStore.getState().clearChatUploadFileList({ revokePreviews: false });
  }
  let aborted = false;

  const onAbort = () => {
    aborted = true;
    const current = useChatStore.getState().getStreamingMessage(topicId);
    if (current) {
      useChatStore.setState((s) => ({
        streamingByTopicId: {
          ...s.streamingByTopicId,
          [topicId]: { ...current, streaming: false, stopped: true },
        },
      }));
    }
  };
  ac.signal.addEventListener('abort', onAbort);

  let turnFailed = false;
  const onStreamEvent = createTopicStreamHandler({
    topicId,
    reasoningEnabled,
    onTurnFailed: () => {
      turnFailed = true;
    },
  });

  try {
    await runAgentConversationStream(
      agentId,
      trimmed,
      (event) => {
        if (ac.signal.aborted && !isPermissionPauseStreamEvent(event)) return;
        onStreamEvent(event);
      },
      {
        signal: ac.signal,
        topicId,
        messages: priorRunContext,
        message: trimmed,
        editorData: turn.editorData,
        files,
      },
    );
  } catch (error) {
    const pendingIntervention = hasTopicPendingIntervention(topicId);
    if (!pendingIntervention) {
      turnFailed = true;
      const message =
        error instanceof AgentConsoleApiError && error.status === 401
          ? '未登录或 token 失效，请在 Console 执行 localStorage.setItem("auth_token", "<token>")'
          : error instanceof AgentConsoleApiError && error.status === 409
            ? error.message || '上一条运行尚未结束，请稍后再试'
            : error instanceof AgentConsoleApiError && error.status === 503
              ? error.message || 'Agent 服务未就绪，请确认 backend 已启动，并在设置页配置 AI 提供商'
              : error instanceof Error
                ? error.message
                : '发送失败';
      console.error('[agentConsole] send stream failed', error);
      showErrorToast(message);
      const current = useChatStore.getState().getStreamingMessage(topicId);
      if (current && !current.content.trim()) {
        useChatStore.setState((s) => ({
          streamingByTopicId: {
            ...s.streamingByTopicId,
            [topicId]: { ...current, content: message, streaming: false, stopped: true },
          },
        }));
      }
    }
  } finally {
    ac.signal.removeEventListener('abort', onAbort);

    const { keepForApproval } = finalizeStreamTurn({
      topicId,
      aborted,
      turnFailed,
      onFollowUp: (messageId) => {
        void triggerFollowUpChips(topicId, messageId);
      },
    });

    const next = useStreamingStore.getState().flushQueue(topicId);
    if (next) {
      window.setTimeout(() => {
        void sendUserMessage(topicId, { message: next.text });
      }, 300);
      return;
    }

    if (isAgentConsoleApiMode() && !turnFailed && !aborted) {
      const stillStreaming = Boolean(useChatStore.getState().getStreamingMessage(topicId));
      if (!(keepForApproval && stillStreaming)) {
        void refreshConversationAfterStream(topicId).catch((error) => {
          console.error('[agentConsole] post-stream cache refresh failed', error);
        });
      }
    }
  }
}

/** Truncate thread after user message and re-run assistant stream. */
export async function regenerateUserMessage(topicId: string, messageId: string): Promise<void> {
  if (isTopicStreaming(topicId)) {
    showToast('请等待当前回复完成');
    return;
  }

  persistTopicModelForSend(topicId);

  const chat = useChatStore.getState();
  const messages = chat.getMessages(topicId);
  const idx = messages.findIndex((m) => m.id === messageId && m.role === 'user');
  if (idx === -1) return;

  chat.toggleMessageEditing(messageId, false);

  if (isAgentConsoleApiMode()) {
    await regenerateExistingRunStream(topicId, messageId, messages.slice(0, idx + 1));
    return;
  }

  const userMsg = messages[idx];
  chat.setMessages(topicId, messages.slice(0, idx + 1));
  await sendUserMessage(
    topicId,
    {
      message: userMsg.content,
      editorData: userMsg.editorData as Record<string, unknown> | undefined,
      files: mapMessageAttachmentsToFileRefs(userMsg.imageList, userMsg.fileList),
    },
    { skipAppendUser: true },
  );
}

/** Regenerate assistant reply from its message id. */
export async function regenerateAssistantMessage(
  topicId: string,
  messageId: string,
): Promise<void> {
  if (isTopicStreaming(topicId)) {
    showToast('请等待当前回复完成');
    return;
  }

  persistTopicModelForSend(topicId);

  const chat = useChatStore.getState();
  const messages = chat.getMessages(topicId);
  const idx = messages.findIndex((m) => m.id === messageId && m.role === 'assistant');
  if (idx === -1) return;

  if (isAgentConsoleApiMode()) {
    await regenerateExistingRunStream(topicId, messageId, messages.slice(0, idx));
    return;
  }

  chat.setMessages(topicId, messages.slice(0, idx));
  const priorUser = [...messages.slice(0, idx)].reverse().find((m) => m.role === 'user');
  if (!priorUser?.content) return;
  await sendUserMessage(topicId, { message: priorUser.content }, { skipAppendUser: true });
}

async function regenerateExistingRunStream(
  topicId: string,
  messageId: string,
  truncatedMessages: Message[],
): Promise<void> {
  const chat = useChatStore.getState();
  chat.setMessages(topicId, truncatedMessages);

  const agentState = useAgentStore.getState();
  const reasoningEnabled = shouldConsumeReasoningStream(
    agentState.activeAgentId,
    agentState.plusStateByAgentId,
    agentState.getActivePlusState().chatConfig,
  );

  let runId = '';
  let input = '';
  try {
    const result = await regenerateSessionMessage(topicId, messageId);
    runId = result.runId;
    input = result.input;
  } catch (error) {
    const message =
      error instanceof AgentConsoleApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : '重新生成失败';
    showErrorToast(message);
    return;
  }

  const assistantMessageId = `a-${Date.now()}`;
  chat.startStreamingMessage(assistantMessageId, topicId, input);
  chat.remapStreamingAssistantId(topicId, assistantMessageIdForRun(runId));
  const ac = useStreamingStore.getState().beginStreaming(topicId);
  let aborted = false;
  let turnFailed = false;

  const onAbort = () => {
    aborted = true;
    const current = useChatStore.getState().getStreamingMessage(topicId);
    if (current) {
      useChatStore.setState((s) => ({
        streamingByTopicId: {
          ...s.streamingByTopicId,
          [topicId]: { ...current, streaming: false, stopped: true },
        },
      }));
    }
  };
  ac.signal.addEventListener('abort', onAbort);

  const onStreamEvent = createTopicStreamHandler({
    topicId,
    reasoningEnabled,
    onTurnFailed: () => {
      turnFailed = true;
    },
  });

  try {
    await subscribeAgentRunStream(
      runId,
      input,
      (event) => {
        if (ac.signal.aborted && !isPermissionPauseStreamEvent(event)) return;
        onStreamEvent(event);
      },
      { signal: ac.signal, topicId },
    );
  } catch (error) {
    turnFailed = true;
    const message =
      error instanceof AgentConsoleApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : '重新生成失败';
    showErrorToast(message);
  } finally {
    ac.signal.removeEventListener('abort', onAbort);

    const awaitingApproval = shouldHydrateMessagesAfterPermissionPause(topicId);
    finalizeStreamTurn({
      topicId,
      aborted,
      turnFailed,
      onFollowUp: (messageId) => {
        if (!awaitingApproval) {
          void triggerFollowUpChips(topicId, messageId);
        }
      },
    });

    if (!turnFailed && !aborted) {
      void refreshConversationAfterStream(topicId).catch((error) => {
        console.error('[agentConsole] post-regenerate cache refresh failed', error);
      });
    }
  }
}

