import { EventEmitter } from 'events';
import { describe, expect, it, vi } from 'vitest';
import { InMemoryAgentRunEventChannel, PgAgentRunEventChannel } from '../src/services/agents/engine/AgentRunEventChannel.js';
import { AgentRunService } from '../src/services/api/AgentRunService.js';
import { writeSseEvent } from '../src/api/http.js';
import type { AgentEvent } from '../src/services/agents/engine/AgentEvent.js';

function makeEvent(runId: string, seq: number, type: AgentEvent['type']): AgentEvent {
  return {
    id: `${runId}-evt-${seq}`,
    type,
    runId,
    sessionId: `session_${runId}`,
    timestamp: new Date(2026, 5, 10, 0, 0, seq).toISOString(),
    sequence: seq,
    payload: {}
  } as AgentEvent;
}

/**
 * A minimal two-instance simulation: instance A produces events into a shared store and
 * fires channel signals; instance B subscribes only to the channel (no in-process bus
 * delivery) and must reconstruct the stream by pulling agent_events incrementally.
 */
class SharedEventStore {
  events = new Map<string, AgentEvent[]>();
  readonly channel = new InMemoryAgentRunEventChannel();

  async produce(event: AgentEvent): Promise<void> {
    const list = this.events.get(event.runId) ?? [];
    list.push(event);
    this.events.set(event.runId, list);
    await this.channel.signal(event.runId, event.sequence as number);
  }

  eventsAfter(runId: string, afterSeq: number): AgentEvent[] {
    return [...(this.events.get(runId) ?? [])]
      .filter((event) => (event.sequence as number) > afterSeq)
      .sort((a, b) => (a.sequence as number) - (b.sequence as number));
  }
}

/**
 * Build an AgentRunService whose agentService delegates reads to the shared store and
 * whose local in-process bus is empty (simulating a foreign instance). Only the
 * cross-process channel drives delivery.
 */
function createForeignInstanceService(shared: SharedEventStore, runId: string) {
  const agentService = {
    getRunEvents: async (id: string) => (id === runId ? shared.eventsAfter(runId, 0) : []),
    getRunSession: async (id: string) => (id === runId ? { runId: id, status: 'running' } : null),
    getRunEventsAfter: async (id: string, afterSeq: number) => shared.eventsAfter(id, afterSeq),
    subscribeRunEvents: () => () => undefined, // foreign instance: no local bus delivery
    subscribeRunEventSignals: (handler: (sig: { runId: string; seq: number; instanceId: string }) => void) =>
      shared.channel.onSignal(handler)
  };
  const service = new AgentRunService({} as any, { agentService } as any);
  return service;
}

async function collect(iterable: AsyncIterable<AgentEvent>, controller: AbortController, max: number): Promise<AgentEvent[]> {
  const out: AgentEvent[] = [];
  for await (const event of iterable) {
    out.push(event);
    if (out.length >= max) {
      controller.abort('test_done');
      break;
    }
  }
  return out;
}

describe('cross-process SSE fan-out', () => {
  it('delivers events to a foreign instance via NOTIFY-driven incremental pulls', async () => {
    const shared = new SharedEventStore();
    const runId = 'run_xproc';

    // Seed an initial backlog before the subscriber connects.
    await shared.produce(makeEvent(runId, 1, 'run_started'));
    await shared.produce(makeEvent(runId, 2, 'model_finished'));

    const service = createForeignInstanceService(shared, runId);
    const controller = new AbortController();
    const stream = service.streamRunEvents(runId, { signal: controller.signal });

    const collected = collect(stream, controller, 4);

    // Produce more events after the subscriber is live; channel signals must wake it.
    await new Promise((resolve) => setTimeout(resolve, 5));
    await shared.produce(makeEvent(runId, 3, 'model_finished'));
    await shared.produce(makeEvent(runId, 4, 'run_finished'));

    const events = await collected;
    expect(events.map((event) => event.sequence)).toEqual([1, 2, 3, 4]);
  });

  it('resumes from last-seq without redelivering the seen prefix', async () => {
    const shared = new SharedEventStore();
    const runId = 'run_resume';
    for (let seq = 1; seq <= 5; seq++) {
      await shared.produce(makeEvent(runId, seq, seq === 5 ? 'run_finished' : 'model_finished'));
    }

    const service = createForeignInstanceService(shared, runId);
    const controller = new AbortController();
    // Reconnect claiming we already saw through seq 3.
    const stream = service.streamRunEvents(runId, { signal: controller.signal, lastSeq: 3 });

    const events: AgentEvent[] = [];
    for await (const event of stream) {
      events.push(event);
    }
    expect(events.map((event) => event.sequence)).toEqual([4, 5]);
  });

  it('does not duplicate events across local + channel delivery', async () => {
    const shared = new SharedEventStore();
    const runId = 'run_dedupe';
    await shared.produce(makeEvent(runId, 1, 'run_started'));

    // This instance receives BOTH a local bus delivery and a channel signal for the same
    // event — the stream must emit it exactly once.
    const localListeners = new Set<(event: AgentEvent) => void>();
    const agentService = {
      getRunEvents: async () => shared.eventsAfter(runId, 0),
      getRunSession: async () => ({ runId, status: 'running' }),
      getRunEventsAfter: async (id: string, afterSeq: number) => shared.eventsAfter(id, afterSeq),
      subscribeRunEvents: (_id: string, listener: (event: AgentEvent) => void) => {
        localListeners.add(listener);
        return () => localListeners.delete(listener);
      },
      subscribeRunEventSignals: (handler: (sig: { runId: string; seq: number; instanceId: string }) => void) =>
        shared.channel.onSignal(handler)
    };
    const service = new AgentRunService({} as any, { agentService } as any);
    const controller = new AbortController();
    const stream = service.streamRunEvents(runId, { signal: controller.signal });
    const collected = collect(stream, controller, 2);

    await new Promise((resolve) => setTimeout(resolve, 5));
    const evt2 = makeEvent(runId, 2, 'run_finished');
    shared.events.get(runId)!.push(evt2);
    // Fire both paths for seq 2.
    for (const listener of localListeners) listener(evt2);
    await shared.channel.signal(runId, 2);

    const events = await collected;
    const seqs = events.map((event) => event.sequence);
    expect(seqs).toEqual([1, 2]);
    expect(new Set(seqs).size).toBe(seqs.length); // no duplicates
  });

  it('pulls once after subscription setup to cover events created during backlog replay', async () => {
    const shared = new SharedEventStore();
    const runId = 'run_backlog_race';
    await shared.produce(makeEvent(runId, 1, 'run_started'));
    let insertedDuringBacklog = false;

    const agentService = {
      getRunEvents: async () => {
        const backlog = shared.eventsAfter(runId, 0);
        if (!insertedDuringBacklog) {
          insertedDuringBacklog = true;
          shared.events.get(runId)!.push(makeEvent(runId, 2, 'run_finished'));
        }
        return backlog;
      },
      getRunSession: async () => ({ runId, status: 'running' }),
      getRunEventsAfter: async (id: string, afterSeq: number) => shared.eventsAfter(id, afterSeq),
      subscribeRunEvents: () => () => undefined,
      subscribeRunEventSignals: (handler: (sig: { runId: string; seq: number; instanceId: string }) => void) =>
        shared.channel.onSignal(handler)
    };
    const service = new AgentRunService({} as any, { agentService } as any);
    const controller = new AbortController();

    const events = await collect(service.streamRunEvents(runId, { signal: controller.signal }), controller, 2);

    expect(events.map((event) => event.sequence)).toEqual([1, 2]);
  });

  it('writes the event sequence as the standard SSE id when provided', () => {
    let output = '';
    const reply = {
      raw: {
        writable: true,
        write: (chunk: string) => {
          output += chunk;
        }
      }
    };

    writeSseEvent(reply as any, makeEvent('run_sse_id', 7, 'model_finished'), { id: 7 });

    expect(output.startsWith('id: 7\ndata: ')).toBe(true);
    expect(output).toContain('"sequence":7');
    expect(output.endsWith('\n\n')).toBe(true);
  });

  it('polls persisted events when no NOTIFY signal is delivered', async () => {
    vi.useFakeTimers();
    try {
      const shared = new SharedEventStore();
      const runId = 'run_poll_fallback';
      await shared.produce(makeEvent(runId, 1, 'run_started'));

      const agentService = {
        getRunEvents: async () => shared.eventsAfter(runId, 0),
        getRunSession: async () => ({ runId, status: 'running' }),
        getRunEventsAfter: async (id: string, afterSeq: number) => shared.eventsAfter(id, afterSeq),
        subscribeRunEvents: () => () => undefined,
        subscribeRunEventSignals: () => () => undefined
      };
      const service = new AgentRunService({} as any, { agentService } as any);
      const controller = new AbortController();
      const collected = collect(service.streamRunEvents(runId, { signal: controller.signal }), controller, 2);

      await Promise.resolve();
      await Promise.resolve();
      shared.events.get(runId)!.push(makeEvent(runId, 2, 'run_finished'));
      await vi.advanceTimersByTimeAsync(2_000);

      const events = await collected;
      expect(events.map((event) => event.sequence)).toEqual([1, 2]);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('PgAgentRunEventChannel', () => {
  it('reconnects the LISTEN client after connection errors', async () => {
    vi.useFakeTimers();
    class FakeListenClient extends EventEmitter {
      query = vi.fn().mockResolvedValue(undefined);
      release = vi.fn();
    }

    const first = new FakeListenClient();
    const second = new FakeListenClient();
    const conn = {
      pool: {
        connect: vi.fn()
          .mockResolvedValueOnce(first)
          .mockResolvedValueOnce(second)
      },
      run: vi.fn()
    };
    const channel = new PgAgentRunEventChannel(conn as any);

    try {
      await channel.start();
      expect(conn.pool.connect).toHaveBeenCalledTimes(1);
      expect(first.query).toHaveBeenCalledWith('LISTEN agent_run_events');

      first.emit('error', new Error('connection lost'));
      expect(first.release).toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(500);
      expect(conn.pool.connect).toHaveBeenCalledTimes(2);
      expect(second.query).toHaveBeenCalledWith('LISTEN agent_run_events');
    } finally {
      await channel.close();
      vi.useRealTimers();
    }
  });
});
