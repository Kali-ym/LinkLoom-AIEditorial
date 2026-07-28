import { describe, expect, it } from 'vitest';
import {
  compareAgentEventTimelines,
  mergeAgentEvents,
  normalizeAgentEventItem,
  parseSseFrameObjects,
  parseSseFrames,
  projectAgentRunEvents,
  projectAgentTimeline,
  summarizeAgentEvent,
  type AgentEventItem
} from './agentEvents';

function event(overrides: Partial<AgentEventItem> & Pick<AgentEventItem, 'id' | 'type'>): AgentEventItem {
  return {
    runId: 'run-1',
    sessionId: 'session-1',
    timestamp: '2026-01-01T00:00:00.000Z',
    payload: {},
    ...overrides
  };
}

describe('agentEvents SDK', () => {
  it('parses SSE frames with event metadata, multiple data lines, done marker and rest', () => {
    const input = [
      'id: 1',
      'event: agent-event',
      'retry: 1000',
      'data: {"a":',
      'data: 1}',
      '',
      'data: {"b":2}',
      '',
      'data: [DONE]',
      '',
      'data: {"partial"'
    ].join('\n');

    const parsed = parseSseFrameObjects(input, (payload) => JSON.parse(payload) as Record<string, number>);

    expect(parsed.done).toBe(true);
    expect(parsed.rest).toBe('data: {"partial"');
    expect(parsed.events).toEqual([
      { id: '1', event: 'agent-event', retry: 1000, data: { a: 1 } },
      { data: { b: 2 } }
    ]);
  });

  it('keeps legacy SSE parser output as payload-only events', () => {
    const parsed = parseSseFrames('event: x\ndata: {"type":"content"}\n\n', (payload) => JSON.parse(payload));

    expect(parsed).toEqual({
      done: false,
      rest: '',
      events: [{ type: 'content' }]
    });
  });

  it('normalizes unknown payloads and schema version without dropping unknown event types', () => {
    const normalized = normalizeAgentEventItem({
      id: 'custom-1',
      type: 'future_event',
      timestamp: '2026-01-01T00:00:01.000Z',
      payload: 'bad-payload' as unknown as Record<string, unknown>
    });

    expect(normalized).toMatchObject({
      id: 'custom-1',
      type: 'future_event',
      schemaVersion: 'agent-event-v1',
      payload: {}
    });
  });

  it('merges duplicate events and orders by sequence, timestamp and id fallback', () => {
    const merged = mergeAgentEvents(
      [
        event({ id: 'b', type: 'run_started', timestamp: '2026-01-01T00:00:02.000Z' }),
        event({ id: 'a', type: 'run_queued', sequence: 2 })
      ],
      [
        event({ id: 'a', type: 'run_started', sequence: 1, payload: { status: 'running' } }),
        event({ id: 'c', type: 'run_finished', timestamp: '2026-01-01T00:00:01.000Z' })
      ]
    );

    expect(merged.map((item) => item.id)).toEqual(['a', 'c', 'b']);
    expect(merged[0]).toMatchObject({ type: 'run_started', payload: { status: 'running' } });
  });

  it('projects timeline and run summary for model, tool, permission, budget and artifact events', () => {
    const events = [
      event({ id: 'run', type: 'run_started', sequence: 1, payload: { status: 'running' } }),
      event({ id: 'model-start', type: 'model_started', sequence: 2, payload: { providerId: 'openai', model: 'gpt-x' } }),
      event({ id: 'message', type: 'message_delta', sequence: 3, payload: { content: 'hello ' } }),
      event({ id: 'model', type: 'model_delta', sequence: 4, payload: { content: 'world' } }),
      event({ id: 'reason', type: 'reasoning_delta', sequence: 5, payload: { content: 'thinking' } }),
      event({ id: 'tool', type: 'tool_finished', sequence: 6, payload: { toolCallId: 'call-1', toolName: 'search', success: false, error: 'denied' } }),
      event({ id: 'permission', type: 'permission_required', sequence: 7, payload: { permissionId: 'perm-1', subject: { toolName: 'search' } } }),
      event({ id: 'budget', type: 'budget_updated', sequence: 8, payload: { modelCalls: 1, toolCalls: 2, estimatedCostUsd: 0.123456 } }),
      event({ id: 'artifact', type: 'artifact_saved', sequence: 9, payload: { kind: 'text', artifactId: 'artifact-1' } })
    ];

    const timeline = projectAgentTimeline(events);
    const projection = projectAgentRunEvents(events);

    expect(timeline.map((item) => item.summary)).toContain('openai · gpt-x');
    expect(timeline.map((item) => item.summary)).toContain('search · denied');
    expect(timeline.map((item) => item.summary)).toContain('model 1 · tool 2 · $0.1235');
    expect(summarizeAgentEvent(events[6])).toBe('search');
    expect(projection.messageText).toBe('hello world');
    expect(projection.reasoningText).toBe('thinking');
    expect(projection.toolCalls).toEqual([
      { id: 'call-1', toolName: 'search', arguments: undefined, status: 'finished', success: false }
    ]);
    expect(projection.budgetSnapshots).toHaveLength(1);
    expect(projection.artifacts).toHaveLength(1);
  });

  it('compares event timelines by projected type and summary', () => {
    const rows = compareAgentEventTimelines(
      [
        event({ id: 'o1', type: 'run_started', sequence: 1, payload: { status: 'running' } }),
        event({ id: 'o2', type: 'tool_finished', sequence: 2, payload: { toolName: 'search', success: true } })
      ],
      [
        event({ id: 'r1', type: 'run_started', sequence: 1, payload: { status: 'running' } }),
        event({ id: 'r2', type: 'tool_finished', sequence: 2, payload: { toolName: 'search', success: false, error: 'denied' } })
      ]
    );

    expect(rows.map((row) => row.differs)).toEqual([false, true]);
  });
});