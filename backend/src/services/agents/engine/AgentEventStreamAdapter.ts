import type { AgentEvent } from './AgentEvent.js';

export type LegacyAgentStreamChunk =
  | { type: 'round_start'; round?: number }
  | { type: 'content'; content: string; round?: number }
  | { type: 'final_content'; content: string; round?: number }
  | { type: 'tool_calls_delta'; tool_calls: unknown[]; round?: number }
  | { type: 'tool_calls'; tool_calls: unknown[]; round?: number }
  | { type: 'trace_round'; assistantContent?: string; toolCalls?: unknown[]; round?: number }
  | { type: 'tool_start'; tool: string; args?: unknown; round?: number }
  | { type: 'tool_result'; tool: string; result?: unknown; round?: number }
  | { type: 'trace_observation'; observation: unknown; round?: number }
  | { type: 'tool_error'; tool: string; error?: string; round?: number }
  | { type: 'final_trace'; stopReason?: string; round?: number }
  | { type: 'permission_required'; request: unknown };

const LEGACY_STREAM_CHUNK_TYPES = new Set<LegacyAgentStreamChunk['type']>([
  'round_start',
  'content',
  'final_content',
  'tool_calls_delta',
  'tool_calls',
  'trace_round',
  'tool_start',
  'tool_result',
  'trace_observation',
  'tool_error',
  'final_trace',
  'permission_required'
]);

export interface AgentEventLegacyStreamAdapter {
  mapEvent(event: AgentEvent): LegacyAgentStreamChunk[];
  mapEvents(events: AgentEvent[]): LegacyAgentStreamChunk[];
}

export function createAgentEventLegacyStreamAdapter(): AgentEventLegacyStreamAdapter {
  const mapEvents = (events: AgentEvent[]): LegacyAgentStreamChunk[] => {
    const messageDeltaKeys = new Set(
      events
        .filter((event): event is Extract<AgentEvent, { type: 'message_delta' }> => event.type === 'message_delta')
        .map(contentDeltaKey)
    );
    const consumedIndexes = new Set<number>();

    return events.flatMap((event, index) => {
      if (consumedIndexes.has(index)) return [];
      if (event.type === 'model_delta' && messageDeltaKeys.has(contentDeltaKey(event))) {
        return [];
      }
      if (event.type === 'tool_call_requested') {
        const group = collectToolCallRequestGroup(events, event, consumedIndexes);
        return filterLegacyStreamChunks(group.length > 0 ? [toolCallsChunkFromEvents(group)] : []);
      }
      return filterLegacyStreamChunks(mapSingleAgentEventToLegacyChunks(event));
    });
  };

  return {
    mapEvent: (event) => mapEvents([event]),
    mapEvents
  };
}

function filterLegacyStreamChunks(chunks: LegacyAgentStreamChunk[]): LegacyAgentStreamChunk[] {
  return chunks.filter((chunk) => LEGACY_STREAM_CHUNK_TYPES.has(chunk.type));
}

function mapSingleAgentEventToLegacyChunks(event: AgentEvent): LegacyAgentStreamChunk[] {
  switch (event.type) {
    case 'model_started':
      return [{ type: 'round_start', round: event.payload.round }];
    case 'message_delta':
      return event.payload.content ? [{ type: 'content', content: event.payload.content, round: event.payload.round }] : [];
    case 'model_delta':
      return event.payload.content ? [{ type: 'content', content: event.payload.content, round: event.payload.round }] : [];
    case 'message_finished':
      if (legacyChunkType(event) === 'final_content') return [];
      return event.payload.role === 'assistant' && event.payload.content
        ? [{ type: 'final_content', content: event.payload.content, round: event.payload.round }]
        : [];
    case 'model_finished':
      if (legacyChunkType(event) === 'final_content') {
        const legacy = legacyChunk(event);
        return [
          {
            type: 'final_content',
            content: typeof legacy.content === 'string' ? legacy.content : event.payload.content ?? '',
            round: event.payload.round
          }
        ];
      }
      if (legacyChunkType(event) === 'trace_round') {
        const legacy = legacyChunk(event);
        return [
          {
            type: 'trace_round',
            assistantContent: event.payload.content,
            toolCalls: asArray(legacy.toolCalls),
            round: event.payload.round
          }
        ];
      }
      return event.payload.content ? [{ type: 'final_content', content: event.payload.content, round: event.payload.round }] : [];
    case 'tool_call_requested':
      return [
        {
          type: 'tool_calls',
          tool_calls: [
            {
              id: event.payload.toolCallId,
              requestKey: event.payload.requestKey,
              name: event.payload.toolName,
              arguments: event.payload.arguments
            }
          ],
          round: event.payload.round
        }
      ];
    case 'tool_started':
      return [
        {
          type: 'tool_start',
          tool: event.payload.toolName,
          args: event.payload.arguments,
          round: event.payload.round
        }
      ];
    case 'tool_finished':
      return mapToolFinishedToLegacyChunks(event);
    case 'custom':
      return mapCustomEventToLegacyChunks(event);
    case 'permission_required':
      return [{ type: 'permission_required', request: event.payload }];
    default:
      return [];
  }
}

function mapToolFinishedToLegacyChunks(
  event: Extract<AgentEvent, { type: 'tool_finished' }>
): LegacyAgentStreamChunk[] {
  const legacyType = legacyChunkType(event);

  if (legacyType === 'tool_error') {
    return [
      {
        type: 'tool_error',
        tool: event.payload.toolName,
        error: event.payload.error,
        round: event.payload.round
      }
    ];
  }

  const observation = {
    toolCallId: event.payload.toolCallId,
    toolName: event.payload.toolName,
    success: event.payload.success,
    content: event.payload.content,
    data: event.payload.data,
    error: event.payload.error,
    durationMs: event.payload.durationMs,
    artifactId: event.payload.artifactId
  };

  if (legacyType === 'trace_observation') {
    const traceObservation: LegacyAgentStreamChunk = {
      type: 'trace_observation',
      observation,
      round: event.payload.round
    };
    if (!event.payload.success) return [traceObservation];
    return [
      {
        type: 'tool_result',
        tool: event.payload.toolName,
        result: event.payload.data ?? event.payload.content,
        round: event.payload.round
      },
      traceObservation
    ];
  }

  if (!event.payload.success) {
    return [
      {
        type: 'tool_error',
        tool: event.payload.toolName,
        error: event.payload.error,
        round: event.payload.round
      }
    ];
  }

  return [
    {
      type: 'tool_result',
      tool: event.payload.toolName,
      result: event.payload.data ?? event.payload.content,
      round: event.payload.round
    },
    {
      type: 'trace_observation',
      observation,
      round: event.payload.round
    }
  ];
}

function mapCustomEventToLegacyChunks(
  event: Extract<AgentEvent, { type: 'custom' }>
): LegacyAgentStreamChunk[] {
  const data = asRecord(event.payload.data);
  if (event.payload.name === 'tool_calls_delta') {
    return [
      {
        type: 'tool_calls_delta',
        tool_calls: asArray(data.toolCalls),
        round: typeof data.round === 'number' ? data.round : undefined
      }
    ];
  }
  if (event.payload.name === 'stream_final_trace') {
    return [
      {
        type: 'final_trace',
        stopReason: typeof data.stopReason === 'string' ? data.stopReason : undefined
      }
    ];
  }
  return [];
}

function contentDeltaKey(event: Extract<AgentEvent, { type: 'message_delta' | 'model_delta' }>): string {
  const round = typeof event.payload.round === 'number' ? event.payload.round : 'unknown';
  return `${round}:${event.payload.content}`;
}

function collectToolCallRequestGroup(
  events: AgentEvent[],
  firstEvent: Extract<AgentEvent, { type: 'tool_call_requested' }>,
  consumedIndexes: Set<number>
): Array<Extract<AgentEvent, { type: 'tool_call_requested' }>> {
  const groupKey = toolCallGroupKey(firstEvent);
  const group: Array<Extract<AgentEvent, { type: 'tool_call_requested' }>> = [];

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if (event.type !== 'tool_call_requested') continue;
    if (toolCallGroupKey(event) !== groupKey) continue;
    consumedIndexes.add(index);
    group.push(event);
  }

  return group;
}

function toolCallsChunkFromEvents(
  events: Array<Extract<AgentEvent, { type: 'tool_call_requested' }>>
): LegacyAgentStreamChunk {
  const first = events[0];
  const legacy = first ? legacyChunk(first) : {};
  const legacyToolCalls = asArray(legacy.tool_calls);
  return {
    type: 'tool_calls',
    tool_calls: events.map((event) => legacyToolCallForEvent(event, legacyToolCalls)),
    round: typeof legacy.round === 'number' ? legacy.round : first?.payload.round
  };
}

function legacyToolCallForEvent(
  event: Extract<AgentEvent, { type: 'tool_call_requested' }>,
  legacyToolCalls: unknown[]
): unknown {
  const matched = legacyToolCalls.find((toolCall) => {
    const record = asRecord(toolCall);
    if (event.payload.toolCallId && record.id === event.payload.toolCallId) return true;
    if (event.payload.requestKey && record.requestKey === event.payload.requestKey) return true;
    return false;
  });
  if (matched) return matched;
  return {
    id: event.payload.toolCallId,
    requestKey: event.payload.requestKey,
    name: event.payload.toolName,
    arguments: event.payload.arguments
  };
}

function toolCallGroupKey(event: Extract<AgentEvent, { type: 'tool_call_requested' }>): string {
  const legacyChunkId = event.metadata?.legacyChunkId;
  if (typeof legacyChunkId === 'string' && legacyChunkId.trim()) {
    return legacyChunkId;
  }

  const round = typeof event.payload.round === 'number' ? event.payload.round : 'unknown';
  const sequence = typeof event.sequence === 'number' ? event.sequence : 'unknown';
  return `${event.runId}:${round}:${sequence}`;
}

function legacyChunkType(event: AgentEvent): string | undefined {
  const value = event.metadata?.legacyChunkType;
  return typeof value === 'string' ? value : undefined;
}

function legacyChunk(event: AgentEvent): Record<string, any> {
  return asRecord(event.metadata?.legacyChunk);
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' ? (value as Record<string, any>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
