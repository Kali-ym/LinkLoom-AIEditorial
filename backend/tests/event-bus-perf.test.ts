import { describe, it, expect } from 'vitest';

import { InMemoryAgentEventBus } from '../src/services/agents/engine/EventBus.js';
import type { AgentEvent } from '../src/services/agents/engine/AgentEvent.js';

function makeEvent(runId: string, id: string): AgentEvent {
  return {
    id,
    runId,
    type: 'custom',
    timestamp: Date.now(),
    payload: { name: 'tick', id }
  } as AgentEvent;
}

describe('InMemoryAgentEventBus performance', () => {
  it('publish stays near-linear as the run grows (no O(N^2) nextSequence scan)', async () => {
    const bus = new InMemoryAgentEventBus();
    const runId = 'run_perf';
    const total = 5000;

    const start = Date.now();
    for (let i = 0; i < total; i += 1) {
      await bus.publish(makeEvent(runId, `evt-${i}`));
    }
    const elapsed = Date.now() - start;

    // 5000 publishes. The old implementation scanned the whole event array on
    // every publish (reduce inside nextSequence), costing O(N^2). On a modern
    // machine that regressed to several seconds for a few thousand events.
    // With the cached maxSequence, this should finish well under 1s.
    expect(bus.getEventCount(runId)).toBe(total);
    expect(elapsed).toBeLessThan(1500);
  });

  it('getEventCount is O(1) and matches getEvents().length', async () => {
    const bus = new InMemoryAgentEventBus();
    const runId = 'run_count';
    for (let i = 0; i < 100; i += 1) {
      await bus.publish(makeEvent(runId, `c-${i}`));
    }
    expect(bus.getEventCount(runId)).toBe(100);
    expect(bus.getEventCount(runId)).toBe(bus.getEvents(runId).length);
    expect(bus.getEventCount('nonexistent')).toBe(0);
  });

  it('getEventsAfter returns only events with sequence > afterSeq, in order', async () => {
    const bus = new InMemoryAgentEventBus();
    const runId = 'run_after';
    for (let i = 0; i < 10; i += 1) {
      await bus.publish(makeEvent(runId, `a-${i}`));
    }
    const all = bus.getEvents(runId);
    const midSeq = all[4].sequence as number;
    const after = bus.getEventsAfter(runId, midSeq);
    expect(after.length).toBe(5);
    expect(after[0].id).toBe('a-5');
    expect(after[4].id).toBe('a-9');
    expect(bus.getEventsAfter(runId, 999999)).toEqual([]);
    expect(bus.getEventsAfter('nonexistent', 0)).toEqual([]);
  });

  it('getEventsFromIndex returns the tail slice without copying the whole array', async () => {
    const bus = new InMemoryAgentEventBus();
    const runId = 'run_from';
    for (let i = 0; i < 10; i += 1) {
      await bus.publish(makeEvent(runId, `f-${i}`));
    }
    expect(bus.getEventsFromIndex(runId, 7).map((e) => e.id)).toEqual(['f-7', 'f-8', 'f-9']);
    expect(bus.getEventsFromIndex(runId, 0).length).toBe(10);
    expect(bus.getEventsFromIndex(runId, 100)).toEqual([]);
    expect(bus.getEventsFromIndex('nonexistent', 0)).toEqual([]);
  });

  it('clear drops events, listeners, and cached maxSequence', async () => {
    const bus = new InMemoryAgentEventBus();
    const runId = 'run_clear';
    await bus.publish(makeEvent(runId, 'one'));
    expect(bus.getEventCount(runId)).toBe(1);
    bus.clear(runId);
    expect(bus.getEventCount(runId)).toBe(0);
    expect(bus.getEvents(runId)).toEqual([]);
    // publishing after clear starts sequence fresh
    await bus.publish(makeEvent(runId, 'two'));
    const events = bus.getEvents(runId);
    expect(events.length).toBe(1);
    expect(events[0].sequence).toBe(1);
  });
});
