import type { AgentEvent, AgentEventType } from './AgentEvent.js';
import type { AgentRunStatus } from './AgentRunSpec.js';

export type RunStatusTransitionTrigger = AgentEventType | 'checkpoint_status' | 'manual_status_update';

export interface RunStatusTransitionDecision {
  accepted: boolean;
  from: AgentRunStatus;
  to: AgentRunStatus;
  trigger: RunStatusTransitionTrigger;
  reason?: string;
}

export interface RejectedRunStatusTransitionRecord {
  from: AgentRunStatus;
  to: AgentRunStatus;
  trigger: RunStatusTransitionTrigger;
  reason: string;
  at: string;
}

const ALLOWED_RUN_STATUS_TRANSITIONS: Record<AgentRunStatus, AgentRunStatus[]> = {
  queued: ['queued', 'running', 'cancelling'],
  running: ['running', 'paused', 'cancelling', 'succeeded', 'failed'],
  paused: ['paused', 'running', 'cancelling'],
  cancelling: ['cancelling', 'cancelled'],
  succeeded: ['succeeded', 'archived'],
  failed: ['failed', 'archived'],
  cancelled: ['cancelled', 'archived'],
  archived: ['archived']
};

const MAX_REJECTED_TRANSITION_HISTORY = 10;

export function isTerminalRunStatus(status: AgentRunStatus): boolean {
  return status === 'succeeded' || status === 'failed' || status === 'cancelled';
}

export function isClosedRunStatus(status: AgentRunStatus): boolean {
  return isTerminalRunStatus(status) || status === 'archived';
}

export function isExecutionLifecycleSuppressedStatus(status: AgentRunStatus): boolean {
  return isClosedRunStatus(status) || status === 'cancelling';
}

export function isCancellableRunStatus(
  status: AgentRunStatus
): status is Extract<AgentRunStatus, 'queued' | 'running' | 'paused'> {
  return status === 'queued' || status === 'running' || status === 'paused';
}

export function isCancellationRequestableRunStatus(
  status: AgentRunStatus
): status is Extract<AgentRunStatus, 'queued' | 'running' | 'paused' | 'cancelling'> {
  return isCancellableRunStatus(status) || status === 'cancelling';
}

export function isArchivableRunStatus(status: AgentRunStatus): boolean {
  return isTerminalRunStatus(status);
}

export function evaluateRunStatusTransition(
  from: AgentRunStatus,
  to: AgentRunStatus,
  trigger: RunStatusTransitionTrigger
): RunStatusTransitionDecision {
  const accepted = ALLOWED_RUN_STATUS_TRANSITIONS[from].includes(to);
  return {
    accepted,
    from,
    to,
    trigger,
    reason: accepted ? undefined : `Illegal run status transition: ${from} -> ${to} via ${trigger}`
  };
}

export function evaluateRunEventStatusTransition(
  from: AgentRunStatus,
  event: AgentEvent
): RunStatusTransitionDecision | undefined {
  const to = getRunEventTargetStatus(event);
  return to ? evaluateRunStatusTransition(from, to, event.type) : undefined;
}

export function appendRejectedRunStatusTransitionMetadata(
  metadata: Record<string, unknown> | undefined,
  decision: RunStatusTransitionDecision,
  timestamp: string
): Record<string, unknown> {
  if (decision.accepted || !decision.reason) return metadata ?? {};

  const runControl = asRecord(metadata?.runControl);
  const history = Array.isArray(runControl.rejectedTransitions)
    ? runControl.rejectedTransitions.filter(isRejectedTransitionRecord)
    : [];
  const rejection: RejectedRunStatusTransitionRecord = {
    from: decision.from,
    to: decision.to,
    trigger: decision.trigger,
    reason: decision.reason,
    at: timestamp
  };

  return {
    ...metadata,
    runControl: {
      ...runControl,
      lastRejectedTransition: rejection,
      rejectedTransitions: [...history, rejection].slice(-MAX_REJECTED_TRANSITION_HISTORY)
    }
  };
}

function getRunEventTargetStatus(event: AgentEvent): AgentRunStatus | undefined {
  switch (event.type) {
    case 'run_queued':
      return 'queued';
    case 'run_started':
    case 'run_resumed':
      return 'running';
    case 'run_paused':
      return 'paused';
    case 'run_cancel_requested':
      return event.payload.status ?? 'cancelling';
    case 'run_cancelled':
      return 'cancelled';
    case 'run_finished':
      return event.payload.status === 'cancelled' ? 'cancelled' : 'succeeded';
    case 'run_failed':
      return 'failed';
    case 'run_archived':
      return 'archived';
    default:
      return undefined;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function isRejectedTransitionRecord(value: unknown): value is RejectedRunStatusTransitionRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Partial<RejectedRunStatusTransitionRecord>;
  return (
    typeof record.from === 'string' &&
    typeof record.to === 'string' &&
    typeof record.trigger === 'string' &&
    typeof record.reason === 'string' &&
    typeof record.at === 'string'
  );
}