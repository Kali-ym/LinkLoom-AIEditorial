import { describe, expect, it } from 'vitest';
import type { AgentToolObservation } from '../src/types/agent.js';
import { mapToolObservationToAgentEvents } from '../src/services/agents/engine/AgentEventMapper.js';

describe('tool observation event mapping', () => {
  it('persists canonical model-visible content in tool_finished', () => {
    const observation: AgentToolObservation = {
      toolCallId: 'call-1',
      toolName: 'read_document',
      success: true,
      content: 'preview',
      canonicalMessageContent: 'artifact_artifact-1\npreview',
      durationMs: 12
    };

    const events = mapToolObservationToAgentEvents(observation, 2, {
      runId: 'run-1',
      sessionId: 'session-1',
      sequenceStart: 10
    });

    expect(events.map((event) => event.type)).toEqual(['tool_finished', 'observation_added']);
    expect(events[0]).toMatchObject({
      sequence: 10,
      payload: {
        toolCallId: 'call-1',
        canonicalMessageContent: 'artifact_artifact-1\npreview',
        canonicalMessageVersion: 'canonical-message-v1'
      }
    });
    expect(events[1]).toMatchObject({ sequence: 11 });
  });
});
