import {
  selectAllPendingInterventions,
  messageHasPendingIntervention,
} from '../../selectors/pendingInterventions';
import { useChatStore, useStreamingStore } from '../../stores';

export const PENDING_INTERVENTION_SEND_MESSAGE =
  '请先处理待审批的工具调用（批准或拒绝）后再继续对话';

/** Drop approval context when tools already finished or failed. */
export function syncStaleApprovalContext(topicId: string): void {
  const chat = useChatStore.getState();
  const streamingStore = useStreamingStore.getState();
  const messages = chat.getMessages(topicId);
  const streaming = chat.getStreamingMessage(topicId);

  const hasActionable = selectAllPendingInterventions(messages, streaming, null).length > 0;
  if (hasActionable) return;

  const topicCtx = streamingStore.pendingApprovalContextByTopicId[topicId];
  const runCtx = streamingStore.getRunContextForTopic(topicId);
  if (
    !topicCtx &&
    !runCtx?.permissionId &&
    !runCtx?.hitlRequestId &&
    !runCtx?.toolCallId
  ) {
    return;
  }

  const latestAssistant = [...messages].reverse().find((message) => message.role === 'assistant');
  if (latestAssistant && messageHasPendingIntervention(latestAssistant)) return;

  streamingStore.clearPendingApprovalContext(topicId);
  const topicRuntime = streamingStore.streamsByTopicId[topicId];
  if (topicRuntime?.activeRunContext?.runId === runCtx?.runId) {
    useStreamingStore.getState().setActiveRunContext(topicId, null);
  }
}

/** True when the topic still has a tool/HITL approval bar awaiting user action. */
export function hasTopicPendingIntervention(topicId: string): boolean {
  syncStaleApprovalContext(topicId);

  const chat = useChatStore.getState();
  const messages = chat.getMessages(topicId);
  const streaming = chat.getStreamingMessage(topicId);
  const streamingStore = useStreamingStore.getState();
  const topicCtx = streamingStore.pendingApprovalContextByTopicId[topicId];
  const runCtx = streamingStore.getRunContextForTopic(topicId);

  return (
    selectAllPendingInterventions(messages, streaming, {
      permissionId: topicCtx?.permissionId ?? runCtx?.permissionId,
      hitlRequestId: topicCtx?.hitlRequestId ?? runCtx?.hitlRequestId,
      toolCallId: topicCtx?.toolCallId ?? runCtx?.toolCallId,
    }).length > 0
  );
}
