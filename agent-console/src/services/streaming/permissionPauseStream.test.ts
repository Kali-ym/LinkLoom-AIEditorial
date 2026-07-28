import { describe, expect, it } from 'vitest';

import { isPermissionPauseStreamEvent } from './permissionPauseStream';
import type { StreamEvent } from './streamEvent';

describe('isPermissionPauseStreamEvent', () => {
  it('matches permission pause stream events', () => {
    const events: StreamEvent[] = [
      { type: 'hitl_context', data: { runId: 'run-1', permissionId: 'perm-1' } },
      { type: 'run_paused', data: { reason: 'permission' } as Record<string, unknown> },
      {
        type: 'tool_calls',
        tools: [{ id: 'call-1', toolCallId: 'call-1', intervention: { status: 'pending' } }],
      },
      { type: 'tool_calls', tools: [{ id: 'call-2', toolCallId: 'call-2', state: 'executing' }] },
      { type: 'content_part', text: 'hello' },
    ];

    expect(isPermissionPauseStreamEvent(events[0]!)).toBe(true);
    expect(isPermissionPauseStreamEvent(events[1]!)).toBe(true);
    expect(isPermissionPauseStreamEvent(events[2]!)).toBe(true);
    expect(isPermissionPauseStreamEvent(events[3]!)).toBe(false);
    expect(isPermissionPauseStreamEvent(events[4]!)).toBe(false);
  });
});
