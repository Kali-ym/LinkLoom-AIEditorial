import { useChatStore, useStreamingStore } from '../../stores';
import { applyTopicStatusAfterStream } from '../topic/topicLifecycle';
import { hasTopicPendingIntervention, syncStaleApprovalContext } from './interventionGate';
import { shouldHydrateMessagesAfterPermissionPause } from './permissionPauseStream';
import { settleUnresolvedToolsOnTurnEnd } from './streamSegments';

export interface FinalizeStreamTurnOptions {
  topicId: string;
  aborted: boolean;
  turnFailed: boolean;
  onFollowUp?: (messageId: string) => void;
}

/** Shared send/regenerate/resume tail: settle tools, pause or finalize streaming buffer. */
export function finalizeStreamTurn({
  topicId,
  aborted,
  turnFailed,
  onFollowUp,
}: FinalizeStreamTurnOptions): { keepForApproval: boolean } {
  const chatState = useChatStore.getState();
  let streamingMessage = chatState.getStreamingMessage(topicId);

  if (streamingMessage?.segments?.length) {
    const settledSegments = settleUnresolvedToolsOnTurnEnd(streamingMessage.segments);
    if (settledSegments !== streamingMessage.segments) {
      streamingMessage = { ...streamingMessage, segments: settledSegments };
      useChatStore.setState((s) => ({
        streamingByTopicId: {
          ...s.streamingByTopicId,
          [topicId]: streamingMessage!,
        },
      }));
    }
  }

  const keepForApproval =
    hasTopicPendingIntervention(topicId) || shouldHydrateMessagesAfterPermissionPause(topicId);

  if (!keepForApproval) {
    useStreamingStore.getState().endStreaming(topicId);
  }

  if (streamingMessage) {
    const finalizedId = streamingMessage.id;
    if (keepForApproval) {
      useChatStore.setState((s) => ({
        streamingByTopicId: {
          ...s.streamingByTopicId,
          [topicId]: { ...streamingMessage!, streaming: false, stopped: false },
        },
      }));
    } else {
      chatState.finalizeStreamingMessage(topicId, { stopped: aborted || turnFailed });
      if (!aborted && !turnFailed) {
        onFollowUp?.(finalizedId);
      }
    }
  } else if (!keepForApproval) {
    useStreamingStore.getState().endStreaming(topicId);
  }

  // 侧栏图标依赖 topic.status；不依赖 refresh，避免失败/审批/滞后快照导致一直转圈。
  applyTopicStatusAfterStream(topicId, { keepForApproval, turnFailed, aborted });

  if (!keepForApproval) {
    syncStaleApprovalContext(topicId);
  }

  return { keepForApproval };
}
