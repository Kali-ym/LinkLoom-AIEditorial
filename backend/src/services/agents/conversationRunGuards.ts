import type { AgentSession } from './engine/AgentSession.js';

export function hasDanglingToolCallsInSession(session: AgentSession): boolean {
  const requested = new Set<string>();
  const finished = new Set<string>();

  for (const event of session.events) {
    const payload =
      event.payload && typeof event.payload === 'object'
        ? (event.payload as Record<string, unknown>)
        : {};
    const toolCallId =
      (typeof payload.toolCallId === 'string' && payload.toolCallId) || event.id;

    if (event.type === 'tool_call_requested') {
      requested.add(toolCallId);
      continue;
    }
    if (event.type === 'tool_finished') {
      finished.add(toolCallId);
    }
  }

  for (const toolCallId of requested) {
    if (!finished.has(toolCallId)) return true;
  }
  return false;
}

/** Only completed turns may be included in the next user message history. */
export function isReusableConversationRun(session: AgentSession): boolean {
  if (session.status !== 'succeeded' && session.status !== 'archived') {
    return false;
  }
  if (hasDanglingToolCallsInSession(session)) {
    return false;
  }

  return (
    Boolean(session.output?.content?.trim()) ||
    session.events.some(
      (event) => event.type === 'message_finished' || event.type === 'model_finished',
    )
  );
}

export function blocksNewConversationRun(session: AgentSession): boolean {
  if (session.status === 'queued' || session.status === 'running' || session.status === 'cancelling') {
    return true;
  }
  if (session.status === 'cancelled' || session.status === 'failed' || session.status === 'succeeded' || session.status === 'archived') {
    return false;
  }
  if (!session.pendingPermission && !session.pendingHitl) {
    return false;
  }
  const pendingToolCallId = extractPendingToolCallId(session);
  if (pendingToolCallId && hasToolCallFinished(session, pendingToolCallId)) {
    return false;
  }
  return true;
}

function extractPendingToolCallId(session: AgentSession): string | undefined {
  const fromPermission = session.pendingPermission?.metadata;
  if (fromPermission && typeof fromPermission === 'object' && !Array.isArray(fromPermission)) {
    const toolCallId = (fromPermission as Record<string, unknown>).toolCallId;
    if (typeof toolCallId === 'string' && toolCallId.trim()) return toolCallId.trim();
  }
  const fromHitl = session.pendingHitl?.metadata;
  if (fromHitl && typeof fromHitl === 'object' && !Array.isArray(fromHitl)) {
    const toolCallId = (fromHitl as Record<string, unknown>).toolCallId;
    if (typeof toolCallId === 'string' && toolCallId.trim()) return toolCallId.trim();
  }
  return undefined;
}

function hasToolCallFinished(session: AgentSession, toolCallId: string): boolean {
  return session.events.some((event) => {
    if (event.type !== 'tool_finished') return false;
    const payload =
      event.payload && typeof event.payload === 'object'
        ? (event.payload as Record<string, unknown>)
        : {};
    const id = (typeof payload.toolCallId === 'string' && payload.toolCallId) || event.id;
    return id === toolCallId;
  });
}

export function isSupersedeableApprovalRun(session: AgentSession): boolean {
  if (session.pendingPermission || session.pendingHitl) return true;
  return session.status === 'paused';
}

export function newConversationBlockedMessage(session: AgentSession): string {
  if (session.pendingPermission || session.pendingHitl || session.status === 'paused') {
    return '当前会话有未完成的工具审批，请先批准或拒绝后再发送新消息。';
  }
  return '上一条运行仍在停止或执行中，请稍后再试。';
}
