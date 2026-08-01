import { describe, expect, it } from 'vitest';

import type { AgentSession } from '../src/services/agents/engine/AgentSession.js';
import {
  buildPromptCacheKey,
  buildPromptCacheReplayContextMetadata,
  buildPromptCacheReplayHistoryMetadata,
  buildResponseCacheRequest,
  classifyProviderContextId,
  extractChainedResponsesInput,
  extractPromptCacheReplayContext,
  extractProviderContextIds,
  insertPromptCacheReplayContext,
  mergePromptCacheReplayContextHistory,
  normalizeRuntimeMessageContent,
  pickRicherRuntimeHistory,
  readPromptCacheReplayHistory,
  readPromptCacheReplayContext,
  resolvePinnedSessionEndpoint,
  resolveResponseCacheFromSessions,
  resolveResponsesChainId
} from '../src/services/agents/engine/responseContextCache.js';

describe('responseContextCache', () => {
  it('prefers canonical client history when it is richer than session history', () => {
    const sessionHistory = [{ role: 'user' as const, content: 'hello' }];
    const clientHistory = [
      { role: 'user' as const, content: 'hello' },
      {
        role: 'assistant' as const,
        content: 'hi',
        canonical_message_version: 'canonical-message-v1'
      },
      { role: 'user' as const, content: 'again' }
    ];
    expect(pickRicherRuntimeHistory(sessionHistory, clientHistory)).toEqual(clientHistory);
  });

  it('keeps session history when client history is longer but not canonical', () => {
    const sessionHistory = [
      { role: 'user' as const, content: 'hello' },
      {
        role: 'assistant' as const,
        content: 'from session',
        canonical_message_version: 'canonical-message-v1'
      }
    ];
    const clientHistory = [
      { role: 'user' as const, content: 'hello' },
      { role: 'assistant' as const, content: 'from client' },
      { role: 'user' as const, content: 'again' }
    ];
    expect(pickRicherRuntimeHistory(sessionHistory, clientHistory)).toEqual(sessionHistory);
  });

  it('builds stable prompt cache keys', () => {
    expect(buildPromptCacheKey('session-1', 'gpt-5.5', 'openai')).toBe('session-1:gpt-5.5:openai');
  });

  it('normalizes assistant reasoning parts to plain text for stable prefixes', () => {
    expect(
      normalizeRuntimeMessageContent([
        { kind: 'reasoning', text: 'thinking...' },
        { kind: 'text', text: 'final answer' }
      ])
    ).toBe('final answer');
  });

  it('captures only new request-only context for hidden replay', () => {
    const previousContext = {
      role: 'user' as const,
      content: '<linkloom_context source="previous">old</linkloom_context>'
    };
    const currentContext = {
      role: 'user' as const,
      content: '<linkloom_context source="current">new</linkloom_context>'
    };
    const persistentMessages = [
      { role: 'user' as const, content: 'first turn' },
      previousContext,
      { role: 'assistant' as const, content: 'first answer' }
    ];
    const requestMessages = [
      ...persistentMessages,
      { role: 'user' as const, content: 'second turn' },
      currentContext
    ];

    expect(extractPromptCacheReplayContext(requestMessages, persistentMessages)).toEqual([
      currentContext
    ]);
  });

  it('stores the exact previous provider request plus the final runtime tail', () => {
    const context = {
      role: 'user' as const,
      content: '<linkloom_context source="current">context</linkloom_context>'
    };
    const requestMessages = [{ role: 'user' as const, content: 'turn' }, context];
    const persistentMessages = [
      { role: 'user' as const, content: 'turn' },
      { role: 'assistant' as const, content: 'answer' }
    ];
    const metadata = buildPromptCacheReplayHistoryMetadata(requestMessages, persistentMessages);

    expect(readPromptCacheReplayHistory({ promptCacheReplayHistory: metadata })).toEqual({
      messages: requestMessages,
      tailMessages: [{ role: 'assistant', content: 'answer' }]
    });
  });

  it('round-trips bounded replay metadata and inserts it after the user turn', () => {
    const replayContext = [
      {
        role: 'user' as const,
        content: '<linkloom_context source="current">new</linkloom_context>'
      }
    ];
    const metadata = buildPromptCacheReplayContextMetadata(replayContext);
    expect(readPromptCacheReplayContext({ promptCacheReplayContext: metadata })).toEqual(
      replayContext
    );
    expect(
      insertPromptCacheReplayContext(
        [
          { role: 'user' as const, content: 'second turn' },
          { role: 'assistant' as const, content: 'answer' }
        ],
        replayContext
      )
    ).toEqual([
      { role: 'user', content: 'second turn' },
      ...replayContext,
      { role: 'assistant', content: 'answer' }
    ]);
  });

  it('reattaches hidden replay context to richer client history', () => {
    const hidden = {
      role: 'user' as const,
      content: '<linkloom_context source="current">new</linkloom_context>'
    };
    const sourceHistory = [
      { role: 'user' as const, content: 'first turn' },
      hidden,
      { role: 'assistant' as const, content: 'answer' }
    ];
    const clientHistory = [
      { role: 'user' as const, content: 'first turn' },
      { role: 'assistant' as const, content: 'answer' }
    ];

    expect(mergePromptCacheReplayContextHistory(sourceHistory, clientHistory)).toEqual([
      clientHistory[0],
      hidden,
      clientHistory[1]
    ]);
  });

  it('rejects replay metadata beyond the bounded history size', () => {
    const oversized = Array.from({ length: 33 }, (_, index) => ({
      role: 'user' as const,
      content: `<linkloom_context source="source-${index}">context</linkloom_context>`
    }));
    expect(buildPromptCacheReplayContextMetadata(oversized)).toBeUndefined();
  });

  it('builds prompt cache key requests without response chaining', () => {
    const request = buildResponseCacheRequest(
      [
        { role: 'user', content: 'first' },
        { role: 'assistant', content: 'ok' },
        { role: 'user', content: 'second' }
      ],
      { responseId: 'resp_123', model: 'gpt-5.5', providerId: 'openai', cacheKey: 'session-1' }
    );

    expect(request).toEqual({
      enableStore: true,
      cacheKey: 'session-1'
    });
    expect(extractChainedResponsesInput([{ role: 'user', content: 'only' }])).toEqual([
      { role: 'user', content: 'only' }
    ]);
  });

  it('builds chat completions cache key when no chain id exists', () => {
    const request = buildResponseCacheRequest([], undefined, {
      cacheKey: 'session-2',
      enableStore: true
    });
    expect(request).toEqual({ enableStore: true, cacheKey: 'session-2' });
  });

  it('extracts completion and message ids', () => {
    expect(extractProviderContextIds({ id: 'chatcmpl-abc' })).toEqual({
      completionId: 'chatcmpl-abc'
    });
    expect(extractProviderContextIds({ message: { id: 'msg_xyz' } })).toEqual({
      messageId: 'msg_xyz'
    });
    expect(classifyProviderContextId('chatcmpl-abc')).toBe('completion');
    expect(classifyProviderContextId('msg_xyz')).toBe('message');
  });

  it('invalidates cache when model or provider changed', () => {
    const sessions: AgentSession[] = [
      {
        sessionId: 's1',
        runId: 'run-1',
        source: 'agent',
        status: 'succeeded',
        messages: [],
        events: [],
        checkpoints: [],
        artifacts: [],
        createdAt: '2026-06-20T08:00:00.000Z',
        updatedAt: '2026-06-20T08:01:00.000Z',
        metadata: {
          providerCompletionId: 'chatcmpl_old',
          model: 'gpt-4.1',
          providerId: 'openai',
          turnContextFingerprint: 'turn-fp'
        }
      }
    ];

    expect(resolveResponseCacheFromSessions(sessions, 'gpt-5.5', 'openai')).toBeUndefined();
    const matched = resolveResponseCacheFromSessions(
      sessions,
      'gpt-4.1',
      'openai',
      undefined,
      'turn-fp'
    );
    expect(matched?.completionId).toBe('chatcmpl_old');
    expect(
      resolveResponseCacheFromSessions(sessions, 'gpt-4.1', 'openai')?.completionId
    ).toBeUndefined();
  });

  it('resolveResponsesChainId remains available for future WebSocket v2', () => {
    expect(
      resolveResponsesChainId({
        enableStore: true,
        previousCompletionId: 'chatcmpl-abc'
      })
    ).toBeUndefined();
    expect(
      resolveResponsesChainId({
        enableStore: true,
        previousResponseId: 'resp_abc'
      })
    ).toBe('resp_abc');
  });

  it('prefers namespace-derived cache key over legacy sessionId:model:providerId', () => {
    const sessions: AgentSession[] = [
      {
        sessionId: 's1',
        runId: 'run-1',
        source: 'agent',
        status: 'succeeded',
        messages: [],
        events: [],
        checkpoints: [],
        artifacts: [],
        createdAt: '2026-06-20T08:00:00.000Z',
        updatedAt: '2026-06-20T08:01:00.000Z',
        metadata: {
          providerResponseId: 'resp_abc',
          model: 'gpt-5.5',
          providerId: 'openai',
          providerCacheNamespace: 'pc:v1:session:s1:openai:gpt-5.5:chat:none:x:y',
          providerCacheKey: 'canonical-key-from-namespace',
          providerEndpoint: 'chat_completions',
          providerReasoningMode: 'none'
        }
      }
    ];

    const entry = resolveResponseCacheFromSessions(sessions, 'gpt-5.5', 'openai');
    expect(entry?.cacheKey).toBe('canonical-key-from-namespace');
    expect(entry?.cacheNamespace).toContain('session:s1');
    expect(entry?.endpoint).toBe('chat_completions');
  });

  it('resolves pinned session endpoint from prior metadata', () => {
    const sessions: AgentSession[] = [
      {
        sessionId: 's1',
        runId: 'run-1',
        source: 'agent',
        status: 'succeeded',
        messages: [],
        events: [],
        checkpoints: [],
        artifacts: [],
        createdAt: '2026-06-20T08:00:00.000Z',
        updatedAt: '2026-06-20T08:01:00.000Z',
        metadata: {
          model: 'gpt-5.5',
          providerId: 'openai',
          providerEndpoint: 'responses'
        }
      }
    ];

    expect(resolvePinnedSessionEndpoint(sessions, 'gpt-5.5', 'openai')).toBe('responses');
    expect(resolvePinnedSessionEndpoint(sessions, 'other', 'openai')).toBeUndefined();
  });

  it('isolates provider response ids by dynamic input fingerprint', () => {
    const sessions = [
      {
        runId: 'run-1',
        sessionId: 'session-1',
        source: 'agent',
        status: 'succeeded',
        messages: [],
        events: [],
        checkpoints: [],
        artifacts: [],
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:01:00.000Z',
        metadata: {
          model: 'gpt-4o',
          providerId: 'openai',
          providerResponseId: 'resp_1',
          providerCacheKey: 'cache-1',
          turnContextFingerprint: 'turn-a'
        }
      }
    ] as AgentSession[];
    const first = resolveResponseCacheFromSessions(
      sessions,
      'gpt-4o',
      'openai',
      'cache-1',
      'turn-a'
    );
    const second = resolveResponseCacheFromSessions(
      sessions,
      'gpt-4o',
      'openai',
      'cache-1',
      'turn-b'
    );
    expect(first?.cacheKey).toBe('cache-1');
    expect(first?.responseId).toBe('resp_1');
    expect(second?.cacheKey).toBe('cache-1');
    expect(second?.responseId).toBeUndefined();
  });

  it('withholds provider ids when either fingerprint is missing', () => {
    const sessions = [
      {
        runId: 'run-1',
        sessionId: 'session-1',
        source: 'agent',
        status: 'succeeded',
        messages: [],
        events: [],
        checkpoints: [],
        artifacts: [],
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:01:00.000Z',
        metadata: {
          model: 'gpt-4o',
          providerId: 'openai',
          providerResponseId: 'resp_1',
          providerCacheKey: 'cache-1',
          turnContextFingerprint: 'turn-a'
        }
      }
    ] as AgentSession[];

    expect(
      resolveResponseCacheFromSessions(sessions, 'gpt-4o', 'openai', 'cache-1')?.responseId
    ).toBeUndefined();
    expect(
      resolveResponseCacheFromSessions(sessions, 'gpt-4o', 'openai', 'cache-1', 'turn-a')
        ?.responseId
    ).toBe('resp_1');
  });

  it('builds response cache request from contract cacheKey/namespace', () => {
    const contract = {
      contractVersion: 'prompt-cache-v2' as const,
      promptSchemaVersion: 'prompt-schema-v2',
      historySerializationVersion: 'canonical-history-v1',
      contextProtocolVersion: 'pi-context-v2' as const,
      providerId: 'OPENAI',
      model: 'gpt-5',
      endpoint: 'chat_completions',
      reasoningMode: 'none',
      stablePrefixHash: 'a',
      variantHash: 'b',
      toolsetHash: 'c',
      cacheNamespace: 'pc:v1:session:s1:OPENAI:gpt-5:chat_completions:none:x:y',
      cacheKey: 'contract-derived-key',
      cacheScope: 'session' as const,
      cachePolicy: 'isolated' as const,
      cacheMode: 'enforced' as const,
      cacheEligibility: true,
      capability: { supportsPromptCache: true, family: 'openai' as const },
      sessionId: 's1'
    };

    const request = buildResponseCacheRequest([], undefined, { contract });
    expect(request?.cacheKey).toBe('contract-derived-key');
    expect(request?.cacheNamespace).toBe(contract.cacheNamespace);
    expect(request?.sessionId).toBe('s1');
    expect(request?.endpoint).toBe('chat_completions');
    expect(request?.stablePrefixHash).toBe(contract.stablePrefixHash);
  });
});
