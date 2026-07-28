import type { AgentMessage, AgentMessageContentPart } from '../engine/AgentRunSpec.js';
import type { AgentSession } from '../engine/AgentSession.js';
import type { AgentEvent } from '../engine/AgentEvent.js';

export class AgentSessionManager {
  getSessionMessages(session: AgentSession): AgentMessage[] {
    return buildSessionMessages(session);
  }

  getThreadRunMessages(session: AgentSession): AgentMessage[] {
    return buildThreadRunMessages(session);
  }
}

function buildSessionMessages(session: AgentSession): AgentMessage[] {
  const messages: AgentMessage[] = session.messages.map((message, index) => ({
    ...message,
    content: message.content ?? '',
    id: message.id ?? `${session.runId}:input:${index}`,
    createdAt: message.createdAt ?? session.createdAt,
    metadata: {
      ...message.metadata,
      runId: session.runId,
      sessionId: session.sessionId,
      threadId: session.threadId,
      source: message.metadata?.source ?? 'run_input'
    }
  }));

  const assistantMessage = buildAssistantMessage(session);
  if (assistantMessage) {
    messages.push(assistantMessage);
  }

  return messages;
}

interface PersistedToolCall {
  id: string;
  name: string;
  arguments?: unknown;
  exposedName?: string;
  mcpServerId?: string;
  durationMs?: number;
  success?: boolean;
  content?: string;
  data?: unknown;
  error?: string;
}

function resolveMcpServerIdFromPayload(payload: Record<string, unknown>): string | undefined {
  const direct = payload.mcpServerId;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  const execution = payload.execution;
  if (!execution || typeof execution !== 'object' || Array.isArray(execution)) return undefined;
  const mcp = (execution as Record<string, unknown>).mcp;
  if (!mcp || typeof mcp !== 'object' || Array.isArray(mcp)) return undefined;
  const serverId = (mcp as Record<string, unknown>).serverId;
  return typeof serverId === 'string' && serverId.trim() ? serverId.trim() : undefined;
}

function collectSessionToolCalls(session: AgentSession): PersistedToolCall[] {
  const byId = new Map<string, PersistedToolCall>();
  const sortedEvents = [...session.events].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));

  for (const event of sortedEvents) {
    if (event.type === 'tool_call_requested') {
      const payload = event.payload as Record<string, unknown>;
      const toolCallId =
        (typeof payload.toolCallId === 'string' && payload.toolCallId) || event.id;
      byId.set(toolCallId, {
        id: toolCallId,
        name: typeof payload.toolName === 'string' ? payload.toolName : 'tool',
        arguments: payload.arguments,
        exposedName:
          typeof payload.exposedName === 'string' ? payload.exposedName : undefined,
        mcpServerId: resolveMcpServerIdFromPayload(payload),
      });
      continue;
    }

    if (event.type === 'tool_finished') {
      const payload = event.payload as Record<string, unknown>;
      const toolCallId =
        (typeof payload.toolCallId === 'string' && payload.toolCallId) || event.id;
      const existing = byId.get(toolCallId) ?? {
        id: toolCallId,
        name: typeof payload.toolName === 'string' ? payload.toolName : 'tool',
      };
      byId.set(toolCallId, {
        ...existing,
        name:
          typeof payload.toolName === 'string' && payload.toolName.trim()
            ? payload.toolName
            : existing.name,
        success: payload.success !== false,
        durationMs: typeof payload.durationMs === 'number' ? payload.durationMs : undefined,
        content: typeof payload.content === 'string' ? payload.content : undefined,
        data: payload.data,
        error: typeof payload.error === 'string' ? payload.error : undefined,
        mcpServerId: existing.mcpServerId ?? resolveMcpServerIdFromPayload(payload),
      });
    }
  }

  return [...byId.values()];
}

function collectReasoningTextByRound(session: AgentSession): Map<number, string> {
  const byRound = new Map<number, string>();

  for (const event of session.events) {
    if (event.type === 'reasoning_snapshot') {
      const payload = event.payload as { content?: string; round?: number };
      const reasoning = typeof payload.content === 'string' ? payload.content.trim() : '';
      if (!reasoning) continue;
      const round = typeof payload.round === 'number' && payload.round > 0 ? payload.round : 1;
      if (!byRound.has(round)) {
        byRound.set(round, reasoning);
      }
      continue;
    }
    if (event.type !== 'reasoning_delta') continue;
    const payload = event.payload as { content?: string; round?: number };
    const content = payload.content;
    if (typeof content !== 'string' || content.length === 0) continue;
    const round = typeof payload.round === 'number' && payload.round > 0 ? payload.round : 1;
    byRound.set(round, (byRound.get(round) ?? '') + content);
  }

  if (byRound.size === 0) {
    const fallback = collectAssistantReasoning(session);
    if (fallback.trim()) {
      byRound.set(1, fallback);
    }
  }

  return byRound;
}

function eventRound(event: AgentEvent): number {
  const round = (event.payload as { round?: number }).round;
  return typeof round === 'number' && round > 0 ? round : 1;
}

function computeReasoningDurationSecForRound(session: AgentSession, round: number): string {
  const sortedEvents = [...session.events].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));

  const snapshot = sortedEvents.find(
    (event) => event.type === 'reasoning_snapshot' && eventRound(event) === round,
  );
  if (snapshot) {
    const durationMs = (snapshot.payload as { durationMs?: number }).durationMs;
    if (typeof durationMs === 'number' && durationMs >= 0) {
      return (durationMs / 1000).toFixed(1);
    }
  }

  const modelStartIdx = sortedEvents.findIndex(
    (event) => event.type === 'model_started' && eventRound(event) === round,
  );

  const reasoningDeltas = sortedEvents.filter(
    (event) => event.type === 'reasoning_delta' && eventRound(event) === round,
  );

  if (modelStartIdx === -1) {
    if (reasoningDeltas.length === 0) return '0.0';
    const first = findEventTimestamp(reasoningDeltas[0]);
    const last = findEventTimestamp(reasoningDeltas[reasoningDeltas.length - 1]);
    if (first == null || last == null || last <= first) return '0.0';
    return ((last - first) / 1000).toFixed(1);
  }

  const startedAt = findEventTimestamp(sortedEvents[modelStartIdx]);
  if (startedAt == null) return '0.0';

  let endedAt: number | null = null;
  for (let i = modelStartIdx + 1; i < sortedEvents.length; i++) {
    const event = sortedEvents[i]!;
    const roundForEvent = eventRound(event);
    if (event.type === 'model_started' && roundForEvent > round) {
      endedAt = findEventTimestamp(event);
      break;
    }
    if (event.type === 'tool_call_requested' && roundForEvent === round) {
      endedAt = findEventTimestamp(event);
      break;
    }
    if (
      roundForEvent === round &&
      (event.type === 'message_delta' || event.type === 'model_delta') &&
      typeof (event.payload as { content?: string }).content === 'string' &&
      (event.payload as { content?: string }).content!.length > 0
    ) {
      endedAt = findEventTimestamp(event);
      break;
    }
  }

  if (endedAt == null && reasoningDeltas.length > 0) {
    endedAt = findEventTimestamp(reasoningDeltas[reasoningDeltas.length - 1]);
  }

  if (endedAt == null) {
    const modelFinished = sortedEvents.find(
      (event) => event.type === 'model_finished' && eventRound(event) === round,
    );
    if (modelFinished) {
      endedAt = findEventTimestamp(modelFinished);
    }
  }

  if (endedAt == null || endedAt <= startedAt) return '0.0';
  return ((endedAt - startedAt) / 1000).toFixed(1);
}

interface PersistedTurnSegmentReasoning {
  kind: 'reasoning';
  id: string;
  text: string;
  durationSec: string;
  round: number;
}

interface PersistedTurnSegmentText {
  kind: 'text';
  id: string;
  text: string;
  /** Round the text was emitted in, so the UI can keep it interleaved with
   *  the matching reasoning/tool segments. */
  round: number;
}

interface PersistedTurnSegmentTool {
  kind: 'tool';
  id: string;
  toolCallId: string;
}

interface PersistedTurnSegmentTools {
  kind: 'tools';
  id: string;
  toolCallIds: string[];
}

type PersistedTurnSegment =
  | PersistedTurnSegmentReasoning
  | PersistedTurnSegmentText
  | PersistedTurnSegmentTool
  | PersistedTurnSegmentTools;

function collectTurnSegments(session: AgentSession): PersistedTurnSegment[] {
  const segments: PersistedTurnSegment[] = [];
  const sortedEvents = [...session.events].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));

  let reasoningRound: number | null = null;
  let reasoningText = '';
  let reasoningCount = 0;
  let toolBatchCount = 0;
  let pendingToolIds: string[] = [];
  const finishedToolIds = new Set<string>();

  // Assistant text deltas are accumulated per round so a round's answer text
  // stays interleaved between reasoning/tool segments instead of collapsing
  // into a single trailing block.
  let textRound: number | null = null;
  let textBuffer = '';
  let textCount = 0;
  let pendingReasoningDurationMs: number | undefined;

  const flushReasoning = () => {
    const text = reasoningText.trim();
    if (!text || reasoningRound == null) {
      reasoningRound = null;
      reasoningText = '';
      pendingReasoningDurationMs = undefined;
      return;
    }
    reasoningCount += 1;
    segments.push({
      kind: 'reasoning',
      id: `${session.runId}:reasoning:${reasoningCount}`,
      text,
      durationSec:
        pendingReasoningDurationMs != null
          ? (pendingReasoningDurationMs / 1000).toFixed(1)
          : computeReasoningDurationSecForRound(session, reasoningRound),
      round: reasoningRound,
    });
    reasoningRound = null;
    reasoningText = '';
    pendingReasoningDurationMs = undefined;
  };

  const flushText = () => {
    const text = textBuffer.trim();
    if (!text || textRound == null) {
      textRound = null;
      textBuffer = '';
      return;
    }
    textCount += 1;
    segments.push({
      kind: 'text',
      id: `${session.runId}:text:${textCount}`,
      text,
      round: textRound,
    });
    textRound = null;
    textBuffer = '';
  };

  const flushTools = (force = false) => {
    if (pendingToolIds.length === 0) return;
    const allFinished = pendingToolIds.every((id) => finishedToolIds.has(id));
    if (!force && !allFinished) return;

    const segmentToolIds = new Set<string>();
    for (const segment of segments) {
      if (segment.kind === 'tool') segmentToolIds.add(segment.toolCallId);
      if (segment.kind === 'tools') {
        for (const id of segment.toolCallIds) segmentToolIds.add(id);
      }
    }

    const uniquePending = pendingToolIds.filter((id) => !segmentToolIds.has(id));
    pendingToolIds = [];
    if (uniquePending.length === 0) return;

    toolBatchCount += 1;
    if (uniquePending.length === 1) {
      segments.push({
        kind: 'tool',
        id: uniquePending[0]!,
        toolCallId: uniquePending[0]!,
      });
    } else {
      segments.push({
        kind: 'tools',
        id: `${session.runId}:tools:${toolBatchCount}`,
        toolCallIds: [...uniquePending],
      });
    }
  };

  for (const event of sortedEvents) {
    if (event.type === 'reasoning_snapshot') {
      flushText();
      flushTools(true);
      flushReasoning();
      const payload = event.payload as { content?: string; round?: number; durationMs?: number };
      const content = typeof payload.content === 'string' ? payload.content.trim() : '';
      if (!content) continue;
      const round = typeof payload.round === 'number' && payload.round > 0 ? payload.round : 1;
      reasoningRound = round;
      reasoningText = content;
      if (typeof payload.durationMs === 'number' && payload.durationMs >= 0) {
        pendingReasoningDurationMs = payload.durationMs;
      }
      flushReasoning();
      continue;
    }

    if (event.type === 'reasoning_delta') {
      flushText();
      flushTools(true);
      const payload = event.payload as { content?: string; round?: number };
      const round = typeof payload.round === 'number' && payload.round > 0 ? payload.round : 1;
      if (reasoningRound !== round) {
        flushReasoning();
        reasoningRound = round;
      }
      if (typeof payload.content === 'string' && payload.content.length > 0) {
        reasoningText += payload.content;
      }
      continue;
    }

    if (event.type === 'message_delta') {
      const payload = event.payload as { content?: string; round?: number; role?: string };
      if (payload.role !== 'assistant') continue;
      const content = typeof payload.content === 'string' ? payload.content : '';
      if (content.length === 0) continue;
      // Reasoning deltas and tool calls bound to the same round precede the
      // model's answer text; flush them so the text segment lands after the
      // matching reasoning/tool segments in arrival order.
      flushReasoning();
      flushTools(true);
      const round = typeof payload.round === 'number' && payload.round > 0 ? payload.round : 1;
      if (textRound !== null && textRound !== round) {
        flushText();
      }
      textRound = round;
      textBuffer += content;
      continue;
    }

    if (event.type === 'tool_call_requested') {
      flushText();
      flushReasoning();
      const payload = event.payload as Record<string, unknown>;
      const toolCallId =
        (typeof payload.toolCallId === 'string' && payload.toolCallId) || event.id;
      pendingToolIds.push(toolCallId);
      continue;
    }

    if (event.type === 'tool_finished') {
      const payload = event.payload as Record<string, unknown>;
      const toolCallId =
        (typeof payload.toolCallId === 'string' && payload.toolCallId) || event.id;
      finishedToolIds.add(toolCallId);
      flushTools(false);
      continue;
    }

    // model_finished carries the round's full assistantContent when streaming
    // message_delta events were missing (e.g. provider doesn't stream content,
    // or the run was aborted mid-round). Without this, collectAssistantContent
    // still picks up the text from model_finished and stuffs it into message.content,
    // but collectTurnSegments emits no text segment — so the frontend appends the
    // whole content as a single trailing answer block after every tool segment.
    if (event.type === 'model_finished') {
      const payload = event.payload as {
        content?: string;
        round?: number;
      };
      const round = typeof payload.round === 'number' && payload.round > 0 ? payload.round : 1;
      const content = typeof payload.content === 'string' ? payload.content.trim() : '';
      if (content.length === 0) continue;
      if (textBuffer.trim().length > 0) {
        flushText();
        continue;
      }
      flushReasoning();
      flushTools(true);
      textRound = round;
      textBuffer = content;
      flushText();
    }
  }

  flushText();
  flushReasoning();
  flushTools(true);
  return segments;
}

function buildAssistantMessage(session: AgentSession): AgentMessage | null {
  const text = collectAssistantContent(session);
  const reasoningByRound = collectReasoningTextByRound(session);
  const reasoningBefore = reasoningByRound.get(1)?.trim() ?? '';
  const reasoningAfter = [...reasoningByRound.entries()]
    .filter(([round]) => round > 1)
    .sort(([a], [b]) => a - b)
    .map(([, value]) => value.trim())
    .filter(Boolean)
    .join('\n\n');
  const reasoning = reasoningBefore || reasoningAfter;
  const toolCalls = collectSessionToolCalls(session);
  const turnSegments = collectTurnSegments(session);
  const failureMessage = collectRunFailureMessage(session);
  const displayText = text || failureMessage;
  if (!displayText && !reasoning && toolCalls.length === 0) return null;

  const stopReason = resolveSessionStopReason(session);
  const stopped = isPersistedErrorAssistant(session, text, failureMessage);

  const beforeDurationSec = reasoningBefore
    ? computeReasoningDurationSecForRound(session, 1)
    : '0.0';
  const afterDurationSec = reasoningAfter
    ? computeReasoningDurationSecForRound(session, 2)
    : '0.0';
  const content = buildAssistantMessageContent(
    displayText!,
    reasoningBefore,
    beforeDurationSec,
    reasoningAfter,
    afterDurationSec,
  );

  return {
    id: `${session.runId}:assistant:output`,
    role: 'assistant',
    content,
    createdAt: session.updatedAt,
    metadata: {
      runId: session.runId,
      sessionId: session.sessionId,
      threadId: session.threadId,
      source: 'run_output',
      stopReason,
      ...(stopped ? { stopped: true } : {}),
      ...(session.pendingPermission ? { pendingPermission: session.pendingPermission } : {}),
      ...(toolCalls.length > 0 ? { toolCalls } : {}),
      ...(turnSegments.length > 0 ? { turnSegments } : {}),
      ...(reasoningBefore
        ? {
            reasoning: {
              text: reasoningBefore,
              durationSec: beforeDurationSec,
            },
          }
        : {}),
      ...(reasoningAfter
        ? {
            reasoningAfter: {
              text: reasoningAfter,
              durationSec: afterDurationSec,
            },
          }
        : {}),
    },
  };
}

function buildAssistantMessageContent(
  text: string,
  reasoningBefore: string,
  beforeDurationSec: string,
  reasoningAfter: string,
  afterDurationSec: string,
): string | AgentMessageContentPart[] {
  const parts: AgentMessageContentPart[] = [];
  if (reasoningBefore) {
    parts.push({
      kind: 'reasoning',
      text: reasoningBefore,
      metadata: { durationSec: beforeDurationSec, segment: 'before' },
    });
  }
  if (reasoningAfter) {
    parts.push({
      kind: 'reasoning',
      text: reasoningAfter,
      metadata: { durationSec: afterDurationSec, segment: 'after' },
    });
  }
  if (parts.length === 0) return text;
  if (text) {
    parts.push({ kind: 'text', text });
  }
  return parts;
}

function buildThreadRunMessages(session: AgentSession): AgentMessage[] {
  const userSourceMessages = session.messages.filter((message) => message.role === 'user');
  const turnInputMessages = userSourceMessages.some((message) => message.metadata?.turnInput === true)
    ? userSourceMessages.filter((message) => message.metadata?.turnInput === true)
    : userSourceMessages.slice(-1);
  const userMessages = turnInputMessages
    .map((message, index) => ({
      ...message,
      content: message.content ?? '',
      id: message.id ?? `${session.runId}:thread:user:${index}`,
      createdAt: message.createdAt ?? session.createdAt,
      metadata: {
        ...message.metadata,
        runId: session.runId,
        sessionId: session.sessionId,
        threadId: session.threadId,
        source: message.metadata?.source ?? 'thread_run_input'
      }
    }));

  const assistantMessage = buildThreadAssistantMessage(session);
  const assistantMessages: AgentMessage[] = assistantMessage ? [assistantMessage] : [];

  return [...userMessages, ...assistantMessages];
}

function buildThreadAssistantMessage(session: AgentSession): AgentMessage | null {
  const built = buildAssistantMessage(session);
  if (!built) return null;
  return {
    ...built,
    id: `${session.runId}:thread:assistant`,
    metadata: {
      ...built.metadata,
      source: 'thread_run_output'
    }
  };
}

function collectAssistantReasoning(session: AgentSession): string {
  const deltaText = session.events.flatMap((event) => {
    if (event.type !== 'reasoning_delta') return [];
    const content = event.payload.content;
    return typeof content === 'string' && content.length > 0 ? [content] : [];
  });
  if (deltaText.length > 0) return deltaText.join('');

  const snapshot = [...session.events]
    .reverse()
    .find((event) => event.type === 'reasoning_snapshot');
  const fromSnapshot = snapshot?.payload?.content;
  return typeof fromSnapshot === 'string' && fromSnapshot.trim() ? fromSnapshot.trim() : '';
}

function findEventTimestamp(event: AgentEvent | undefined): number | null {
  if (!event?.timestamp) return null;
  const value = new Date(event.timestamp).getTime();
  return Number.isFinite(value) ? value : null;
}

function resolveSessionStopReason(session: AgentSession): string | undefined {
  const fromOutput = session.output?.stopReason;
  if (typeof fromOutput === 'string' && fromOutput.trim()) return fromOutput.trim();

  const traceEvent = [...session.events]
    .reverse()
    .find((event) => event.type === 'custom' && event.payload.name === 'stream_final_trace');
  const traceReason =
    traceEvent?.type === 'custom' &&
    traceEvent.payload.data &&
    typeof traceEvent.payload.data === 'object'
      ? (traceEvent.payload.data as Record<string, unknown>).stopReason
      : undefined;
  return typeof traceReason === 'string' && traceReason.trim() ? traceReason.trim() : undefined;
}

function collectRunFailureMessage(session: AgentSession): string | undefined {
  const runFailed = [...session.events].reverse().find((event) => event.type === 'run_failed');
  if (runFailed?.type === 'run_failed') {
    const error = runFailed.payload.error;
    if (typeof error === 'string' && error.trim()) return error.trim();
  }

  if (session.status === 'failed') {
    return 'Agent 运行失败';
  }

  const stopReason = resolveSessionStopReason(session);
  switch (stopReason) {
    case 'empty_response':
      return '模型未返回内容';
    case 'budget_exceeded':
      return '已达到预算上限';
    case 'tool_error':
      return '工具执行失败';
    case 'max_rounds':
      return '已达到最大推理轮次';
    default:
      return undefined;
  }
}

function isPersistedErrorAssistant(
  session: AgentSession,
  text: string,
  failureMessage?: string,
): boolean {
  if (session.status === 'failed') return true;
  if (failureMessage && failureMessage === text) return true;
  const stopReason = resolveSessionStopReason(session);
  return (
    stopReason === 'empty_response' ||
    stopReason === 'budget_exceeded' ||
    stopReason === 'tool_error' ||
    stopReason === 'max_rounds'
  );
}

function assistantContentDeltaKey(round: number | undefined, content: string): string {
  return `${typeof round === 'number' ? round : 'unknown'}:${content}`;
}

function collectAssistantContent(session: AgentSession): string {
  const outputContent = session.output?.content;
  if (typeof outputContent === 'string' && outputContent.length > 0) return outputContent;

  const finished = [...session.events]
    .reverse()
    .find((event) => event.type === 'message_finished' && event.payload.role === 'assistant');
  if (finished?.type === 'message_finished' && typeof finished.payload.content === 'string') {
    const content = finished.payload.content;
    if (content.length > 0) return content;
  }

  const modelFinished = [...session.events]
    .reverse()
    .find((event) => event.type === 'model_finished');
  const fromModelFinished = modelFinished?.payload?.content;
  if (typeof fromModelFinished === 'string' && fromModelFinished.length > 0) {
    return fromModelFinished;
  }

  const sortedEvents = [...session.events].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
  const messageDeltaKeys = new Set(
    sortedEvents
      .filter(
        (event): event is Extract<AgentEvent, { type: 'message_delta' }> =>
          event.type === 'message_delta' &&
          event.payload.role === 'assistant' &&
          event.payload.content.length > 0,
      )
      .map((event) => assistantContentDeltaKey(event.payload.round, event.payload.content)),
  );

  const deltas = sortedEvents.flatMap((event) => {
    if (event.type === 'message_delta' && event.payload.role === 'assistant') {
      return event.payload.content.length > 0 ? [event.payload.content] : [];
    }
    if (event.type === 'model_delta') {
      const content = event.payload.content;
      if (typeof content !== 'string' || content.length === 0) return [];
      const key = assistantContentDeltaKey(event.payload.round, content);
      if (messageDeltaKeys.has(key)) return [];
      return [content];
    }
    return [];
  });
  return deltas.join('');
}