import { describe, expect, it } from 'vitest';

import {
  isLegacyResultBearingToolCall,
  rehydratePersistedMessages,
} from '../src/services/agents/engine/runtimeHistoryRehydrator.js';

describe('runtime history legacy tool detection', () => {
  it('does not treat request-only tool_calls as legacy', () => {
    expect(
      isLegacyResultBearingToolCall({
        id: 'call_1',
        name: 'platform_invoke',
        arguments: { method: 'GET', path: '/api/agents' },
      }),
    ).toBe(false);

    const rehydrated = rehydratePersistedMessages([
      {
        role: 'assistant',
        content: '',
        metadata: {
          toolCalls: [
            {
              id: 'call_1',
              name: 'platform_invoke',
              arguments: { method: 'GET', path: '/api/agents' },
            },
          ],
        },
      },
      {
        role: 'tool',
        toolCallId: 'call_1',
        name: 'platform_invoke',
        content: '{"ok":true}',
      },
    ]);

    expect(rehydrated.cacheSafe).toBe(true);
    expect(rehydrated.legacyToolMessageCount).toBe(0);
  });

  it('flags result-bearing tool_calls without replayable content as legacy', () => {
    expect(
      isLegacyResultBearingToolCall({
        id: 'call_1',
        name: 'platform_invoke',
        content: '{"ok":true}',
        success: true,
      }),
    ).toBe(false);

    expect(
      isLegacyResultBearingToolCall({
        id: 'call_1',
        name: 'platform_invoke',
        data: { ok: true },
        success: true,
      }),
    ).toBe(true);

    expect(
      isLegacyResultBearingToolCall({
        id: 'call_1',
        name: 'platform_invoke',
        content: '{"ok":true}',
        canonicalMessageContent: '{"ok":true}',
        success: true,
      }),
    ).toBe(false);
  });

  it('stamps canonical version for content-only persisted tool history', () => {
    const rehydrated = rehydratePersistedMessages([
      {
        role: 'assistant',
        content: 'done',
        metadata: {
          toolCalls: [
            {
              id: 'call_1',
              name: 'platform_invoke',
              arguments: { method: 'GET', path: '/api/agents' },
              content: '{"ok":true}',
              success: true,
            },
          ],
        },
      },
    ]);

    expect(rehydrated.cacheSafe).toBe(true);
    expect(rehydrated.messages[0]?.canonical_message_version).toBe('canonical-message-v1');
    expect(rehydrated.messages[1]?.canonical_message_version).toBe('canonical-message-v1');
  });
});
