import { describe, expect, it, vi, beforeEach } from 'vitest';

import {
  OpenAIProvider,
  applyAnthropicPromptCache,
  attachPromptCacheUsage,
  buildChatCompletionsBody,
  buildMessagesApiBody,
  buildResponsesApiBody,
  clearGatewayFieldSupportMemory,
  extractMessagesApiResult,
  markAnthropicToolsCacheControl,
  parseChatCompletionsStreamPayload,
  parseMessagesStreamPayload,
  parseResponsesStreamPayload,
  resolvePromptCacheContext
} from '../src/services/AIProvider.js';

describe('ai prompt cache usage parsing', () => {
  beforeEach(() => {
    clearGatewayFieldSupportMemory();
  });
  it('parses cached_tokens from Responses API completion events', () => {
    const parsed = parseResponsesStreamPayload({
      type: 'response.completed',
      response: {
        id: 'resp_test',
        usage: {
          input_tokens: 2736,
          output_tokens: 363,
          input_tokens_details: { cached_tokens: 1527 }
        }
      }
    });

    expect(parsed?.usage?.prompt_tokens).toBe(2736);
    expect(parsed?.usage?.cached_tokens).toBe(1527);
    expect(parsed?.response_id).toBe('resp_test');
  });

  it('retains complete Responses output items for history replay', () => {
    const output = [
      { type: 'reasoning', id: 'rs_1', summary: [{ type: 'summary_text', text: 'plan' }] },
      { type: 'function_call', call_id: 'call_1', name: 'query', arguments: '{}' }
    ];
    const parsed = parseResponsesStreamPayload({
      type: 'response.completed',
      response: {
        id: 'resp_test',
        output,
        usage: { input_tokens: 10, output_tokens: 1 }
      }
    });

    expect(parsed?.raw_parts).toEqual(output);
  });

  it('parses cached_tokens from chat completion stream usage chunks', () => {
    const parsed = parseChatCompletionsStreamPayload({
      choices: [{ delta: {}, finish_reason: 'stop' }],
      usage: {
        prompt_tokens: 1527,
        completion_tokens: 278,
        prompt_tokens_details: { cached_tokens: 1200 }
      }
    });

    expect(parsed?.usage?.prompt_tokens).toBe(1527);
    expect(parsed?.usage?.cached_tokens).toBe(1200);
  });

  it('preserves cache_write_tokens reported inside OpenAI usage details', () => {
    const parsed = parseChatCompletionsStreamPayload({
      choices: [{ delta: {}, finish_reason: 'stop' }],
      usage: {
        prompt_tokens: 2048,
        completion_tokens: 12,
        prompt_tokens_details: { cache_write_tokens: 2048 }
      }
    });

    expect(parsed?.usage?.cache_write_tokens).toBe(2048);
    expect(parsed?.usage?.prompt_tokens_details).toEqual({
      cache_write_tokens: 2048
    });

    const response = attachPromptCacheUsage(
      { content: 'ok', usage: parsed?.usage },
      {
        enableStore: true,
        cacheKey: 'session-cache-key',
        cacheEligibility: true,
        endpoint: 'chat_completions'
      }
    );
    expect(response.usage?.prompt_cache).toMatchObject({
      cacheStatus: 'write',
      cacheWriteInputTokens: 2048,
      uncachedInputTokens: 0
    });
  });

  it('parses Anthropic cache_read_input_tokens from message_delta stream usage', () => {
    const parsed = parseMessagesStreamPayload({
      type: 'message_delta',
      delta: { stop_reason: 'end_turn' },
      usage: {
        input_tokens: 3542,
        output_tokens: 194,
        cache_read_input_tokens: 17792,
        cache_creation_input_tokens: 0
      }
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
        cache_creation_input_tokens: 512
      }
    });

    expect(result.usage?.prompt_tokens).toBe(3542);
    expect(result.usage?.completion_tokens).toBe(194);
    expect(result.usage?.cached_tokens).toBe(17792);
    expect(result.usage?.cache_read_input_tokens).toBe(17792);
    expect(result.usage?.cache_creation_input_tokens).toBe(512);
  });

  it.each(['chat_completions', 'responses', 'messages'] as const)(
    'sends the same x-session-id affinity header on the %s endpoint',
    async (endpoint) => {
      const headersSeen: string[] = [];
      const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
        headersSeen.push(new Headers(init?.headers).get('x-session-id') ?? '');
        if (endpoint === 'responses') {
          return new Response(
            JSON.stringify({
              id: 'resp_test',
              output: [{ type: 'message', content: [{ type: 'output_text', text: 'ok' }] }],
              usage: { input_tokens: 10, output_tokens: 1, total_tokens: 11 }
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (endpoint === 'messages') {
          return new Response(
            JSON.stringify({
              id: 'msg_test',
              content: [{ type: 'text', text: 'ok' }],
              usage: { input_tokens: 10, output_tokens: 1, total_tokens: 11 }
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response(
          JSON.stringify({
            id: 'chatcmpl_test',
            choices: [{ message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
            usage: { prompt_tokens: 10, completion_tokens: 1, total_tokens: 11 }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      });
      vi.stubGlobal('fetch', fetchMock);

      try {
        const provider = new OpenAIProvider(
          'https://example.com/v1',
          'test-key',
          'test-model',
          undefined,
          endpoint
        );
        await provider.generateContent([{ role: 'user', content: 'hello' }], [], 'stable', {
          responseCache: {
            enableStore: true,
            cacheKey: 'session-cache-key',
            sessionId: 'session-affinity-1',
            cacheEligibility: true,
            endpoint
          }
        });
      } finally {
        vi.unstubAllGlobals();
      }

      expect(headersSeen).toEqual(['session-affinity-1']);
    }
  );

  describe('applyAnthropicPromptCache system prompt breakpoint', () => {
    const cacheKey = { enableStore: true, cacheKey: 'session-1:claude:provider' };

    it('marks the system prompt with cache_control on the first turn (single user message)', () => {
      const messages = [{ role: 'user', content: 'hello' }];
      const { system, messages: outMessages } = applyAnthropicPromptCache(
        messages,
        'You are a helpful assistant.',
        cacheKey
      );

      expect(Array.isArray(system)).toBe(true);
      expect((system as Array<Record<string, unknown>>)[0]?.cache_control).toEqual({
        type: 'ephemeral',
        ttl: '1h'
      });
      // First-turn user message is the dynamic latest input — no breakpoint.
      expect((outMessages[0] as Record<string, unknown>).cache_control).toBeUndefined();
    });

    it('marks both system and the last stable message on later turns', () => {
      const messages = [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi' },
        { role: 'user', content: 'what now?' }
      ];
      const { system, messages: outMessages } = applyAnthropicPromptCache(
        messages,
        'You are a helpful assistant.',
        cacheKey
      );

      expect((system as Array<Record<string, unknown>>)[0]?.cache_control).toEqual({
        type: 'ephemeral',
        ttl: '1h'
      });
      // markAnthropicCacheControl puts the breakpoint on the last content block
      // of the last stable message (the assistant turn), not the message top level.
      const stableLast = outMessages[1] as Record<string, unknown>;
      const latest = outMessages[2] as Record<string, unknown>;
      const stableLastContent = stableLast.content as Array<Record<string, unknown>>;
      expect(stableLastContent[stableLastContent.length - 1]?.cache_control).toEqual({
        type: 'ephemeral',
        ttl: '1h'
      });
      expect(latest.cache_control).toBeUndefined();
    });

    it('leaves system unmarked when caching is disabled', () => {
      const { system } = applyAnthropicPromptCache(
        [{ role: 'user', content: 'hello' }],
        'You are a helpful assistant.',
        undefined
      );

      expect(system).toBe('You are a helpful assistant.');
    });
  });

  describe('markAnthropicToolsCacheControl', () => {
    const cacheKey = { enableStore: true, cacheKey: 'session-1:claude:provider' };

    it('marks the last tool with cache_control when caching is enabled', () => {
      const tools = [
        { name: 'search', input_schema: { type: 'object' } },
        { name: 'write', input_schema: { type: 'object' } }
      ];
      const result = markAnthropicToolsCacheControl(tools, cacheKey);

      expect((result![0] as Record<string, unknown>).cache_control).toBeUndefined();
      expect((result![1] as Record<string, unknown>).cache_control).toEqual({
        type: 'ephemeral',
        ttl: '1h'
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

  it('emits unified cache usage for a provider cache hit', () => {
    const response = attachPromptCacheUsage(
      {
        content: 'ok',
        usage: {
          prompt_tokens: 100,
          completion_tokens: 5,
          total_tokens: 105,
          cached_tokens: 80
        }
      },
      {
        enableStore: true,
        cacheKey: 'pc:v1:global:openai:gpt-5',
        cacheNamespace: 'pc:v1:global:openai:gpt-5',
        cacheEligibility: true,
        cacheContractVersion: 'prompt-cache-v2',
        providerId: 'provider-openai',
        model: 'gpt-5',
        endpoint: 'responses',
        stablePrefixHash: 'stable-prefix-hash',
        ephemeralMessageCount: 2
      }
    );

    expect(response.usage?.prompt_cache).toMatchObject({
      cacheStatus: 'hit',
      cachedInputTokens: 80,
      uncachedInputTokens: 20,
      cacheNamespace: 'pc:v1:global:openai:gpt-5',
      cacheContractVersion: 'prompt-cache-v2',
      cacheKeyPresent: true,
      model: 'gpt-5',
      endpoint: 'responses',
      stablePrefixHash: 'stable-prefix-hash',
      ephemeralMessageCount: 2
    });
  });

  it('records unsupported instead of sending a false cache hit', () => {
    const response = attachPromptCacheUsage(
      { content: 'ok' },
      {
        enableStore: false,
        cacheEligibility: false,
        cacheDisableReason: 'GEMINI provider adapter does not expose prompt cache controls'
      }
    );

    expect(response.usage?.prompt_cache).toMatchObject({
      cacheStatus: 'unsupported',
      requested: false,
      cachedInputTokens: 0,
      cacheKeyPresent: false
    });
  });
});

describe('prompt cache route affinity helpers', () => {
  it('resolves effective endpoint preferring pinned then configured then auto plan', async () => {
    const {
      resolveEffectiveApiEndpoint,
      mapAttemptLabelToApiEndpoint,
      resolveStreamEndpointPlans
    } = await import('../src/services/AIProvider.js');

    expect(
      resolveEffectiveApiEndpoint({
        configuredEndpoint: 'auto',
        pinnedEndpoint: 'responses',
        providerType: 'OPENAI'
      })
    ).toBe('responses');

    expect(
      resolveEffectiveApiEndpoint({
        configuredEndpoint: 'messages',
        providerType: 'CLAUDE'
      })
    ).toBe('messages');

    expect(mapAttemptLabelToApiEndpoint('chat/completions')).toBe('chat_completions');
    expect(
      resolveStreamEndpointPlans({ apiUrl: 'https://example.com', apiEndpoint: 'responses' })
    ).toEqual(['responses']);
  });

  it('records fingerprint mismatch as a miss while keeping prompt cache eligible', () => {
    const response = attachPromptCacheUsage(
      { content: 'ok', usage: { prompt_tokens: 100, completion_tokens: 5, total_tokens: 105 } },
      {
        enableStore: true,
        cacheKey: 'cache-1',
        cacheEligibility: true,
        cacheContractVersion: 'prompt-cache-v2',
        cacheDisableReason: 'response_input_fingerprint_mismatch',
        responseInputFingerprint: 'turn-b'
      }
    );

    expect(response.usage?.prompt_cache).toMatchObject({
      cacheStatus: 'miss',
      eligible: true,
      cacheDisableReason: 'response_input_fingerprint_mismatch',
      turnContextFingerprint: 'turn-b'
    });
  });

  it('sets store:false for pi-context-v2 Responses API bodies', () => {
    const body = buildResponsesApiBody(
      'gpt-4o',
      [{ role: 'user', content: 'hello' }],
      [],
      'stable identity',
      'none',
      {
        enableStore: true,
        cacheKey: 'cache-1',
        cacheContractVersion: 'prompt-cache-v2',
        cacheEligibility: true
      }
    );

    expect(body.store).toBe(false);
    expect(body.prompt_cache_key).toBe('cache-1');
  });

  it('keeps dynamic date instructions outside the stable v2 prefix on all endpoints', () => {
    const responseCache = {
      enableStore: true,
      cacheKey: 'cache-1',
      cacheContractVersion: 'prompt-cache-v2' as const,
      cacheEligibility: true,
      ephemeralMessageCount: 0
    };
    const system = 'stable identity\n\n当前处理日期为: 2026-08-01';

    const chat = buildChatCompletionsBody(
      'model',
      [{ role: 'user', content: 'hello' }],
      [],
      system,
      'none',
      { ...responseCache, endpoint: 'chat_completions' }
    );
    const chatMessages = chat.messages as Array<Record<string, unknown>>;
    expect(chatMessages[0]).toEqual({ role: 'system', content: 'stable identity' });
    expect(chatMessages[1]?.content).toEqual([
      {
        type: 'text',
        text: 'hello',
        prompt_cache_breakpoint: { mode: 'explicit' }
      }
    ]);
    expect(chat.prompt_cache_options).toEqual({ mode: 'explicit', ttl: '30m' });
    expect(chatMessages.at(-1)?.content).toContain('当前处理日期为: 2026-08-01');

    const responses = buildResponsesApiBody(
      'model',
      [{ role: 'user', content: 'hello' }],
      [],
      system,
      'none',
      { ...responseCache, endpoint: 'responses' }
    );
    expect(responses.instructions).toBe('stable identity');
    expect(responses.prompt_cache_options).toEqual({ mode: 'explicit', ttl: '30m' });
    expect((responses.input as Array<Record<string, unknown>>)[0]?.content).toEqual([
      {
        type: 'input_text',
        text: 'hello',
        prompt_cache_breakpoint: { mode: 'explicit' }
      }
    ]);
    expect((responses.input as Array<Record<string, unknown>>).at(-1)?.content).toContain(
      '当前处理日期为: 2026-08-01'
    );

    const messages = buildMessagesApiBody(
      'model',
      [{ role: 'user', content: 'hello' }],
      [],
      system,
      'none',
      { ...responseCache, endpoint: 'messages' }
    );
    expect(messages.system).toEqual([
      {
        type: 'text',
        text: 'stable identity',
        cache_control: { type: 'ephemeral', ttl: '1h' }
      }
    ]);
    expect((messages.messages as Array<Record<string, unknown>>).at(-1)?.content).toContain(
      '当前处理日期为: 2026-08-01'
    );
  });

  it('omits prompt_cache_key but keeps automatic prefix-cache eligibility', async () => {
    const {
      isUnsupportedPromptCacheKeyError,
      omitPromptCacheKey,
      withoutPromptCacheKey,
      attachPromptCacheUsage
    } = await import('../src/services/AIProvider.js');

    expect(isUnsupportedPromptCacheKeyError(new Error('400 未知请求字段: prompt_cache_key'))).toBe(
      true
    );
    expect(omitPromptCacheKey({ prompt_cache_key: 'k', model: 'm' })).toEqual({ model: 'm' });

    const omitted = withoutPromptCacheKey({
      enableStore: true,
      cacheKey: 'cache-1',
      cacheContractVersion: 'prompt-cache-v2',
      cacheEligibility: true,
      providerId: 'OPENAI'
    });
    expect(omitted?.cacheKey).toBeUndefined();
    expect(omitted?.cacheEligibility).toBe(true);
    expect(omitted?.cacheDisableReason).toBe('prompt_cache_key_omitted');

    const miss = attachPromptCacheUsage(
      { content: 'ok', usage: { prompt_tokens: 10, completion_tokens: 1, total_tokens: 11 } },
      omitted
    );
    expect(miss.usage?.prompt_cache).toMatchObject({
      cacheStatus: 'miss',
      cacheKeyPresent: false,
      eligible: true,
      cacheDisableReason: 'prompt_cache_key_omitted'
    });

    const hit = attachPromptCacheUsage(
      {
        content: 'ok',
        usage: {
          prompt_tokens: 100,
          completion_tokens: 1,
          total_tokens: 101,
          cached_tokens: 80
        }
      },
      omitted
    );
    expect(hit.usage?.prompt_cache).toMatchObject({
      cacheStatus: 'hit',
      cachedInputTokens: 80,
      eligible: true,
      cacheDisableReason: 'prompt_cache_key_omitted'
    });
  });

  it('retries the same endpoint without prompt_cache_key after gateway rejection', async () => {
    const bodies: Array<Record<string, unknown>> = [];
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
      bodies.push(body);
      if (Object.prototype.hasOwnProperty.call(body, 'prompt_cache_key')) {
        return new Response(
          JSON.stringify({ error: { message: '未知请求字段: prompt_cache_key' } }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
      return new Response(
        JSON.stringify({
          id: 'chatcmpl-ok',
          choices: [{ message: { role: 'assistant', content: 'hi' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      const provider = new OpenAIProvider(
        'https://example.com/v1',
        'test-key',
        'gpt-5.6-luna',
        undefined,
        'chat_completions'
      );
      const result = await provider.generateContent(
        [{ role: 'user', content: 'hello' }],
        [],
        'stable identity',
        {
          responseCache: {
            enableStore: true,
            cacheKey: 'session-cache-key',
            cacheContractVersion: 'prompt-cache-v2',
            cacheEligibility: true,
            providerId: 'OPENAI'
          }
        }
      );

      expect(bodies).toHaveLength(2);
      expect(bodies[0]?.prompt_cache_key).toBe('session-cache-key');
      expect(bodies[1]?.prompt_cache_key).toBeUndefined();
      expect(result.content).toBe('hi');
      expect(result.usage?.prompt_cache).toMatchObject({
        cacheDisableReason: 'prompt_cache_key_omitted',
        cacheKeyPresent: false,
        eligible: true
      });

      // Sticky: later calls omit the field without a failed probe.
      bodies.length = 0;
      await provider.generateContent([{ role: 'user', content: 'again' }], [], 'stable identity', {
        responseCache: {
          enableStore: true,
          cacheKey: 'session-cache-key',
          cacheContractVersion: 'prompt-cache-v2',
          cacheEligibility: true,
          providerId: 'OPENAI'
        }
      });
      expect(bodies).toHaveLength(1);
      expect(bodies[0]?.prompt_cache_key).toBeUndefined();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('falls back to automatic prefix caching when explicit breakpoints are rejected', async () => {
    const bodies: Array<Record<string, unknown>> = [];
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
      bodies.push(body);
      if (Object.prototype.hasOwnProperty.call(body, 'prompt_cache_options')) {
        return new Response(
          JSON.stringify({
            error: { message: 'prompt_cache_options is not supported on this model' }
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({
          id: 'chatcmpl-breakpoint-fallback',
          choices: [{ message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 100, completion_tokens: 1, total_tokens: 101 }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      const provider = new OpenAIProvider(
        'https://example.com/v1',
        'test-key',
        'gpt-5.6-luna',
        undefined,
        'chat_completions'
      );
      const result = await provider.generateContent(
        [{ role: 'user', content: 'hello' }],
        [],
        'stable identity',
        {
          responseCache: {
            enableStore: true,
            cacheKey: 'session-cache-key',
            cacheContractVersion: 'prompt-cache-v2',
            cacheEligibility: true,
            endpoint: 'chat_completions'
          }
        }
      );

      expect(bodies).toHaveLength(2);
      expect(bodies[0]?.prompt_cache_options).toEqual({ mode: 'explicit', ttl: '30m' });
      expect(JSON.stringify(bodies[0])).toContain('prompt_cache_breakpoint');
      expect(bodies[1]?.prompt_cache_options).toBeUndefined();
      expect(JSON.stringify(bodies[1])).not.toContain('prompt_cache_breakpoint');
      expect((bodies[1]?.messages as Array<Record<string, unknown>>)?.[1]?.content).toBe('hello');
      expect(result.usage?.prompt_cache).toMatchObject({
        cacheDisableReason: 'prompt_cache_breakpoint_omitted',
        eligible: true,
        cacheKeyPresent: true
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('re-probes prompt_cache_key per provider instance without persistent gateway state', async () => {
    const bodies: Array<Record<string, unknown>> = [];
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
      bodies.push(body);
      if (Object.prototype.hasOwnProperty.call(body, 'prompt_cache_key')) {
        return new Response(
          JSON.stringify({ error: { message: '未知请求字段: prompt_cache_key' } }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
      return new Response(
        JSON.stringify({
          id: 'chatcmpl-ok',
          choices: [{ message: { role: 'assistant', content: 'hi' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const cacheOpts = {
      responseCache: {
        enableStore: true,
        cacheKey: 'session-cache-key',
        cacheContractVersion: 'prompt-cache-v2' as const,
        cacheEligibility: true,
        providerId: 'OPENAI'
      }
    };

    try {
      const first = new OpenAIProvider(
        'https://gateway.example/v1',
        'test-key',
        'gpt-5.6-luna',
        undefined,
        'chat_completions'
      );
      await first.generateContent([{ role: 'user', content: 'hello' }], [], 'stable', cacheOpts);
      expect(bodies.some((body) => body.prompt_cache_key === 'session-cache-key')).toBe(true);

      bodies.length = 0;
      const second = new OpenAIProvider(
        'https://gateway.example/v1',
        'test-key',
        'gpt-5.6-luna',
        undefined,
        'chat_completions'
      );
      await second.generateContent(
        [{ role: 'user', content: 'next run' }],
        [],
        'stable',
        cacheOpts
      );
      expect(bodies).toHaveLength(2);
      expect(bodies[0]?.prompt_cache_key).toBe('session-cache-key');
      expect(bodies[1]?.prompt_cache_key).toBeUndefined();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('does not let chat_completions key rejection strip responses prompt_cache_key', async () => {
    const bodies: Array<Record<string, unknown>> = [];
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
      bodies.push({ url: String(url), ...body });
      if (
        String(url).includes('/chat/completions') &&
        Object.prototype.hasOwnProperty.call(body, 'prompt_cache_key')
      ) {
        return new Response(
          JSON.stringify({ error: { message: '未知请求字段: prompt_cache_key' } }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
      if (String(url).includes('/chat/completions')) {
        return new Response(
          JSON.stringify({
            id: 'chatcmpl-ok',
            choices: [{ message: { role: 'assistant', content: 'chat' }, finish_reason: 'stop' }],
            usage: {
              prompt_tokens: 10,
              completion_tokens: 1,
              total_tokens: 11,
              prompt_tokens_details: { cached_tokens: 8 }
            }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({
          id: 'resp_ok',
          output: [{ type: 'message', content: [{ type: 'output_text', text: 'resp' }] }],
          usage: { input_tokens: 10, output_tokens: 1, input_tokens_details: { cached_tokens: 8 } }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const cacheOpts = {
      responseCache: {
        enableStore: true,
        cacheKey: 'session-cache-key',
        cacheContractVersion: 'prompt-cache-v2' as const,
        cacheEligibility: true,
        providerId: 'OPENAI'
      }
    };

    try {
      const chat = new OpenAIProvider(
        'https://ymeng.example/v1',
        'test-key',
        'mimo-v2.5-pro',
        undefined,
        'chat_completions'
      );
      const chatResult = await chat.generateContent(
        [{ role: 'user', content: 'hello' }],
        [],
        'stable',
        cacheOpts
      );
      expect(chatResult.usage?.prompt_cache?.cacheStatus).toBe('hit');
      expect(chatResult.usage?.prompt_cache?.eligible).toBe(true);

      bodies.length = 0;
      const responses = new OpenAIProvider(
        'https://ymeng.example/v1',
        'test-key',
        'gpt-5.6-luna',
        undefined,
        'responses'
      );
      await responses.generateContent(
        [{ role: 'user', content: 'hello' }],
        [],
        'stable',
        cacheOpts
      );
      expect(bodies.some((body) => body.prompt_cache_key === 'session-cache-key')).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('retries without thinking.type=enabled after gateway rejection', async () => {
    const bodies: Array<Record<string, unknown>> = [];
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
      bodies.push(body);
      const thinking = body.thinking as { type?: string } | undefined;
      if (thinking?.type === 'enabled') {
        return new Response(
          JSON.stringify({ error: { message: '***.type 当前仅支持 disabled' } }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
      return new Response(
        JSON.stringify({
          id: 'chatcmpl-ok',
          choices: [{ message: { role: 'assistant', content: 'hi' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      const provider = new OpenAIProvider(
        'https://example.com/v1',
        'test-key',
        'gpt-5.6-luna',
        undefined,
        'chat_completions',
        'high'
      );
      const result = await provider.generateContent(
        [{ role: 'user', content: 'hello' }],
        [],
        'stable identity'
      );

      expect(bodies).toHaveLength(2);
      expect(bodies[0]?.thinking).toEqual({ type: 'enabled' });
      expect(bodies[0]?.reasoning_effort).toBe('high');
      expect(bodies[1]?.thinking).toBeUndefined();
      expect(bodies[1]?.reasoning_effort).toBe('high');
      expect(result.content).toBe('hi');

      bodies.length = 0;
      await provider.generateContent([{ role: 'user', content: 'again' }], [], 'stable identity');
      expect(bodies).toHaveLength(1);
      expect(bodies[0]?.thinking).toBeUndefined();
      expect(bodies[0]?.reasoning_effort).toBe('high');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('keeps the stable cache key while dynamic tail content changes', () => {
    const firstPrompt = [
      { role: 'user' as const, content: 'question' },
      {
        role: 'user' as const,
        content: '<linkloom_context>reference from run one</linkloom_context>'
      }
    ];
    const secondPrompt = [
      { role: 'user' as const, content: 'question' },
      { role: 'assistant' as const, content: 'tool request' },
      { role: 'tool' as const, tool_call_id: 'call-1', content: '{"ok":true}' },
      {
        role: 'user' as const,
        content: '<linkloom_context>reference from run two</linkloom_context>'
      }
    ];
    const openAiCache = (fingerprint: string, endpoint: 'chat_completions' | 'responses') => ({
      enableStore: true,
      cacheKey: 'session-cache-key',
      cacheNamespace: 'session-cache-namespace',
      cacheContractVersion: 'prompt-cache-v2',
      cacheEligibility: true,
      providerId: 'OPENAI',
      model: 'gpt-5',
      endpoint,
      stablePrefixHash: 'stable-prefix-hash',
      responseInputFingerprint: fingerprint,
      ephemeralMessageCount: 1
    });

    const firstChat = buildChatCompletionsBody(
      'gpt-5',
      firstPrompt,
      [],
      'stable identity',
      'none',
      openAiCache('turn-one', 'chat_completions')
    );
    const secondChat = buildChatCompletionsBody(
      'gpt-5',
      secondPrompt,
      [],
      'stable identity',
      'none',
      openAiCache('turn-two', 'chat_completions')
    );
    expect(firstChat.prompt_cache_key).toBe('session-cache-key');
    expect(secondChat.prompt_cache_key).toBe(firstChat.prompt_cache_key);
    expect((firstChat.messages as Array<Record<string, unknown>>).at(-1)?.content).toContain(
      'reference from run one'
    );
    expect((secondChat.messages as Array<Record<string, unknown>>).at(-1)?.content).toContain(
      'reference from run two'
    );

    const firstResponses = buildResponsesApiBody(
      'gpt-5',
      firstPrompt,
      [],
      'stable identity',
      'none',
      openAiCache('turn-one', 'responses')
    );
    const secondResponses = buildResponsesApiBody(
      'gpt-5',
      secondPrompt,
      [],
      'stable identity',
      'none',
      openAiCache('turn-two', 'responses')
    );
    expect(firstResponses.prompt_cache_key).toBe('session-cache-key');
    expect(secondResponses.prompt_cache_key).toBe(firstResponses.prompt_cache_key);
    expect((firstResponses.input as Array<Record<string, unknown>>).at(-1)?.content).toContain(
      'reference from run one'
    );
    expect((secondResponses.input as Array<Record<string, unknown>>).at(-1)?.content).toContain(
      'reference from run two'
    );

    const anthropicCache = (fingerprint: string) => ({
      enableStore: true,
      cacheKey: 'anthropic-session-cache-key',
      cacheContractVersion: 'prompt-cache-v2',
      cacheEligibility: true,
      providerId: 'CLAUDE',
      model: 'claude-sonnet',
      endpoint: 'messages',
      stablePrefixHash: 'stable-prefix-hash',
      responseInputFingerprint: fingerprint,
      ephemeralMessageCount: 1
    });
    const firstMessages = buildMessagesApiBody(
      'claude-sonnet',
      firstPrompt,
      [],
      'stable identity',
      'none',
      anthropicCache('turn-one')
    );
    const secondMessages = buildMessagesApiBody(
      'claude-sonnet',
      secondPrompt,
      [],
      'stable identity',
      'none',
      anthropicCache('turn-two')
    );
    expect(firstMessages.prompt_cache_key).toBeUndefined();
    expect(secondMessages.prompt_cache_key).toBeUndefined();
    expect((firstMessages.system as Array<Record<string, unknown>>)[0]?.cache_control).toEqual({
      type: 'ephemeral',
      ttl: '1h'
    });
    expect((secondMessages.system as Array<Record<string, unknown>>)[0]?.cache_control).toEqual({
      type: 'ephemeral',
      ttl: '1h'
    });
    expect((firstMessages.messages as Array<Record<string, unknown>>).at(-1)?.content).toContain(
      'reference from run one'
    );
    expect((secondMessages.messages as Array<Record<string, unknown>>).at(-1)?.content).toContain(
      'reference from run two'
    );
  });

  it('records context_conversion_unsupported from v2 provider conversion into usage', () => {
    const responseCache = {
      enableStore: true,
      cacheKey: 'cache-1',
      cacheContractVersion: 'prompt-cache-v2',
      cacheEligibility: true,
      ephemeralMessageCount: 1
    };
    const prompt = [
      { role: 'user', content: 'hello' },
      { role: 'system', content: 'private retrieval stack trace' }
    ];
    const enriched = resolvePromptCacheContext(
      responseCache,
      prompt,
      'stable identity',
      [],
      'responses'
    );

    expect(enriched?.conversionDiagnostics).toEqual(['context_conversion_unsupported']);

    const usage = attachPromptCacheUsage(
      {
        content: 'ok',
        usage: { prompt_tokens: 10, completion_tokens: 1, total_tokens: 11 }
      },
      enriched
    );

    expect(usage.usage?.prompt_cache?.conversionDiagnostics).toEqual([
      'context_conversion_unsupported'
    ]);
    expect(JSON.stringify(usage)).not.toContain('private retrieval stack trace');
  });

  it('keeps linkloom_context user messages out of stable system instructions', async () => {
    const { splitSystemFromPrompt } = await import('../src/services/AIProvider.js');
    const split = splitSystemFromPrompt(
      [
        {
          role: 'user',
          content: '<linkloom_context source="knowledge">kb</linkloom_context>'
        },
        { role: 'user', content: 'hello' }
      ],
      'stable identity',
      { piContextV2: true }
    );

    expect(split.systemInstruction).toBe('stable identity');
    expect(split.dynamicSystemSuffix).toBeUndefined();
    expect((split.conversation as Array<{ role: string }>).length).toBe(2);
  });

  it('keeps dynamic system suffix out of the stable instructions prefix', async () => {
    const { splitSystemFromPrompt } = await import('../src/services/AIProvider.js');
    const split = splitSystemFromPrompt(
      [
        { role: 'system', content: 'stable identity' },
        { role: 'system', content: '<retrieved_knowledge>kb</retrieved_knowledge>' },
        { role: 'user', content: 'hello' }
      ],
      'stable identity'
    );

    expect(split.systemInstruction).toBe('stable identity');
    expect(split.dynamicSystemSuffix).toContain('<retrieved_knowledge>');
    expect(Array.isArray(split.conversation)).toBe(true);
    expect((split.conversation as Array<{ role: string }>)[0]?.role).toBe('user');
  });

  it('keeps per-turn web search policy out of the stable system hash', async () => {
    const { buildPromptCacheContract } =
      await import('../src/services/agents/engine/promptCacheContract.js');
    const { resolvePromptCacheCapability } =
      await import('../src/services/agents/engine/promptCacheCapabilities.js');
    const { PI_CONTEXT_PROTOCOL_VERSION } =
      await import('../src/services/agents/context/PiContextTypes.js');
    const { assembleSystemMessages, buildPromptPipelineContext } =
      await import('../src/services/agents/prompt/index.js');

    const baseInput = {
      agentDef: {
        id: 'a',
        name: 'A',
        description: '',
        systemPrompt: 'You are X',
        providerId: 'GEMINI',
        model: 'gemini-2.0-flash',
        temperature: 0,
        toolIds: [],
        skillIds: [],
        mcpServerIds: []
      } as never,
      providerId: 'GEMINI',
      providerConfig: { type: 'GEMINI' } as never,
      model: 'gemini-2.0-flash',
      tools: [],
      skills: [],
      mcpTools: [],
      skillMetadata: []
    };

    const offAssembled = assembleSystemMessages(
      buildPromptPipelineContext({
        ...baseInput,
        webSearchPolicy: {
          effectiveMode: 'off',
          injectToolIds: [],
          stripToolIds: ['web_search'],
          enableProviderBuiltinSearch: false,
          degradedFromProvider: false
        }
      })
    );
    const appAssembled = assembleSystemMessages(
      buildPromptPipelineContext({
        ...baseInput,
        webSearchPolicy: {
          effectiveMode: 'app',
          injectToolIds: ['web_search'],
          stripToolIds: [],
          enableProviderBuiltinSearch: false,
          degradedFromProvider: false
        }
      })
    );

    const capability = resolvePromptCacheCapability('GEMINI');
    const offContract = buildPromptCacheContract({
      providerId: 'GEMINI',
      model: 'gemini-2.0-flash',
      contextProtocolVersion: PI_CONTEXT_PROTOCOL_VERSION,
      stablePrefix: offAssembled.systemMessage.content,
      variantParts: offAssembled.contributions
        ?.filter((contribution) => contribution.cacheClass === 'variant')
        .map((contribution) => ({
          providerId: contribution.providerId,
          variantKey: contribution.variantKey,
          content: contribution.content
        })),
      capability
    });
    const appContract = buildPromptCacheContract({
      providerId: 'GEMINI',
      model: 'gemini-2.0-flash',
      contextProtocolVersion: PI_CONTEXT_PROTOCOL_VERSION,
      stablePrefix: appAssembled.systemMessage.content,
      variantParts: appAssembled.contributions
        ?.filter((contribution) => contribution.cacheClass === 'variant')
        .map((contribution) => ({
          providerId: contribution.providerId,
          variantKey: contribution.variantKey,
          content: contribution.content
        })),
      capability
    });

    expect(offContract.stablePrefixHash).toBe(appContract.stablePrefixHash);
    expect(offContract.variantHash).toBe(appContract.variantHash);
  });
});
