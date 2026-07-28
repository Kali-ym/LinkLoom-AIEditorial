import type {
  AgentRunRound,
  AgentRunTrace,
  AgentToolCallTrace,
  AgentToolObservation
} from '../../../types/agent.js';
import type { AiBuildStreamEvent } from '../../../types/aiBuilder.js';
import type { WorkflowProgressPayload } from '../WorkflowEngine.js';
import { normalizeAgentEvent, type AgentEvent } from './AgentEvent.js';
import type { AgentRunSpec } from './AgentRunSpec.js';

export interface AgentEventMappingContext {
  runId: string;
  sessionId: string;
  timestamp?: string;
  sequenceStart?: number;
  metadata?: Record<string, unknown>;
}

export function agentEventContextFromSpec(
  spec: AgentRunSpec,
  metadata?: Record<string, unknown>
): AgentEventMappingContext {
  return {
    runId: spec.runId,
    sessionId: spec.sessionId,
    metadata: {
      source: spec.source,
      agentId: spec.agentDef?.id || spec.temporaryAgentDef?.id,
      workflowId: spec.workflowDef?.id,
      ...metadata
    }
  };
}

export function mapTraceToAgentEvents(
  trace: AgentRunTrace | undefined,
  ctx: AgentEventMappingContext
): AgentEvent[] {
  if (!trace) return [];

  const events: AgentEvent[] = [];
  let sequence = ctx.sequenceStart ?? 1;

  for (const round of trace.rounds) {
    events.push(createModelFinishedEvent(ctx, sequence++, round));

    for (const toolCall of round.toolCalls) {
      events.push(createToolCallRequestedEvent(ctx, sequence++, round.index, toolCall));
    }

    for (const observation of round.observations) {
      events.push(createToolFinishedEvent(ctx, sequence++, round.index, observation));
      events.push(createObservationAddedEvent(ctx, sequence++, round.index, observation));
    }
  }

  return events;
}

export function mapStreamChunkToAgentEvents(
  chunk: unknown,
  ctx: AgentEventMappingContext
): AgentEvent[] {
  const payload = asRecord(chunk);
  const type = typeof payload.type === 'string' ? payload.type : '';
  const sequence = ctx.sequenceStart ?? 1;
  const round = typeof payload.round === 'number' ? payload.round : undefined;

  switch (type) {
    case 'round_start':
      return [
        baseEvent(ctx, 'turn_started', sequence, { round }),
        baseEvent(ctx, 'message_started', sequence + 1, {
          role: 'assistant',
          round
        }),
        baseEvent(ctx, 'model_started', sequence + 2, {
          providerId: asString(ctx.metadata?.providerId),
          model: asString(ctx.metadata?.model),
          round
        })
      ];
    case 'content':
      return [
        baseEvent(ctx, 'model_delta', sequence, { content: asString(payload.content), round }),
        baseEvent(ctx, 'message_delta', sequence + 1, {
          role: 'assistant',
          content: asString(payload.content),
          blockKind: 'text',
          round
        })
      ];
    case 'reasoning':
      return [
        baseEvent(ctx, 'reasoning_delta', sequence, {
          content: asString(payload.content),
          round
        })
      ];
    case 'final_content': {
      const provider = asRecord(payload.provider);
      const budget = asRecord(payload.budget);
      const reasoning = asString(payload.reasoning);
      const reasoningStreamed = payload.reasoningStreamed === true;
      const reasoningDurationMs =
        typeof payload.reasoningDurationMs === 'number' ? payload.reasoningDurationMs : undefined;
      const legacy = {
        type,
        content: asString(payload.content),
        round
      };
      const events: AgentEvent[] = [];
      let seq = sequence;
      if (reasoning) {
        events.push(
          baseEvent(ctx, 'reasoning_snapshot', seq++, {
            content: reasoning,
            round,
            durationMs: reasoningDurationMs,
            phase: 'final'
          })
        );
      }
      // Only emit a reasoning_delta snapshot when reasoning was NOT already streamed
      // token-by-token. final_content always carries reasoning for DB replay, but
      // duplicating it here would create a second "deep thinking" block in the UI.
      if (reasoning && !reasoningStreamed) {
        events.push(
          baseEvent(ctx, 'reasoning_delta', seq++, {
            content: reasoning,
            round
          })
        );
      }
      events.push(
        withLegacyChunk(
          baseEvent(ctx, 'model_finished', seq++, {
            content: legacy.content,
            reasoning: reasoning || undefined,
            reasoningStreamed,
            usage: payload.usage,
            provider: Object.keys(provider).length > 0 ? provider : undefined,
            budget: Object.keys(budget).length > 0 ? budget : undefined,
            round
          }),
          type,
          legacy,
          `${ctx.runId}:${seq - 1}:${type}`
        ),
        withLegacyChunk(
          baseEvent(ctx, 'message_finished', seq, {
            role: 'assistant',
            content: legacy.content,
            round
          }),
          type,
          legacy,
          `${ctx.runId}:${seq}:${type}`
        )
      );
      return events;
    }
    case 'trace_round': {
      const provider = asRecord(payload.provider);
      const budget = asRecord(payload.budget);
      const reasoning = asString(payload.reasoning);
      const reasoningStreamed = payload.reasoningStreamed === true;
      const reasoningDurationMs =
        typeof payload.reasoningDurationMs === 'number' ? payload.reasoningDurationMs : undefined;
      const legacy = {
        type,
        assistantContent: asString(payload.assistantContent),
        toolCalls: asArray(payload.toolCalls),
        round
      };
      const events: AgentEvent[] = [];
      let seq = sequence;
      if (reasoning) {
        events.push(
          baseEvent(ctx, 'reasoning_snapshot', seq++, {
            content: reasoning,
            round,
            durationMs: reasoningDurationMs,
            phase: 'pre_tool'
          })
        );
      }
      events.push(
        withLegacyChunk(
          baseEvent(ctx, 'model_finished', seq, {
            content: legacy.assistantContent,
            reasoning: reasoning || undefined,
            reasoningStreamed,
            usage: payload.usage,
            provider: Object.keys(provider).length > 0 ? provider : undefined,
            budget: Object.keys(budget).length > 0 ? budget : undefined,
            round
          }),
          type,
          legacy,
          `${ctx.runId}:${seq}:${type}`
        )
      );
      return events;
    }
    case 'tool_calls_delta':
      return [
        baseEvent(ctx, 'custom', sequence, {
          name: 'tool_calls_delta',
          data: {
            toolCalls: asArray(payload.tool_calls),
            round
          }
        })
      ];
    case 'tool_calls': {
      const legacy = {
        type,
        tool_calls: asArray(payload.tool_calls),
        round
      };
      const legacyChunkId = `${ctx.runId}:${sequence}:${type}`;
      return legacy.tool_calls.flatMap((toolCall, index) => {
        const record = asRecord(toolCall);
        const requested = withLegacyChunk(
          baseEvent(ctx, 'tool_call_requested', sequence + index * 2, {
            requestKey: asOptionalString(record.requestKey),
            toolCallId: asOptionalString(record.id),
            toolName: asString(record.name),
            arguments: record.arguments,
            round
          }),
          type,
          legacy,
          legacyChunkId
        );
        const validated = withLegacyChunk(
          baseEvent(ctx, 'tool_call_validated', sequence + index * 2 + 1, {
            requestKey: asOptionalString(record.requestKey),
            toolCallId: asOptionalString(record.id),
            toolName: asString(record.name),
            valid: true,
            normalizedArguments: record.arguments,
            round
          }),
          type,
          legacy,
          legacyChunkId
        );
        return [requested, validated];
      });
    }
    case 'tool_start':
      return [
        baseEvent(ctx, 'tool_started', sequence, {
          toolName: asString(payload.tool),
          arguments: payload.args,
          round
        })
      ];
    case 'trace_observation': {
      const observation = asRecord(payload.observation);
      const observationRound = typeof payload.round === 'number' ? payload.round : round;
      const finished = withLegacyChunk(
        baseEvent(ctx, 'tool_finished', sequence, {
          toolCallId: asOptionalString(observation.toolCallId),
          toolName: asString(observation.toolName),
          success: observation.success === true,
          content: asOptionalString(observation.content),
          data: observation.data,
          error: asOptionalString(observation.error),
          durationMs: typeof observation.durationMs === 'number' ? observation.durationMs : undefined,
          artifactId: asOptionalString(observation.artifactId),
          execution: observation.execution,
          round: observationRound
        }),
        type,
        payload,
        `${ctx.runId}:${sequence}:${type}`
      );
      const added = baseEvent(ctx, 'observation_added', sequence + 1, {
        content: asString(observation.content),
        source: 'tool',
        toolCallId: asOptionalString(observation.toolCallId),
        artifactId: asOptionalString(observation.artifactId),
        round: observationRound
      });
      return [finished, added];
    }
    case 'final_trace':
      return [
        baseEvent(ctx, 'custom', sequence, {
          name: 'stream_final_trace',
          data: { stopReason: payload.stopReason }
        })
      ];
    case 'provider_governance_budget': {
      const usage = payload.usage;
      const governance = asRecord(asRecord(usage).governance);
      const budget = asRecord(governance.budget);
      return [
        baseEvent(ctx, 'model_finished', sequence, {
          usage,
          budget: Object.keys(budget).length > 0 ? budget : undefined,
          round,
          stopReason: 'budget_exceeded'
        }),
        baseEvent(ctx, 'budget_updated', sequence + 1, {
          ...budgetTracePayload(budget),
          exceeded: budgetExceededCodes(budget.exceeded)
        })
      ];
    }
    case 'tool_error':
      return [
        baseEvent(ctx, 'tool_call_validated', sequence, {
          toolName: asString(payload.tool),
          valid: false,
          error: asOptionalString(payload.error),
          code: 'tool_error',
          round
        }),
        withLegacyChunk(
          baseEvent(ctx, 'tool_finished', sequence + 1, {
            toolName: asString(payload.tool),
            success: false,
            error: asOptionalString(payload.error),
            round
          }),
          type,
          payload,
          `${ctx.runId}:${sequence}:${type}`
        )
      ];
    default:
      return type
        ? [
            baseEvent(ctx, 'custom', sequence, {
              name: `stream_${type}`,
              data: payload
            })
          ]
        : [];
  }
}

export function mapWorkflowProgressToAgentEvents(
  progress: WorkflowProgressPayload,
  ctx: AgentEventMappingContext
): AgentEvent[] {
  const sequence = ctx.sequenceStart ?? 1;
  const name = `workflow_${progress.type}`;

  if (progress.type === 'step_start') {
    return [
      baseEvent(ctx, 'custom', sequence, {
        name,
        data: progress
      })
    ];
  }

  if (progress.type === 'step_done') {
    return [
      baseEvent(ctx, progress.success === false ? 'custom' : 'custom', sequence, {
        name,
        data: progress
      })
    ];
  }

  return [baseEvent(ctx, 'custom', sequence, { name, data: progress })];
}

export function mapAiBuilderStreamToAgentEvents(
  event: AiBuildStreamEvent,
  ctx: AgentEventMappingContext
): AgentEvent[] {
  const sequence = ctx.sequenceStart ?? 1;

  switch (event.type) {
    case 'delta':
      return [
        baseEvent(ctx, 'model_delta', sequence, { content: event.content }),
        baseEvent(ctx, 'message_delta', sequence + 1, {
          role: 'assistant',
          content: event.content,
          blockKind: 'text'
        })
      ];
    case 'context_summary':
      return [
        withBuilderStreamEvent(
          baseEvent(ctx, 'context_compacted', sequence, {
            strategy: 'builder_summary',
            summary: event.summary
          }),
          event
        )
      ];
    case 'checkpoint':
      return [
        withBuilderStreamEvent(
          baseEvent(ctx, 'checkpoint_saved', sequence, {
            checkpointId: event.checkpoint.id,
            reason: event.checkpoint.summary
          }),
          event
        )
      ];
    case 'state_graph':
    case 'capability_graph':
    case 'plan_contract':
    case 'plan_draft':
    case 'context_memory':
    case 'plan':
    case 'dry_run':
    case 'build_done':
    case 'build_failed':
      return [withBuilderStreamEvent(createBuilderArtifactEvent(ctx, sequence, event), event)];
    case 'error':
      return [
        withBuilderStreamEvent(
          baseEvent(ctx, 'run_failed', sequence, {
            status: 'failed',
            error: event.message
          }),
          event
        )
      ];
    default:
      return [withBuilderStreamEvent(createBuilderCustomEvent(ctx, sequence, event), event)];
  }
}

function createBuilderCustomEvent(
  ctx: AgentEventMappingContext,
  sequence: number,
  event: AiBuildStreamEvent
): AgentEvent {
  return baseEvent(ctx, 'custom', sequence, {
    name: `builder_${event.type}`,
    data: event
  });
}

function createBuilderArtifactEvent(
  ctx: AgentEventMappingContext,
  sequence: number,
  event: AiBuildStreamEvent
): AgentEvent {
  const artifactId = builderArtifactId(event, sequence);
  return baseEvent(ctx, 'artifact_saved', sequence, {
    artifactId,
    kind: `builder_${event.type}`,
    preview: builderEventPreview(event),
    metadata: {
      source: 'builder',
      builderEventType: event.type,
      domainId: builderDomainId(event),
      builderStreamEvent: event
    }
  });
}

function withBuilderStreamEvent(event: AgentEvent, source: AiBuildStreamEvent): AgentEvent {
  return {
    ...event,
    metadata: {
      ...event.metadata,
      builderEventType: source.type,
      builderStreamEvent: source
    }
  };
}

function builderArtifactId(event: AiBuildStreamEvent, sequence: number): string {
  const domainId = builderDomainId(event) || `${event.type}_${sequence}`;
  return `builder_${event.type}_${safeIdPart(domainId)}`;
}

function builderDomainId(event: AiBuildStreamEvent): string | undefined {
  const record = asRecord(event);
  const draft = asRecord(record.draft);
  const plan = asRecord(record.plan);
  const graph = asRecord(record.graph);
  const contract = asRecord(record.contract);
  const result = asRecord(record.result);
  const memory = asRecord(record.memory);
  const checkpoint = asRecord(record.checkpoint);
  return asOptionalString(draft.id)
    || asOptionalString(plan.id)
    || asOptionalString(graph.id)
    || asOptionalString(contract.id)
    || asOptionalString(result.planId)
    || asOptionalString(result.status)
    || asOptionalString(memory.updatedAt)
    || asOptionalString(checkpoint.id);
}

function builderEventPreview(event: AiBuildStreamEvent): string | undefined {
  const record = asRecord(event);
  const draft = asRecord(record.draft);
  const plan = asRecord(record.plan);
  const contract = asRecord(record.contract);
  const result = asRecord(record.result);
  const graph = asRecord(record.graph);
  const memory = asRecord(record.memory);
  const summary =
    asOptionalString(draft.summary)
    || asOptionalString(plan.summary)
    || asOptionalString(contract.goal)
    || asOptionalString(memory.goalSummary)
    || asOptionalString(record.summary)
    || asOptionalString(record.message)
    || asOptionalString(result.status)
    || asOptionalString(graph.current);
  return summary ? truncatePreview(summary) : undefined;
}

function truncatePreview(value: string, limit = 240): string {
  return value.length > limit ? `${value.slice(0, limit)}…` : value;
}

function safeIdPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 96) || 'event';
}

function createModelFinishedEvent(
  ctx: AgentEventMappingContext,
  sequence: number,
  round: AgentRunRound
): AgentEvent {
  return baseEvent(ctx, 'model_finished', sequence, {
    content: round.assistantContent,
    usage: round.usage,
    provider: round.provider,
    budget: round.budget,
    round: round.index
  });
}

function createToolCallRequestedEvent(
  ctx: AgentEventMappingContext,
  sequence: number,
  round: number,
  toolCall: AgentToolCallTrace
): AgentEvent {
  return baseEvent(ctx, 'tool_call_requested', sequence, {
    toolCallId: toolCall.id,
    toolName: toolCall.name,
    arguments: toolCall.arguments,
    exposedName: toolCall.exposedName,
    originalName: toolCall.originalName,
    mcpServerId: toolCall.mcpServerId,
    execution: toolCall.execution,
    round
  });
}

function createToolFinishedEvent(
  ctx: AgentEventMappingContext,
  sequence: number,
  round: number,
  observation: AgentToolObservation
): AgentEvent {
  return baseEvent(ctx, 'tool_finished', sequence, {
    toolCallId: observation.toolCallId,
    toolName: observation.toolName,
    success: observation.success,
    content: observation.content,
    data: observation.data,
    error: observation.error,
    durationMs: observation.durationMs,
    artifactId: observation.artifactId,
    execution: observation.execution,
    round
  });
}

function createObservationAddedEvent(
  ctx: AgentEventMappingContext,
  sequence: number,
  round: number,
  observation: AgentToolObservation
): AgentEvent {
  return baseEvent(ctx, 'observation_added', sequence, {
    content: observation.content,
    source: 'tool',
    toolCallId: observation.toolCallId,
    artifactId: observation.artifactId,
    round
  });
}

function baseEvent(
  ctx: AgentEventMappingContext,
  type: AgentEvent['type'],
  sequence: number,
  payload: AgentEvent['payload']
): AgentEvent {
  return normalizeAgentEvent({
    id: `${ctx.runId}:${type}:${sequence}`,
    type,
    runId: ctx.runId,
    sessionId: ctx.sessionId,
    timestamp: ctx.timestamp || new Date().toISOString(),
    sequence,
    metadata: ctx.metadata,
    payload
  } as AgentEvent);
}

function withLegacyChunk(
  event: AgentEvent,
  legacyChunkType: string,
  legacyChunk: unknown,
  legacyChunkId: string
): AgentEvent {
  return normalizeAgentEvent({
    ...event,
    metadata: {
      ...event.metadata,
      legacyChunkType,
      legacyChunk,
      legacyChunkId
    }
  });
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' ? (value as Record<string, any>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function budgetTracePayload(budget: Record<string, any>): Record<string, unknown> {
  const cumulative = asRecord(budget.cumulative);
  return {
    modelCalls: typeof cumulative.modelCalls === 'number' ? cumulative.modelCalls : undefined,
    inputTokens: typeof cumulative.promptTokens === 'number' ? cumulative.promptTokens : undefined,
    outputTokens:
      typeof cumulative.completionTokens === 'number' ? cumulative.completionTokens : undefined,
    estimatedCostUsd:
      typeof cumulative.estimatedCostUsd === 'number' ? cumulative.estimatedCostUsd : undefined,
    limits: Object.keys(asRecord(budget.limits)).length > 0 ? asRecord(budget.limits) : undefined
  };
}

function budgetExceededCodes(value: unknown): Array<'max_model_calls' | 'max_tool_calls' | 'max_input_tokens' | 'max_output_tokens' | 'max_cost_usd' | 'timeout'> {
  const allowed = new Set([
    'max_model_calls',
    'max_tool_calls',
    'max_input_tokens',
    'max_output_tokens',
    'max_cost_usd',
    'timeout'
  ]);
  return asArray(value).filter((item): item is 'max_model_calls' | 'max_tool_calls' | 'max_input_tokens' | 'max_output_tokens' | 'max_cost_usd' | 'timeout' =>
    typeof item === 'string' && allowed.has(item)
  );
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function asOptionalString(value: unknown): string | undefined {
  return value == null ? undefined : asString(value);
}