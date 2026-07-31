import { describe, expect, it } from 'vitest';
import type { AIMessage } from '../src/types/index.js';
import {
  canonicalMessageHash,
  canonicalizeAIMessage,
  canonicalizeToolDefinitions,
  stableStringify
} from '../src/services/agents/engine/canonicalMessageSerializer.js';

describe('canonical message serializer', () => {
  it('sorts object keys without changing array order', () => {
    const first: AIMessage = {
      role: 'tool',
      tool_call_id: 'call-1',
      content: [
        { type: 'text', text: 'first' },
        { type: 'text', text: 'second' }
      ],
      tool_calls: [
        {
          name: 'search',
          id: 'call-1',
          arguments: { z: 1, a: [{ b: 2, a: 1 }] }
        }
      ]
    };
    const second: AIMessage = {
      role: 'tool',
      tool_call_id: 'call-1',
      content: [
        { text: 'first', type: 'text' },
        { text: 'second', type: 'text' }
      ],
      tool_calls: [
        {
          arguments: { a: [{ a: 1, b: 2 }], z: 1 },
          id: 'call-1',
          name: 'search'
        }
      ]
    };

    expect(JSON.stringify(first)).not.toBe(JSON.stringify(second));
    expect(stableStringify(first)).toBe(stableStringify(second));
    expect(canonicalMessageHash([first])).toBe(canonicalMessageHash([second]));
    expect(
      (canonicalizeAIMessage(first).tool_calls?.[0]?.arguments as { a: unknown[]; z: number }).a
    ).toEqual([{ a: 1, b: 2 }]);
  });

  it('omits reasoning by default and retains it when explicitly requested', () => {
    const message: AIMessage = {
      role: 'assistant',
      content: 'answer',
      reasoning: 'private reasoning',
      raw_parts: [{ type: 'thinking', text: 'private reasoning' }]
    };

    expect(canonicalizeAIMessage(message).reasoning).toBeUndefined();
    expect(
      canonicalizeAIMessage(message, { keepReasoning: true, keepRawParts: true })
    ).toMatchObject({
      reasoning: 'private reasoning',
      raw_parts: [{ text: 'private reasoning', type: 'thinking' }]
    });
  });

  it('orders tool definitions deterministically', () => {
    const first = canonicalizeToolDefinitions([
      { name: 'write', input_schema: { type: 'object' } },
      { name: 'search', input_schema: { type: 'object' } }
    ]);
    const second = canonicalizeToolDefinitions([
      { input_schema: { type: 'object' }, name: 'search' },
      { input_schema: { type: 'object' }, name: 'write' }
    ]);

    expect(stableStringify(first)).toBe(stableStringify(second));
  });
});
