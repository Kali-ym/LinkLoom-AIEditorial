import { normalizeAgentEvent, type AgentEvent, type AgentEventListener } from './AgentEvent.js';

export interface AgentEventBus {
  publish(event: AgentEvent): Promise<void>;
  subscribe(runId: string, listener: AgentEventListener): () => void;
  getEvents(runId: string): AgentEvent[];
  /** Number of events stored for `runId` without materializing the whole array. */
  getEventCount(runId: string): number;
  /** Events whose sequence is strictly greater than `afterSeq`, in order. */
  getEventsAfter(runId: string, afterSeq: number): AgentEvent[];
  /** Events from `startIndex` onward (inclusive). Returns only the needed slice. */
  getEventsFromIndex(runId: string, startIndex: number): AgentEvent[];
  clear(runId: string): void;
}

export class InMemoryAgentEventBus implements AgentEventBus {
  private readonly eventsByRunId = new Map<string, AgentEvent[]>();
  private readonly listenersByRunId = new Map<string, Set<AgentEventListener>>();
  /**
   * Cached max sequence per run so `publish` does not have to scan the whole event
   * array on every emit. Without this, streaming a run with N events cost O(N²)
   * just to assign sequence numbers — each delta re-scanned every prior event —
   * which showed up as "every token gets slower the longer the run goes".
   */
  private readonly maxSequenceByRunId = new Map<string, number>();
  /**
   * Monotonic per-run publish counter, stamped onto `metadata._busOrder`. This is
   * the real arrival order (independent of `sequence`, which can be negative for
   * ephemeral deltas). SSE backlog replay sorts by `_busOrder` so token deltas,
   * tool_call_requested, and model_finished land in the order they actually
   * happened — not in seq-number order (which would put all ephemeral deltas
   * after every persisted event and scramble the UI).
   */
  private readonly orderCounterByRunId = new Map<string, number>();

  async publish(event: AgentEvent): Promise<void> {
    const events = this.eventsByRunId.get(event.runId) ?? [];
    const priorMax = this.maxSequenceByRunId.get(event.runId) ?? 0;
    const order = (this.orderCounterByRunId.get(event.runId) ?? 0) + 1;
    this.orderCounterByRunId.set(event.runId, order);
    const normalizedEvent = normalizeAgentEvent(event, {
      sequence: event.sequence ?? priorMax + 1
    });
    const stampedEvent = {
      ...normalizedEvent,
      metadata: { ...(normalizedEvent.metadata ?? {}), _busOrder: order }
    };
    events.push(stampedEvent);
    this.eventsByRunId.set(normalizedEvent.runId, events);
    const seq = typeof normalizedEvent.sequence === 'number' ? normalizedEvent.sequence : priorMax + 1;
    if (seq > priorMax) this.maxSequenceByRunId.set(normalizedEvent.runId, seq);

    const listeners = this.listenersByRunId.get(normalizedEvent.runId);
    if (!listeners?.size) {
      return;
    }

    await Promise.all([...listeners].map((listener) => Promise.resolve(listener(stampedEvent))));
  }

  subscribe(runId: string, listener: AgentEventListener): () => void {
    const listeners = this.listenersByRunId.get(runId) ?? new Set<AgentEventListener>();
    listeners.add(listener);
    this.listenersByRunId.set(runId, listeners);

    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.listenersByRunId.delete(runId);
      }
    };
  }

  getEvents(runId: string): AgentEvent[] {
    return [...(this.eventsByRunId.get(runId) ?? [])];
  }

  getEventCount(runId: string): number {
    return this.eventsByRunId.get(runId)?.length ?? 0;
  }

  getEventsAfter(runId: string, afterSeq: number): AgentEvent[] {
    const events = this.eventsByRunId.get(runId);
    if (!events || events.length === 0) return [];
    // Events are appended in publish order and sequence is monotonically increasing,
    // so we can binary-search by sequence instead of filtering the whole array.
    let lo = 0;
    let hi = events.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      const seq = typeof events[mid].sequence === 'number' ? (events[mid].sequence as number) : mid;
      if (seq <= afterSeq) lo = mid + 1;
      else hi = mid;
    }
    return events.slice(lo);
  }

  /** Events from `startIndex` onward (inclusive). Returns only the needed slice. */
  getEventsFromIndex(runId: string, startIndex: number): AgentEvent[] {
    const events = this.eventsByRunId.get(runId);
    if (!events || events.length === 0) return [];
    if (startIndex <= 0) return [...events];
    if (startIndex >= events.length) return [];
    return events.slice(startIndex);
  }

  clear(runId: string): void {
    this.eventsByRunId.delete(runId);
    this.listenersByRunId.delete(runId);
    this.maxSequenceByRunId.delete(runId);
    this.orderCounterByRunId.delete(runId);
  }
}

/** Sort key for SSE backlog merge: real publish order first, seq as tiebreaker. */
export function busOrderOf(event: AgentEvent): number {
  const order = (event.metadata as { _busOrder?: unknown } | undefined)?._busOrder;
  return typeof order === 'number' && Number.isFinite(order) ? order : Number.POSITIVE_INFINITY;
}










