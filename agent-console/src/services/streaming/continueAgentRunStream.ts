import { useAgentStore, useChatStore, useStreamingStore } from '../../stores';
import { isAgentConsoleApiMode } from '../../adapters/registry';
import { AgentConsoleApiError } from '../../adapters/api/http';
import { showToast, showErrorToast } from '../ui/toast';
import { triggerFollowUpChips } from '../followUp/triggerFollowUpChips';
import { refreshAfterConversationTurn, refreshMessagesForTopic } from '../../hooks/data/invalidate';
import { isTopicStreaming } from './streamingScope';
import { isRunStreamActive, subscribeAgentRunStream } from './agentStreamService';
import { shouldConsumeReasoningStream } from './reasoningEnabled';
import { fromStaticTurnSegments } from './streamSegments';
import { createTopicStreamHandler } from './topicStreamHandlers';
import { shouldHydrateMessagesAfterPermissionPause } from './permissionPauseStream';

function restoreAssistantToStreamingBuffer(topicId: string, assistantMessageId: string): void {
  const chat = useChatStore.getState();
  const streamingMessage = chat.getStreamingMessage(topicId);
  if (streamingMessage?.id === assistantMessageId) {
    useChatStore.setState((s) => ({
      streamingByTopicId: {
        ...s.streamingByTopicId,
        [topicId]: { ...streamingMessage, streaming: true, stopped: false },
      },
    }));
    return;
  }

  const messages = chat.getMessages(topicId);
  const existing = messages.find((message) => message.id === assistantMessageId && message.role === 'assistant');
  if (!existing) {
    chat.startStreamingMessage(assistantMessageId, topicId);
    return;
  }

  chat.setMessages(
    topicId,
    messages.filter((message) => message.id !== assistantMessageId),
  );
  useChatStore.setState((s) => ({
    streamingByTopicId: {
      ...s.streamingByTopicId,
      [topicId]: {
        id: assistantMessageId,
        role: 'assistant',
        content: existing.content,
        segments: fromStaticTurnSegments(existing.turnSegments),
        streaming: true,
        stopped: false,
        grounding: existing.grounding,
        images: existing.images,
      },
    },
  }));
}

function formatResumeError(error: unknown): string {
  if (error instanceof AgentConsoleApiError) return error.message;
  if (error instanceof Error) return error.message;
  return '恢复运行失败';
}

/** Resume after Console approval/deny: keep SSE + streaming buffer in sync. */
export async function continueAgentRunAfterIntervention(input: {
  topicId: string;
  runId: string;
  assistantMessageId: string;
  toolCallId: string;
  permissionId?: string;
  hitlRequestId?: string;
  interventionAction?: 'approve' | 'reject';
  triggerResume?: () => Promise<void>;
}): Promise<void> {
  const { topicId, runId, assistantMessageId, toolCallId, triggerResume } = input;
  const isReject = input.interventionAction === 'reject';
  if (!isAgentConsoleApiMode()) return;

  const chat = useChatStore.getState();
  const streaming = useStreamingStore.getState();

  if (isRunStreamActive(runId)) {
    restoreAssistantToStreamingBuffer(topicId, assistantMessageId);
    if (isReject) {
      streaming.clearPendingApprovalContext(topicId);
    } else {
      chat.releasePendingIntervention(topicId, toolCallId);
      const runCtx = streaming.getRunContextForTopic(topicId);
      const activePermissionId = input.permissionId ?? runCtx?.permissionId;
      if (
        activePermissionId &&
        runCtx?.permissionId &&
        activePermissionId !== runCtx.permissionId
      ) {
        showToast('审批已过期，请处理当前待审批工具');
        return;
      }
    }
    streaming.beginStreaming(topicId, { preserveMetrics: true });
    try {
      await triggerResume?.();
    } catch (error) {
      showErrorToast(formatResumeError(error));
    }
    return;
  }

  if (isTopicStreaming(topicId)) return;
  const priorContext = streaming.getRunContextForTopic(topicId);
  const resumeContext = {
    runId,
    permissionId: input.permissionId ?? priorContext?.permissionId,
    hitlRequestId: input.hitlRequestId ?? priorContext?.hitlRequestId,
    lastEventSeq: priorContext?.lastEventSeq,
  };

  restoreAssistantToStreamingBuffer(topicId, assistantMessageId);
  if (isReject) {
    streaming.clearPendingApprovalContext(topicId);
  } else {
    chat.releasePendingIntervention(topicId, toolCallId);
    if (resumeContext.permissionId || resumeContext.hitlRequestId) {
      streaming.recordPendingApprovalContext(topicId, resumeContext);
    }
  }

  const agentState = useAgentStore.getState();
  const reasoningEnabled = shouldConsumeReasoningStream(
    agentState.activeAgentId,
    agentState.plusStateByAgentId,
    agentState.getActivePlusState().chatConfig,
  );

  const ac = streaming.beginStreaming(topicId, { preserveMetrics: true });
  streaming.setActiveRunContext(topicId, { runId });
  const runCtx = streaming.getRunContextForTopic(topicId);
  const lastSeq = Math.max(streaming.getLastEventSeq(runId), runCtx?.lastEventSeq ?? 0);
  let turnFailed = false;

  const onEvent = createTopicStreamHandler({
    topicId,
    reasoningEnabled,
    onTurnFailed: () => {
      turnFailed = true;
    },
  });

  const resumePromise = triggerResume?.().catch((error) => {
    turnFailed = true;
    showErrorToast(formatResumeError(error));
    ac.abort();
  });

  try {
    await subscribeAgentRunStream(runId, '', onEvent, {
      signal: ac.signal,
      topicId,
      lastSeq,
      finishOnPause: false,
    });
    await resumePromise;
    streaming.clearPendingApprovalContext(topicId);
  } catch (error) {
    turnFailed = true;
    showErrorToast(formatResumeError(error));
  } finally {
    const chatState = useChatStore.getState();
    const awaitingApproval = shouldHydrateMessagesAfterPermissionPause(topicId);
    const streamingMessage = chatState.getStreamingMessage(topicId);
    if (streamingMessage) {
      if (awaitingApproval) {
        useChatStore.setState((s) => ({
          streamingByTopicId: {
            ...s.streamingByTopicId,
            [topicId]: { ...streamingMessage, streaming: false, stopped: false },
          },
        }));
      } else {
        chatState.finalizeStreamingMessage(topicId);
      }
    }

    streaming.endStreaming(topicId);
    await refreshMessagesForTopic(topicId);

    if (!turnFailed) {
      void refreshAfterConversationTurn(topicId).catch((err) => {
        console.error('[agentConsole] post-resume cache refresh failed', err);
      });
      void triggerFollowUpChips(topicId, assistantMessageId);
    }
  }
}
