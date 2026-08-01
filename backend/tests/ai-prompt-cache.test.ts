import { describe, expect, it } from 'vitest';

import {
  applyAnthropicPromptCache,
  attachPromptCacheUsage,
  buildResponsesApiBody,
  extractMessagesApiResult,
  markAnthropicToolsCacheControl,
  parseChatCompletionsStreamPayload,
  parseMessagesStreamPayload,
  parseResponsesStreamPayload,
  resolvePromptCacheContext,
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

  it('emits unified cache usage for a provider cache hit', () => {
    const response = attachPromptCacheUsage(
      {
        content: 'ok',
        usage: {
          prompt_tokens: 100,
          completion_tokens: 5,
          total_tokens: 105,
          cached_tokens: 80,
        },
      },
      {
        enableStore: true,
        cacheKey: 'pc:v1:global:openai:gpt-5',
        cacheNamespace: 'pc:v1:global:openai:gpt-5',
        cacheEligibility: true,
        cacheContractVersion: 'prompt-cache-v2',
        providerId: 'provider-openai',
      },
    );

    expect(response.usage?.prompt_cache).toMatchObject({
      cacheStatus: 'hit',
      cachedInputTokens: 80,
      uncachedInputTokens: 20,
      cacheNamespace: 'pc:v1:global:openai:gpt-5',
      cacheContractVersion: 'prompt-cache-v2',
    });
  });

  it('records unsupported instead of sending a false cache hit', () => {
    const response = attachPromptCacheUsage(
      { content: 'ok' },
      {
        enableStore: false,
        cacheEligibility: false,
        cacheDisableReason: 'GEMINI provider adapter does not expose prompt cache controls',
      },
    );

    expect(response.usage?.prompt_cache).toMatchObject({
      cacheStatus: 'unsupported',
      requested: false,
      cachedInputTokens: 0,
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
    expect(resolveStreamEndpointPlans({ apiUrl: 'https://example.com', apiEndpoint: 'responses' })).toEqual([
      'responses'
    ]);
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
        responseInputFingerprint: 'turn-b',
      },
    );

    expect(response.usage?.prompt_cache).toMatchObject({
      cacheStatus: 'miss',
      eligible: true,
      cacheDisableReason: 'response_input_fingerprint_mismatch',
      turnContextFingerprint: 'turn-b',
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
        cacheEligibility: true,
      },
    );

    expect(body.store).toBe(false);
    expect(body.prompt_cache_key).toBe('cache-1');
  });

  it('records context_conversion_unsupported from v2 provider conversion into usage', () => {
    const responseCache = {
      enableStore: true,
      cacheKey: 'cache-1',
      cacheContractVersion: 'prompt-cache-v2',
      cacheEligibility: true,
      ephemeralMessageCount: 1,
    };
    const prompt = [
      { role: 'user', content: 'hello' },
      { role: 'system', content: 'private retrieval stack trace' },
    ];
    const enriched = resolvePromptCacheContext(
      responseCache,
      prompt,
      'stable identity',
      [],
      'responses',
    );

    expect(enriched?.conversionDiagnostics).toEqual(['context_conversion_unsupported']);

    const usage = attachPromptCacheUsage(
      {
        content: 'ok',
        usage: { prompt_tokens: 10, completion_tokens: 1, total_tokens: 11 },
      },
      enriched,
    );

    expect(usage.usage?.prompt_cache?.conversionDiagnostics).toEqual([
      'context_conversion_unsupported',
    ]);
    expect(JSON.stringify(usage)).not.toContain('private retrieval stack trace');
  });

  it('keeps linkloom_context user messages out of stable system instructions', async () => {
    const { splitSystemFromPrompt } = await import('../src/services/AIProvider.js');
    const split = splitSystemFromPrompt(
      [
        {
          role: 'user',
          content: '<linkloom_context source="knowledge">kb</linkloom_context>',
        },
        { role: 'user', content: 'hello' },
      ],
      'stable identity',
      { piContextV2: true },
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
    const { buildPromptCacheContract } = await import(
      '../src/services/agents/engine/promptCacheContract.js'
    );
    const { resolvePromptCacheCapability } = await import(
      '../src/services/agents/engine/promptCacheCapabilities.js'
    );
    const { PI_CONTEXT_PROTOCOL_VERSION } = await import(
      '../src/services/agents/context/PiContextTypes.js'
    );
    const {
      assembleSystemMessages,
      buildPromptPipelineContext
    } = await import('../src/services/agents/prompt/index.js');

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
