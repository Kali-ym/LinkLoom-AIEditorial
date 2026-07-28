import { describe, expect, it } from 'vitest';

import type { AgentSession } from '../src/services/agents/engine/AgentSession.js';
import {
  buildPromptCacheKey,
  buildResponseCacheRequest,
  classifyProviderContextId,
  extractChainedResponsesInput,
  extractProviderContextIds,
  normalizeRuntimeMessageContent,
  pickRicherRuntimeHistory,
  resolveResponseCacheFromSessions,
  resolveResponsesChainId,
} from '../src/services/agents/engine/responseContextCache.js';

describe('responseContextCache', () => {
  it('prefers client history when it is richer than session history', () => {
    const sessionHistory = [{ role: 'user' as const, content: 'hello' }];
    const clientHistory = [
      { role: 'user' as const, content: 'hello' },
      { role: 'assistant' as const, content: 'hi' },
      { role: 'user' as const, content: 'again' },
    ];
    expect(pickRicherRuntimeHistory(sessionHistory, clientHistory)).toEqual(clientHistory);
  });

  it('builds stable prompt cache keys', () => {
    expect(buildPromptCacheKey('session-1', 'gpt-5.5', 'openai')).toBe('session-1:gpt-5.5:openai');
  });

  it('normalizes assistant reasoning parts to plain text for stable prefixes', () => {
    expect(
      normalizeRuntimeMessageContent([
        { kind: 'reasoning', text: 'thinking...' },
        { kind: 'text', text: 'final answer' },
      ]),
    ).toBe('final answer');
  });

  it('builds prompt cache key requests without response chaining', () => {
    const request = buildResponseCacheRequest(
      [
        { role: 'user', content: 'first' },
        { role: 'assistant', content: 'ok' },
        { role: 'user', content: 'second' },
      ],
      { responseId: 'resp_123', model: 'gpt-5.5', providerId: 'openai', cacheKey: 'session-1' },
    );

    expect(request).toEqual({
      enableStore: true,
      cacheKey: 'session-1',
    });
    expect(extractChainedResponsesInput([{ role: 'user', content: 'only' }])).toEqual([
      { role: 'user', content: 'only' },
    ]);
  });

  it('builds chat completions cache key when no chain id exists', () => {
    const request = buildResponseCacheRequest([], undefined, {
      cacheKey: 'session-2',
      enableStore: true,
    });
    expect(request).toEqual({ enableStore: true, cacheKey: 'session-2' });
  });

  it('extracts completion and message ids', () => {
    expect(extractProviderContextIds({ id: 'chatcmpl-abc' })).toEqual({
      completionId: 'chatcmpl-abc',
    });
    expect(extractProviderContextIds({ message: { id: 'msg_xyz' } })).toEqual({
      messageId: 'msg_xyz',
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
        },
      },
    ];

    expect(resolveResponseCacheFromSessions(sessions, 'gpt-5.5', 'openai')).toBeUndefined();
    expect(
      resolveResponseCacheFromSessions(sessions, 'gpt-4.1', 'openai')?.completionId,
    ).toBe('chatcmpl_old');
  });

  it('resolveResponsesChainId remains available for future WebSocket v2', () => {
    expect(
      resolveResponsesChainId({
        enableStore: true,
        previousCompletionId: 'chatcmpl-abc',
      }),
    ).toBeUndefined();
    expect(
      resolveResponsesChainId({
        enableStore: true,
        previousResponseId: 'resp_abc',
      }),
    ).toBe('resp_abc');
  });
});
