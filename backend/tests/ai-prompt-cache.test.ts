import { describe, expect, it } from 'vitest';

import {
  applyAnthropicPromptCache,
  extractMessagesApiResult,
  markAnthropicToolsCacheControl,
  parseChatCompletionsStreamPayload,
  parseMessagesStreamPayload,
  parseResponsesStreamPayload,
} from '../src/services/AIProvider.js';

describe('ai prompt cache usage parsing', () => {
  it('parses cached_tokens from Responses API completion events', () => {
    const parsed = parseResponsesStreamPayload({
      type: 'response.completed',
      response: {
        id: 'resp_test',
        usage: {
          input_tokens: 2736,
          output_tokens: 363,
          input_tokens_details: { cached_tokens: 1527 },
        },
      },
    });

    expect(parsed?.usage?.prompt_tokens).toBe(2736);
    expect(parsed?.usage?.cached_tokens).toBe(1527);
    expect(parsed?.response_id).toBe('resp_test');
  });

  it('parses cached_tokens from chat completion stream usage chunks', () => {
    const parsed = parseChatCompletionsStreamPayload({
      choices: [{ delta: {}, finish_reason: 'stop' }],
      usage: {
        prompt_tokens: 1527,
        completion_tokens: 278,
        prompt_tokens_details: { cached_tokens: 1200 },
      },
    });

    expect(parsed?.usage?.prompt_tokens).toBe(1527);
    expect(parsed?.usage?.cached_tokens).toBe(1200);
  });

  it('parses Anthropic cache_read_input_tokens from message_delta stream usage', () => {
    const parsed = parseMessagesStreamPayload({
      type: 'message_delta',
      delta: { stop_reason: 'end_turn' },
      usage: {
        input_tokens: 3542,
        output_tokens: 194,
        cache_read_input_tokens: 17792,
        cache_creation_input_tokens: 0,
      },
    });

    expect(parsed?.usage?.prompt_tokens).toBe(3542);
    expect(parsed?.usage?.completion_tokens).toBe(194);
    expect(parsed?.usage?.cached_tokens).toBe(17792);
    expect(parsed?.usage?.cache_read_input_tokens).toBe(17792);
  });

  it('parses Anthropic cache fields from non-stream Messages API result', () => {
    const result = extractMessagesApiResult({
      id: 'msg_test',
      content: [{ type: 'text', text: 'hello' }],
      usage: {
        input_tokens: 3542,
        output_tokens: 194,
        cache_read_input_tokens: 17792,
        cache_creation_input_tokens: 512,
      },
    });

    expect(result.usage?.prompt_tokens).toBe(3542);
    expect(result.usage?.completion_tokens).toBe(194);
    expect(result.usage?.cached_tokens).toBe(17792);
    expect(result.usage?.cache_read_input_tokens).toBe(17792);
    expect(result.usage?.cache_creation_input_tokens).toBe(512);
  });

  describe('applyAnthropicPromptCache system prompt breakpoint', () => {
    const cacheKey = { enableStore: true, cacheKey: 'session-1:claude:provider' };

    it('marks the system prompt with cache_control on the first turn (single user message)', () => {
      const messages = [{ role: 'user', content: 'hello' }];
      const { system, messages: outMessages } = applyAnthropicPromptCache(
        messages,
        'You are a helpful assistant.',
        cacheKey,
      );

      expect(Array.isArray(system)).toBe(true);
      expect((system as Array<Record<string, unknown>>)[0]?.cache_control).toEqual({
        type: 'ephemeral',
      });
      // First-turn user message is the dynamic latest input — no breakpoint.
      expect((outMessages[0] as Record<string, unknown>).cache_control).toBeUndefined();
    });

    it('marks both system and the last stable message on later turns', () => {
      const messages = [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi' },
        { role: 'user', content: 'what now?' },
      ];
      const { system, messages: outMessages } = applyAnthropicPromptCache(
        messages,
        'You are a helpful assistant.',
        cacheKey,
      );

      expect((system as Array<Record<string, unknown>>)[0]?.cache_control).toEqual({
        type: 'ephemeral',
      });
      // markAnthropicCacheControl puts the breakpoint on the last content block
      // of the last stable message (the assistant turn), not the message top level.
      const stableLast = outMessages[1] as Record<string, unknown>;
      const latest = outMessages[2] as Record<string, unknown>;
      const stableLastContent = stableLast.content as Array<Record<string, unknown>>;
      expect(stableLastContent[stableLastContent.length - 1]?.cache_control).toEqual({
        type: 'ephemeral',
      });
      expect(latest.cache_control).toBeUndefined();
    });

    it('leaves system unmarked when caching is disabled', () => {
      const { system } = applyAnthropicPromptCache(
        [{ role: 'user', content: 'hello' }],
        'You are a helpful assistant.',
        undefined,
      );

      expect(system).toBe('You are a helpful assistant.');
    });
  });

  describe('markAnthropicToolsCacheControl', () => {
    const cacheKey = { enableStore: true, cacheKey: 'session-1:claude:provider' };

    it('marks the last tool with cache_control when caching is enabled', () => {
      const tools = [
        { name: 'search', input_schema: { type: 'object' } },
        { name: 'write', input_schema: { type: 'object' } },
      ];
      const result = markAnthropicToolsCacheControl(tools, cacheKey);

      expect((result![0] as Record<string, unknown>).cache_control).toBeUndefined();
      expect((result![1] as Record<string, unknown>).cache_control).toEqual({
        type: 'ephemeral',
      });
    });

    it('leaves tools unmarked when caching is disabled', () => {
      const tools = [{ name: 'search', input_schema: { type: 'object' } }];
      const result = markAnthropicToolsCacheControl(tools, undefined);

      expect((result![0] as Record<string, unknown>).cache_control).toBeUndefined();
    });

    it('returns undefined for empty or undefined tools', () => {
      expect(markAnthropicToolsCacheControl(undefined, cacheKey)).toBeUndefined();
      expect(markAnthropicToolsCacheControl([], cacheKey)).toBeUndefined();
    });
  });
});
