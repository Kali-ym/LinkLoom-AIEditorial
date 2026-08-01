import type { AgentRunOutput, AgentRunSource, AgentRunStatus } from './AgentRunSpec.js';
import type { PermissionDecision, PermissionRequest } from './PermissionPolicy.js';
import type { AgentRunRound, ToolExecutionTrace } from '../../../types/agent.js';
import type { ContextTokenBreakdown, ContextUsageSnapshot } from '../context/ContextTokenTypes.js';

export const AGENT_EVENT_SCHEMA_VERSION = 'agent-event-v1' as const;

export type AgentEventSchemaVersion = typeof AGENT_EVENT_SCHEMA_VERSION;

export type AgentEventActorType = 'user' | 'agent' | 'system' | 'workflow' | 'scheduler' | 'api';

export interface AgentEventActor {
  type: AgentEventActorType;
  id?: string;
  name?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentEventTransportMetadata {
  protocol?: 'rest' | 'sse' | 'websocket' | 'internal';
  route?: string;
  requestId?: string;
  clientId?: string;
  metadata?: Record<string, unknown>;
}

export type AgentHitlKind =
  | 'permission'
  | 'confirmation'
  | 'argument_edit'
  | 'needs_input'
  | 'external_execution';

export type AgentHitlAction =
  | 'allow'
  | 'deny'
  | 'edit_arguments'
  | 'provide_input'
  | 'external_result'
  | 'cancel';

export type AgentHitlStatus = 'pending' | 'resolved';

export interface AgentHitlRequest {
  requestId: string;
  kind: AgentHitlKind;
  status?: Extract<AgentHitlStatus, 'pending'>;
  prompt?: string;
  schema?: unknown;
  proposedArguments?: unknown;
  allowedActions?: AgentHitlAction[];
  permissionId?: string;
  checkpointId?: string;
  createdAt?: string;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentHitlResolution {
  requestId: string;
  kind: AgentHitlKind;
  status?: Extract<AgentHitlStatus, 'resolved'>;
  action: AgentHitlAction;
  editedArguments?: unknown;
  input?: unknown;
  externalResult?: unknown;
  reason?: string;
  resolvedAt?: string;
  resolvedBy?: AgentEventActor;
  metadata?: Record<string, unknown>;
}

export type AgentPauseReason = AgentHitlKind | 'budget' | 'manual' | 'system';

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
  | 'reasoning_snapshot'
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
  | 'context_usage_preview'
  | 'checkpoint_saved'
  | 'artifact_saved'
  | 'budget_updated'
  | 'custom';

export interface AgentEventBase {
  id: string;
  type: AgentEventType;
  runId: string;
  sessionId: string;
  timestamp: string;
  schemaVersion?: AgentEventSchemaVersion;
  sequence?: number;
  parentEventId?: string;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  correlationId?: string;
  actor?: AgentEventActor;
  transportMetadata?: AgentEventTransportMetadata;
  metadata?: Record<string, unknown>;
}

export interface RunQueuedEvent extends AgentEventBase {
  type: 'run_queued';
  payload: {
    source: AgentRunSource;
    status: Extract<AgentRunStatus, 'queued'>;
    agentId?: string;
    workflowId?: string;
    queue?: {
      position?: number;
      concurrencyKey?: string;
    };
  };
}

export interface RunStartedEvent extends AgentEventBase {
  type: 'run_started';
  payload: {
    source: AgentRunSource;
    status: AgentRunStatus;
    agentId?: string;
    workflowId?: string;
  };
}

export interface RunFinishedEvent extends AgentEventBase {
  type: 'run_finished';
  payload: {
    status: Extract<AgentRunStatus, 'succeeded' | 'cancelled'>;
    output?: AgentRunOutput;
    durationMs?: number;
  };
}

export interface RunFailedEvent extends AgentEventBase {
  type: 'run_failed';
  payload: {
    status: 'failed';
    error: string;
    code?: string;
    durationMs?: number;
  };
}

export interface RunPausedEvent extends AgentEventBase {
  type: 'run_paused';
  payload: {
    status: 'paused';
    reason: AgentPauseReason;
    permissionId?: string;
    requestId?: string;
    checkpointId?: string;
  };
}

export interface RunResumedEvent extends AgentEventBase {
  type: 'run_resumed';
  payload: {
    status: 'running';
    checkpointId?: string;
  };
}

export interface RunCancelRequestedEvent extends AgentEventBase {
  type: 'run_cancel_requested';
  payload: {
    status?: Extract<AgentRunStatus, 'cancelling'>;
    previousStatus?: Extract<AgentRunStatus, 'queued' | 'running' | 'paused'>;
    reason: 'manual' | 'client_disconnect' | 'timeout' | 'system';
    requestedBy?: AgentEventActor;
  };
}

export interface RunCancelledEvent extends AgentEventBase {
  type: 'run_cancelled';
  payload: {
    status: Extract<AgentRunStatus, 'cancelled'>;
    reason: 'manual' | 'client_disconnect' | 'timeout' | 'system';
    durationMs?: number;
  };
}

export interface RunArchivedEvent extends AgentEventBase {
  type: 'run_archived';
  payload: {
    status: Extract<AgentRunStatus, 'archived'>;
    previousStatus: AgentRunStatus;
    reason?: string;
    archivedBy?: AgentEventActor;
  };
}

export interface TurnStartedEvent extends AgentEventBase {
  type: 'turn_started';
  payload: {
    turnId?: string;
    round?: number;
  };
}

export interface TurnFinishedEvent extends AgentEventBase {
  type: 'turn_finished';
  payload: {
    turnId?: string;
    round?: number;
    stopReason?: string;
  };
}

export interface MessageStartedEvent extends AgentEventBase {
  type: 'message_started';
  payload: {
    messageId?: string;
    role: 'system' | 'user' | 'assistant' | 'tool' | 'developer';
    round?: number;
  };
}

export interface MessageDeltaEvent extends AgentEventBase {
  type: 'message_delta';
  payload: {
    messageId?: string;
    role?: 'assistant' | 'tool';
    content: string;
    blockId?: string;
    blockKind?: 'text' | 'data' | 'tool_call' | 'tool_result';
    round?: number;
  };
}

export interface MessageFinishedEvent extends AgentEventBase {
  type: 'message_finished';
  payload: {
    messageId?: string;
    role: 'system' | 'user' | 'assistant' | 'tool' | 'developer';
    content?: string;
    round?: number;
  };
}

export interface ReasoningDeltaEvent extends AgentEventBase {
  type: 'reasoning_delta';
  payload: {
    content: string;
    blockId?: string;
    round?: number;
  };
}

/** Durable per-round reasoning for replay. Emitted once before tool_call_requested
 * so collectTurnSegments can rebuild the same order as live SSE without inferring
 * from ephemeral reasoning_delta. */
export interface ReasoningSnapshotEvent extends AgentEventBase {
  type: 'reasoning_snapshot';
  payload: {
    content: string;
    round?: number;
    /** Wall-clock ms spent in this model round's reasoning phase (from model_started). */
    durationMs?: number;
    /** Where the reasoning block belongs in the turn timeline. */
    phase?: 'pre_tool' | 'final';
  };
}

export interface ModelStartedEvent extends AgentEventBase {
  type: 'model_started';
  payload: {
    providerId?: string;
    model?: string;
    round?: number;
  };
}

export interface ModelDeltaEvent extends AgentEventBase {
  type: 'model_delta';
  payload: {
    content: string;
    round?: number;
  };
}

export interface ModelFinishedEvent extends AgentEventBase {
  type: 'model_finished';
  payload: {
    content?: string;
    reasoning?: string;
    /** True when this round's reasoning already arrived live via per-token
     * `reasoning_delta` events. Lets the frontend skip re-emitting a duplicate
     * reasoning_part (which would land after the tool call and scramble block
     * order). False/absent on refresh replay, where ephemeral deltas are gone
     * and the persisted reasoning must reconstruct the block. */
    reasoningStreamed?: boolean;
    usage?: unknown;
    contextBreakdown?: ContextTokenBreakdown;
    provider?: AgentRunRound['provider'];
    budget?: AgentRunRound['budget'];
    round?: number;
    stopReason?: string;
  };
}

export interface ToolCallRequestedEvent extends AgentEventBase {
  type: 'tool_call_requested';
  payload: {
    requestKey?: string;
    toolCallId?: string;
    toolName: string;
    arguments: unknown;
    exposedName?: string;
    originalName?: string;
    mcpServerId?: string;
    execution?: ToolExecutionTrace;
    round?: number;
  };
}

export interface ToolCallValidatedEvent extends AgentEventBase {
  type: 'tool_call_validated';
  payload: {
    requestKey?: string;
    toolCallId?: string;
    toolName: string;
    valid: boolean;
    normalizedArguments?: unknown;
    error?: string;
    code?: string;
    execution?: ToolExecutionTrace;
    round?: number;
  };
}

export interface ToolStartedEvent extends AgentEventBase {
  type: 'tool_started';
  payload: {
    toolCallId?: string;
    toolName: string;
    arguments: unknown;
    execution?: ToolExecutionTrace;
    round?: number;
  };
}

export interface ToolFinishedEvent extends AgentEventBase {
  type: 'tool_finished';
  payload: {
    toolCallId?: string;
    toolName: string;
    success: boolean;
    content?: string;
    canonicalMessageContent?: string;
    canonicalMessageVersion?: string;
    data?: unknown;
    error?: string;
    durationMs?: number;
    artifactId?: string;
    execution?: ToolExecutionTrace;
    round?: number;
  };
}

export interface PermissionRequiredEvent extends AgentEventBase {
  type: 'permission_required';
  payload: PermissionRequest;
}

export interface PermissionResolvedEvent extends AgentEventBase {
  type: 'permission_resolved';
  payload: PermissionDecision;
}

export interface HitlRequiredEvent extends AgentEventBase {
  type: 'hitl_required';
  payload: AgentHitlRequest;
}

export interface HitlResolvedEvent extends AgentEventBase {
  type: 'hitl_resolved';
  payload: AgentHitlResolution;
}

export interface ObservationAddedEvent extends AgentEventBase {
  type: 'observation_added';
  payload: {
    content: string;
    source?: 'tool' | 'model' | 'system' | 'human';
    toolCallId?: string;
    artifactId?: string;
    round?: number;
  };
}

export interface ContextCompactedEvent extends AgentEventBase {
  type: 'context_compacted';
  payload: {
    strategy: string;
    beforeMessages?: number;
    afterMessages?: number;
    summary?: string;
    artifactIds?: string[];
    beforeTokens?: number;
    afterTokens?: number;
    fingerprint?: string;
    builderVersion?: string;
    summarySource?: 'heuristic' | 'llm';
    summarizedMessages?: number;
    retainedMessages?: number;
  };
}

export interface ContextUsagePreviewEvent extends AgentEventBase {
  type: 'context_usage_preview';
  payload: {
    snapshot: ContextUsageSnapshot;
    round: number;
  };
}

export interface CheckpointSavedEvent extends AgentEventBase {
  type: 'checkpoint_saved';
  payload: {
    checkpointId: string;
    reason?: string;
    permissionId?: string;
    requestId?: string;
  };
}

export interface ArtifactSavedEvent extends AgentEventBase {
  type: 'artifact_saved';
  payload: {
    artifactId: string;
    kind: string;
    uri?: string;
    preview?: string;
    sizeBytes?: number;
    metadata?: Record<string, unknown>;
  };
}

export interface BudgetUpdatedEvent extends AgentEventBase {
  type: 'budget_updated';
  payload: {
    modelCalls?: number;
    toolCalls?: number;
    inputTokens?: number;
    outputTokens?: number;
    estimatedCostUsd?: number;
    elapsedMs?: number;
    limits?: Record<string, unknown>;
    exceeded?: Array<
      | 'max_model_calls'
      | 'max_tool_calls'
      | 'max_input_tokens'
      | 'max_output_tokens'
      | 'max_cost_usd'
      | 'timeout'
    >;
  };
}

export interface CustomAgentEvent extends AgentEventBase {
  type: 'custom';
  payload: {
    name: string;
    data?: unknown;
  };
}

export type AgentEvent =
  | RunQueuedEvent
  | RunStartedEvent
  | RunFinishedEvent
  | RunFailedEvent
  | RunPausedEvent
  | RunResumedEvent
  | RunCancelRequestedEvent
  | RunCancelledEvent
  | RunArchivedEvent
  | TurnStartedEvent
  | TurnFinishedEvent
  | MessageStartedEvent
  | MessageDeltaEvent
  | MessageFinishedEvent
  | ReasoningDeltaEvent
  | ReasoningSnapshotEvent
  | ModelStartedEvent
  | ModelDeltaEvent
  | ModelFinishedEvent
  | ToolCallRequestedEvent
  | ToolCallValidatedEvent
  | ToolStartedEvent
  | ToolFinishedEvent
  | PermissionRequiredEvent
  | PermissionResolvedEvent
  | HitlRequiredEvent
  | HitlResolvedEvent
  | ObservationAddedEvent
  | ContextCompactedEvent
  | ContextUsagePreviewEvent
  | CheckpointSavedEvent
  | ArtifactSavedEvent
  | BudgetUpdatedEvent
  | CustomAgentEvent;

export type AgentEventListener = (event: AgentEvent) => void | Promise<void>;

export interface AgentEventNormalizationOptions {
  sequence?: number;
}

export function normalizeAgentEvent(
  event: AgentEvent,
  options: AgentEventNormalizationOptions = {}
): AgentEvent {
  const metadata = event.metadata ?? {};
  return {
    ...event,
    schemaVersion: event.schemaVersion ?? AGENT_EVENT_SCHEMA_VERSION,
    sequence: event.sequence ?? options.sequence,
    traceId: event.traceId ?? asString(metadata.traceId) ?? event.runId,
    spanId: event.spanId ?? event.id,
    correlationId: event.correlationId ?? asString(metadata.correlationId) ?? event.runId,
    metadata
  };
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}
