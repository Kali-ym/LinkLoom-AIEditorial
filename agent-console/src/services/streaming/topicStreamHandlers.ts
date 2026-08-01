import { useChatStore, useStreamingStore, useTopicStore } from '../../stores';
import { showToast, showErrorToast } from '../ui/toast';
import { applyWorkspaceFromToolPayloads } from '../workspace/workspaceSync';
import { formatWorkspaceFallbackToast } from '../../utils/workspaceFallbackMessage';
import type { StreamEvent } from '../mock/StreamingHandler';
import type { HitlContextData } from './streamEvent';
import { isPermissionPauseStreamEvent, shouldHydrateMessagesAfterPermissionPause } from './permissionPauseStream';
import { isPermissionPauseToolError } from '../../domain/utils/toolReference';

function pauseStreamingBuffer(topicId: string): void {
  const current = useChatStore.getState().getStreamingMessage(topicId);
  if (!current) return;
  useChatStore.setState((s) => ({
    streamingByTopicId: {
      ...s.streamingByTopicId,
      [topicId]: { ...current, streaming: false, stopped: false },
    },
  }));
}

function endStreamingUnlessAwaitingApproval(topicId: string): void {
  if (shouldHydrateMessagesAfterPermissionPause(topicId)) return;
  useStreamingStore.getState().endStreaming(topicId);
}

function recordApprovalContext(
  topicId: string,
  context: { runId: string; permissionId?: string; hitlRequestId?: string; toolCallId?: string },
): void {
  const lastEventSeq = useStreamingStore.getState().getLastEventSeq(context.runId);
  useStreamingStore.getState().recordPendingApprovalContext(topicId, {
    ...context,
    lastEventSeq,
  });
}
function handleWorkspaceFallbackEvent(event: StreamEvent): void {
  if (event.type !== 'workspace_fallback' || !event.data || typeof event.data !== 'object') return;
  const { fallback, fallbackReason } = event.data as {
    fallback?: string;
    fallbackReason?: string;
  };
  if (!fallback) return;
  showToast(formatWorkspaceFallbackToast(fallback, fallbackReason));
}

/** Shared SSE → chat store handler for send and post-approval resume. */
export function createTopicStreamHandler(options: {
  topicId: string;
  reasoningEnabled: boolean;
  onTurnFailed?: () => void;
}): (event: StreamEvent) => void {
  const { topicId, reasoningEnabled, onTurnFailed } = options;

  return (event) => {
    if (event.type === 'reasoning_part' && !reasoningEnabled) return;
    if (event.type === 'turn_failed') {
      const errorText = event.text ?? event.content ?? 'Agent 运行失败';
      showErrorToast(errorText);
      onTurnFailed?.();
    }
    handleWorkspaceFallbackEvent(event);

    if (event.type === 'hitl_context' && event.data) {
      const data = event.data as HitlContextData;
      recordApprovalContext(topicId, {
        runId: data.runId,
        permissionId: data.permissionId,
        hitlRequestId: data.hitlRequestId,
        toolCallId: data.toolCallId,
      });
      endStreamingUnlessAwaitingApproval(topicId);
      return;
    }

    if (event.type === 'tool_calls' && event.tools?.length) {
      const pendingTool = event.tools.find(
        (tool) => tool.intervention?.status === 'pending' && (tool.permissionId || tool.hitlKind),
      );
      if (pendingTool?.permissionId || pendingTool?.hitlKind) {
        const runId = useStreamingStore.getState().getRunContextForTopic(topicId)?.runId ?? '';
        recordApprovalContext(topicId, {
          runId,
          permissionId: pendingTool.permissionId,
          hitlRequestId: pendingTool.permissionId
            ? pendingTool.toolCallId
            : useStreamingStore.getState().getRunContextForTopic(topicId)?.hitlRequestId,
          toolCallId: pendingTool.toolCallId,
        });
      }

      const terminal = event.tools.every(
        (tool) =>
          tool.state === 'success' ||
          tool.state === 'rejected' ||
          (tool.state === 'error' && !isPermissionPauseToolError(tool)),
      );
      if (terminal) {
        const ctx = useStreamingStore.getState().getRunContextForTopic(topicId);
        const touchesActivePermission = event.tools.some(
          (tool) =>
            (ctx?.permissionId && tool.permissionId === ctx.permissionId) ||
            (ctx?.hitlRequestId && tool.toolCallId === ctx.hitlRequestId) ||
            (ctx?.toolCallId && tool.toolCallId === ctx.toolCallId),
        );
        if (touchesActivePermission) {
          useStreamingStore.getState().clearPendingApprovalContext(topicId);
        }
      }
    }

    if (event.type === 'run_paused') {
      const payload = event.data as { reason?: string; permissionId?: string; requestId?: string } | undefined;
      const isPermissionPause =
        payload?.reason === 'permission' || typeof payload?.permissionId === 'string';
      const isNeedsInputPause = payload?.reason === 'needs_input';
      if (isPermissionPause || isNeedsInputPause) {
        pauseStreamingBuffer(topicId);
        const existing = useStreamingStore.getState().getRunContextForTopic(topicId);
        const runId = existing?.runId ?? '';
        if (payload?.permissionId) {
          recordApprovalContext(topicId, {
            runId,
            permissionId: payload.permissionId,
            toolCallId: existing?.toolCallId,
          });
        } else if (isNeedsInputPause && payload?.requestId) {
          recordApprovalContext(topicId, {
            runId,
            hitlRequestId: payload.requestId,
            toolCallId: existing?.toolCallId,
          });
        }
      }
      endStreamingUnlessAwaitingApproval(topicId);
      return;
    }

    if (isPermissionPauseStreamEvent(event)) {
      endStreamingUnlessAwaitingApproval(topicId);
    }

    if (event.type === 'usage_update' && event.usage) {
      useTopicStore.getState().setTopicContextUsage(topicId, {
        ...event.usage,
        updatedAt: new Date().toISOString(),
      });
    }

    if (event.type === 'context_usage_preview' && event.contextSnapshot) {
      const snap = event.contextSnapshot;
      useTopicStore.getState().setTopicContextUsage(topicId, {
        promptTokens: snap.adjustedTotal,
        completionTokens: 0,
        totalTokens: snap.adjustedTotal,
        byCategory: snap.byCategory,
        adjustedTotal: snap.adjustedTotal,
        driftMultiplier: snap.driftMultiplier,
        maxContextTokens: snap.maxContextTokens,
        reserveOutputTokens: snap.reserveOutputTokens,
        compactionBuffer: snap.compactionBuffer,
        remainingTokens: snap.remainingTokens,
        usageRatio: snap.usageRatio,
        source: snap.source,
        round: snap.round,
        compacted: snap.compacted,
        updatedAt: new Date().toISOString(),
      });
    }

    if (event.type === 'context_compacted' && event.contextSnapshot) {
      const snap = event.contextSnapshot;
      useTopicStore.getState().setTopicContextUsage(topicId, {
        promptTokens: snap.adjustedTotal,
        completionTokens: 0,
        totalTokens: snap.adjustedTotal,
        byCategory: snap.byCategory,
        adjustedTotal: snap.adjustedTotal,
        driftMultiplier: snap.driftMultiplier,
        maxContextTokens: snap.maxContextTokens,
        reserveOutputTokens: snap.reserveOutputTokens,
        compactionBuffer: snap.compactionBuffer,
        remainingTokens: snap.remainingTokens,
        usageRatio: snap.usageRatio,
        source: snap.source,
        round: snap.round,
        compacted: true,
        updatedAt: new Date().toISOString(),
      });
    }

    const tokenDelta = useChatStore.getState().applyStreamEvent(event, topicId);
    if (event.type === 'tool_calls' && event.tools?.length) {
      applyWorkspaceFromToolPayloads(topicId, event.tools);
    }
    if (tokenDelta > 0) {
      useStreamingStore.getState().addTokenCount(topicId, tokenDelta);
    }
  };
}
