import { describe, expect, it } from 'vitest';
import type { AgentSession } from '../src/services/agents/engine/AgentSession.js';
import {
  blocksNewConversationRun,
  hasDanglingToolCallsInSession,
  isReusableConversationRun,
} from '../src/services/agents/conversationRunGuards.js';

function session(overrides: Partial<AgentSession>): AgentSession {
  return {
    runId: 'run-1',
    sessionId: 'session-1',
    threadId: 'thread-1',
    status: 'succeeded',
    source: 'api',
    createdAt: '2026-06-24T08:00:00.000Z',
    updatedAt: '2026-06-24T08:00:10.000Z',
    messages: [],
    events: [],
    ...overrides,
  };
}

describe('conversationRunGuards', () => {
  it('does not reuse cancelled runs with partial tool execution', () => {
    const cancelled = session({
      status: 'cancelled',
      events: [
        {
          id: 'e1',
          runId: 'run-1',
          sessionId: 'session-1',
          type: 'tool_call_requested',
          sequence: 1,
          timestamp: '2026-06-24T08:00:01.000Z',
          payload: { toolCallId: 'call-1', toolName: 'execute_command', round: 1 },
        },
        {
          id: 'e2',
          runId: 'run-1',
          sessionId: 'session-1',
          type: 'model_finished',
          sequence: 2,
          timestamp: '2026-06-24T08:00:02.000Z',
          payload: { content: '' },
        },
      ],
    });

    expect(isReusableConversationRun(cancelled)).toBe(false);
    expect(hasDanglingToolCallsInSession(cancelled)).toBe(true);
  });

  it('reuses succeeded runs only when every tool call finished', () => {
    const succeeded = session({
      status: 'succeeded',
      output: { content: 'done' },
      events: [
        {
          id: 'e1',
          runId: 'run-1',
          sessionId: 'session-1',
          type: 'tool_call_requested',
          sequence: 1,
          timestamp: '2026-06-24T08:00:01.000Z',
          payload: { toolCallId: 'call-1', toolName: 'execute_command', round: 1 },
        },
        {
          id: 'e2',
          runId: 'run-1',
          sessionId: 'session-1',
          type: 'tool_finished',
          sequence: 2,
          timestamp: '2026-06-24T08:00:02.000Z',
          payload: { toolCallId: 'call-1', toolName: 'execute_command', success: true, round: 1 },
        },
        {
          id: 'e3',
          runId: 'run-1',
          sessionId: 'session-1',
          type: 'message_finished',
          sequence: 3,
          timestamp: '2026-06-24T08:00:03.000Z',
          payload: { role: 'assistant', content: 'done' },
        },
      ],
    });

    expect(isReusableConversationRun(succeeded)).toBe(true);
  });

  it('blocks new turns while a run is still cancelling', () => {
    expect(blocksNewConversationRun(session({ status: 'cancelling' }))).toBe(true);
    expect(blocksNewConversationRun(session({ status: 'cancelled' }))).toBe(false);
  });

  it('does not block new turns for paused runs without pending approval', () => {
    expect(blocksNewConversationRun(session({ status: 'paused' }))).toBe(false);
  });

  it('does not block when pending approval tool already finished', () => {
    const paused = session({
      status: 'paused',
      pendingPermission: {
        permissionId: 'perm-1',
        runId: 'run-1',
        sessionId: 'session-1',
        subject: { toolName: 'writeFile' },
        arguments: {},
        requestedAt: '2026-06-24T08:00:00.000Z',
        metadata: { toolCallId: 'call-1' },
      },
      events: [
        {
          id: 'e1',
          runId: 'run-1',
          sessionId: 'session-1',
          type: 'tool_finished',
          sequence: 1,
          timestamp: '2026-06-24T08:00:02.000Z',
          payload: { toolCallId: 'call-1', toolName: 'writeFile', success: false, error: 'denied' },
        },
      ],
    });
    expect(blocksNewConversationRun(paused)).toBe(false);
  });
});
