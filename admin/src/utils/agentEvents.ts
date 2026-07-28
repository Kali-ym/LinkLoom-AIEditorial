export type AgentEventSchemaVersion = 'agent-event-v1';

export type AgentEventType =
  | 'run_queued'
  | 'run_started'
  | 'run_finished'
  | 'run_failed'
  | 'run_paused'
  | 'run_resumed'
  | 'run_cancel_requested'
  | 'run_cancelled'
  | 'run_archived'
  | 'turn_started'
  | 'turn_finished'
  | 'message_started'
  | 'message_delta'
  | 'message_finished'
  | 'reasoning_delta'
  | 'model_started'
  | 'model_delta'
  | 'model_finished'
  | 'tool_call_requested'
  | 'tool_call_validated'
  | 'tool_started'
  | 'tool_finished'
  | 'permission_required'
  | 'permission_resolved'
  | 'hitl_required'
  | 'hitl_resolved'
  | 'observation_added'
  | 'context_compacted'
  | 'checkpoint_saved'
  | 'artifact_saved'
  | 'budget_updated'
  | 'custom';

export interface AgentEventItem {
  id: string;
  type: AgentEventType | string;
  runId?: string;
  sessionId?: string;
  timestamp: string;
  schemaVersion?: AgentEventSchemaVersion | string;
  sequence?: number;
  parentEventId?: string;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  correlationId?: string;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface SseFrameParseResult<T> {
  events: T[];
  done: boolean;
  rest: string;
}

export interface SseFrame<T> {
  event?: string;
  id?: string;
  retry?: number;
  data: T;
}

export interface AgentEventComparisonRow {
  index: number;
  original?: AgentTimelineProjection;
  replay?: AgentTimelineProjection;
  differs: boolean;
}

export interface AgentTimelineProjection {
  id: string;
  type: string;
  timestamp: string;
  sequence?: number;
  icon: string;
  summary: string;
  payloadTitle: string;
}

export interface AgentRunEventProjection {
  timeline: AgentTimelineProjection[];
  messageText: string;
  reasoningText: string;
  toolCalls: Array<{ id: string; toolName: string; arguments?: unknown; status: 'requested' | 'started' | 'finished'; success?: boolean }>;
  budgetSnapshots: AgentEventItem[];
  artifacts: AgentEventItem[];
}

export const AGENT_EVENT_SCHEMA_VERSION: AgentEventSchemaVersion = 'agent-event-v1';

export const ACTIVE_AGENT_RUN_STATUSES = ['queued', 'running', 'paused', 'cancelling'] as const;

export const DETAIL_REFRESH_AGENT_EVENT_TYPES = new Set<string>([
  'run_finished',
  'run_failed',
  'run_paused',
  'run_resumed',
  'run_cancel_requested',
  'run_cancelled',
  'run_archived',
  'permission_required',
  'permission_resolved',
  'hitl_required',
  'hitl_resolved',
  'checkpoint_saved',
  'artifact_saved',
  'budget_updated'
]);

export const TERMINAL_AGENT_EVENT_TYPES = new Set<string>([
  'run_finished',
  'run_failed',
  'run_cancelled',
  'run_archived'
]);

export const AGENT_EVENT_ICON: Record<string, string> = {
  run_queued: 'hourglass_empty',
  run_started: 'play_circle',
  run_finished: 'check_circle',
  run_failed: 'error',
  run_paused: 'pause_circle',
  run_resumed: 'resume',
  run_cancel_requested: 'pending',
  run_cancelled: 'cancel',
  run_archived: 'archive',
  turn_started: 'start',
  turn_finished: 'done',
  message_started: 'chat',
  message_delta: 'chat_bubble',
  message_finished: 'forum',
  reasoning_delta: 'psychology',
  model_started: 'psychology',
  model_delta: 'edit_note',
  model_finished: 'psychology_alt',
  tool_call_requested: 'build',
  tool_call_validated: 'rule',
  tool_started: 'build_circle',
  tool_finished: 'verified',
  permission_required: 'lock',
  permission_resolved: 'lock_open',
  hitl_required: 'person_alert',
  hitl_resolved: 'person_check',
  observation_added: 'visibility',
  checkpoint_saved: 'save',
  artifact_saved: 'attach_file',
  context_compacted: 'compress',
  budget_updated: 'speed',
  custom: 'star'
};

function readEventSequence(event: AgentEventItem): number | undefined {
  if (typeof event.sequence === 'number') return event.sequence;
  const legacySeq = (event as AgentEventItem & { seq?: number }).seq;
  return typeof legacySeq === 'number' ? legacySeq : undefined;
}

export function normalizeAgentEventItem(event: AgentEventItem): AgentEventItem {
  const sequence = readEventSequence(event);
  return {
    ...event,
    schemaVersion: event.schemaVersion ?? AGENT_EVENT_SCHEMA_VERSION,
    sequence,
    payload: isRecord(event.payload) ? event.payload : {},
    metadata: isRecord(event.metadata) ? event.metadata : undefined
  };
}

export function normalizeAgentEvents(events: AgentEventItem[]): AgentEventItem[] {
  return sortAgentEvents(events.map((event) => normalizeAgentEventItem(event)));
}

export function mergeAgentEvents(current: AgentEventItem[], incoming: AgentEventItem[]): AgentEventItem[] {
  const byId = new Map<string, AgentEventItem>();
  for (const event of current) byId.set(event.id, normalizeAgentEventItem(event));
  for (const event of incoming) byId.set(event.id, normalizeAgentEventItem(event));
  return sortAgentEvents([...byId.values()]);
}

export function upsertAgentEvent(events: AgentEventItem[], event: AgentEventItem): AgentEventItem[] {
  return mergeAgentEvents(events, [event]);
}

export function sortAgentEvents(events: AgentEventItem[]): AgentEventItem[] {
  return [...events].sort((a, b) => {
    const aSeq = typeof a.sequence === 'number' ? a.sequence : Number.POSITIVE_INFINITY;
    const bSeq = typeof b.sequence === 'number' ? b.sequence : Number.POSITIVE_INFINITY;
    if (aSeq !== bSeq) return aSeq - bSeq;
    const time = a.timestamp.localeCompare(b.timestamp);
    if (time !== 0) return time;
    return a.id.localeCompare(b.id);
  });
}

export function parseSseFrames<T>(input: string, parsePayload: (payload: string) => T): SseFrameParseResult<T> {
  const parsed = parseSseFrameObjects(input, parsePayload);
  return {
    events: parsed.events.map((frame) => frame.data),
    done: parsed.done,
    rest: parsed.rest
  };
}

export function parseSseFrameObjects<T>(input: string, parsePayload: (payload: string) => T): SseFrameParseResult<SseFrame<T>> {
  const normalizedInput = input.replace(/\r\n/g, '\n');
  const frames = normalizedInput.split('\n\n');
  const rest = frames.pop() ?? '';
  const events: Array<SseFrame<T>> = [];
  let done = false;

  for (const frame of frames) {
    const parsed = parseSseFrame(frame);
    if (!parsed.data) continue;
    if (parsed.data === '[DONE]') {
      done = true;
      continue;
    }
    const eventFrame: SseFrame<T> = { data: parsePayload(parsed.data) };
    if (parsed.event !== undefined) eventFrame.event = parsed.event;
    if (parsed.id !== undefined) eventFrame.id = parsed.id;
    if (parsed.retry !== undefined) eventFrame.retry = parsed.retry;
    events.push(eventFrame);
  }

  return { events, done, rest };
}

function parseSseFrame(frame: string): { event?: string; id?: string; retry?: number; data: string } {
  const dataLines: string[] = [];
  let event: string | undefined;
  let id: string | undefined;
  let retry: number | undefined;

  for (const line of frame.split('\n')) {
    if (!line || line.startsWith(':')) continue;
    const separator = line.indexOf(':');
    const field = separator >= 0 ? line.slice(0, separator) : line;
    const rawValue = separator >= 0 ? line.slice(separator + 1) : '';
    const value = rawValue.startsWith(' ') ? rawValue.slice(1) : rawValue;

    if (field === 'data') dataLines.push(value);
    if (field === 'event') event = value;
    if (field === 'id') id = value;
    if (field === 'retry') {
      const parsedRetry = Number(value);
      if (Number.isFinite(parsedRetry)) retry = parsedRetry;
    }
  }

  return { event, id, retry, data: dataLines.join('\n').trim() };
}

export function summarizeAgentEvent(event: AgentEventItem): string {
  const payload = event.payload;
  switch (event.type) {
    case 'run_queued':
    case 'run_started':
    case 'run_finished':
    case 'run_paused':
    case 'run_resumed':
    case 'run_cancel_requested':
    case 'run_cancelled':
    case 'run_archived':
      return [payload.status, payload.reason].map(asString).filter(Boolean).join(' · ');
    case 'tool_call_requested':
    case 'tool_started':
    case 'tool_finished':
    case 'tool_call_validated':
      return [payload.toolName, formatToolResultSummary(payload)].map(asString).filter(Boolean).join(' · ');
    case 'model_started':
      return [payload.providerId, payload.model].map(asString).filter(Boolean).join(' · ');
    case 'model_finished':
      return asString(payload.content).slice(0, 60) || formatModelUsageSummary(payload);
    case 'message_delta':
    case 'model_delta':
    case 'reasoning_delta':
      return asString(payload.content).slice(0, 60);
    case 'run_failed':
      return asString(payload.error);
    case 'permission_required':
      return asString(asRecord(payload.subject)?.toolName) || asString(payload.permissionId);
    case 'permission_resolved':
      return [payload.action, payload.reason].map(asString).filter(Boolean).join(' · ');
    case 'hitl_required':
      return asString(payload.prompt) || asString(payload.kind);
    case 'hitl_resolved':
      return [payload.action, payload.reason].map(asString).filter(Boolean).join(' · ');
    case 'budget_updated':
      return formatBudgetSummary(payload);
    case 'checkpoint_saved':
      return [payload.checkpointId, payload.reason].map(asString).filter(Boolean).join(' · ');
    case 'artifact_saved':
      return [payload.kind, payload.artifactId].map(asString).filter(Boolean).join(' · ');
    case 'context_compacted':
      return [payload.strategy, payload.summary].map(asString).filter(Boolean).join(' · ');
    case 'custom':
      return asString(payload.name);
    default:
      return '';
  }
}

export function projectAgentTimeline(events: AgentEventItem[]): AgentTimelineProjection[] {
  return sortAgentEvents(events).map((event) => ({
    id: event.id,
    type: event.type,
    timestamp: event.timestamp,
    sequence: event.sequence,
    icon: AGENT_EVENT_ICON[event.type] || 'circle',
    summary: summarizeAgentEvent(event),
    payloadTitle: JSON.stringify(event.payload)
  }));
}

export function compareAgentEventTimelines(
  original: AgentEventItem[],
  replay: AgentEventItem[]
): AgentEventComparisonRow[] {
  const originalTimeline = projectAgentTimeline(original);
  const replayTimeline = projectAgentTimeline(replay);
  const maxLen = Math.max(originalTimeline.length, replayTimeline.length);
  const rows: AgentEventComparisonRow[] = [];

  for (let index = 0; index < maxLen; index += 1) {
    const originalEvent = originalTimeline[index];
    const replayEvent = replayTimeline[index];
    rows.push({
      index,
      original: originalEvent,
      replay: replayEvent,
      differs:
        !originalEvent ||
        !replayEvent ||
        originalEvent.type !== replayEvent.type ||
        originalEvent.summary !== replayEvent.summary
    });
  }

  return rows;
}

export function projectAgentRunEvents(events: AgentEventItem[]): AgentRunEventProjection {
  const sorted = sortAgentEvents(events);
  return {
    timeline: projectAgentTimeline(sorted),
    messageText: sorted
      .filter((event) => event.type === 'message_delta' || event.type === 'model_delta')
      .map((event) => asString(event.payload.content))
      .join(''),
    reasoningText: sorted
      .filter((event) => event.type === 'reasoning_delta')
      .map((event) => asString(event.payload.content))
      .join(''),
    toolCalls: sorted.flatMap((event) => projectToolCall(event)),
    budgetSnapshots: sorted.filter((event) => event.type === 'budget_updated'),
    artifacts: sorted.filter((event) => event.type === 'artifact_saved')
  };
}

export function isAgentRunTerminalEvent(event: AgentEventItem): boolean {
  return TERMINAL_AGENT_EVENT_TYPES.has(event.type);
}

export function shouldRefreshAgentRunDetail(event: AgentEventItem): boolean {
  return DETAIL_REFRESH_AGENT_EVENT_TYPES.has(event.type);
}

function projectToolCall(event: AgentEventItem): AgentRunEventProjection['toolCalls'] {
  if (
    event.type !== 'tool_call_requested' &&
    event.type !== 'tool_started' &&
    event.type !== 'tool_finished'
  ) {
    return [];
  }
  return [
    {
      id: asString(event.payload.toolCallId) || `${event.id}:${asString(event.payload.toolName)}`,
      toolName: asString(event.payload.toolName),
      arguments: event.payload.arguments,
      status:
        event.type === 'tool_finished'
          ? 'finished'
          : event.type === 'tool_started'
            ? 'started'
            : 'requested',
      success: typeof event.payload.success === 'boolean' ? event.payload.success : undefined
    }
  ];
}

function formatBudgetSummary(payload: Record<string, unknown>): string {
  const parts = [
    typeof payload.modelCalls === 'number' ? `model ${payload.modelCalls}` : '',
    typeof payload.toolCalls === 'number' ? `tool ${payload.toolCalls}` : '',
    typeof payload.estimatedCostUsd === 'number' ? `$${payload.estimatedCostUsd.toFixed(4)}` : ''
  ].filter(Boolean);
  return parts.join(' · ');
}

function formatModelUsageSummary(payload: Record<string, unknown>): string {
  const usage = asRecord(payload.usage);
  const inputTokens = typeof usage?.inputTokens === 'number' ? usage.inputTokens : usage?.prompt_tokens;
  const outputTokens = typeof usage?.outputTokens === 'number' ? usage.outputTokens : usage?.completion_tokens;
  const parts = [
    typeof inputTokens === 'number' ? `in ${inputTokens}` : '',
    typeof outputTokens === 'number' ? `out ${outputTokens}` : '',
    typeof usage?.totalTokens === 'number' ? `total ${usage.totalTokens}` : typeof usage?.total_tokens === 'number' ? `total ${usage.total_tokens}` : ''
  ].filter(Boolean);
  return parts.join(' · ');
}

function formatToolResultSummary(payload: Record<string, unknown>): string {
  if (typeof payload.valid === 'boolean' && !payload.valid) return asString(payload.error) || 'invalid';
  if (typeof payload.success === 'boolean') return payload.success ? 'success' : asString(payload.error) || 'failed';
  return '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}