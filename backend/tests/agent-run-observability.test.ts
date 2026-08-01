import { describe, expect, it } from 'vitest';
import type { AgentSession } from '../src/services/agents/engine/AgentSession.js';
import { computeAgentRunMetrics } from '../src/services/agents/AgentRunObservability.js';

describe('agent run cache observability', () => {
  it('aggregates cache status, tokens, savings and disable reasons', () => {
    const session = {
      runId: 'run-1',
      events: [
        {
          type: 'model_finished',
          payload: {
            usage: {
              prompt_tokens: 100,
              completion_tokens: 10,
              total_tokens: 110,
              prompt_cache: {
                cacheStatus: 'hit',
                cachedInputTokens: 80,
                cacheWriteInputTokens: 0,
                uncachedInputTokens: 20,
                estimatedCacheSavingsUsd: 0.001,
                cacheDisableReason: undefined
              }
            }
          }
        },
        {
          type: 'model_finished',
          payload: {
            usage: {
              prompt_tokens: 50,
              completion_tokens: 5,
              total_tokens: 55,
              prompt_cache: {
                cacheStatus: 'unsupported',
                cachedInputTokens: 0,
                cacheWriteInputTokens: 0,
                uncachedInputTokens: 50,
                cacheDisableReason: 'GEMINI provider adapter does not expose prompt cache controls'
              }
            }
          }
        }
      ]
    } as unknown as AgentSession;

    const metrics = computeAgentRunMetrics([], [session]);

    expect(metrics.tokenUsage).toMatchObject({
      totalTokens: 165,
      cachedInputTokens: 80,
      uncachedInputTokens: 70,
      cacheHits: 1,
      cacheUnsupported: 1,
      cacheHitRate: 100,
      estimatedCacheSavingsUsd: 0.001
    });
    expect(metrics.tokenUsage.cacheDisableReasons).toEqual({
      'GEMINI provider adapter does not expose prompt cache controls': 1
    });
  });

  it('aggregates per-call fingerprints, source failures, and session miss reasons', () => {
    const session = {
      runId: 'run-2',
      events: [
        {
          type: 'model_finished',
          payload: {
            usage: {
              prompt_tokens: 120,
              completion_tokens: 10,
              total_tokens: 130,
              prompt_cache: {
                cacheStatus: 'miss',
                cachedInputTokens: 0,
                cacheWriteInputTokens: 0,
                uncachedInputTokens: 120,
                turnContextFingerprint: 'turn-a',
                sourceErrors: [{ source: 'knowledge', code: 'unavailable' }],
              },
            },
          },
        },
        {
          type: 'model_finished',
          payload: {
            usage: {
              prompt_tokens: 140,
              completion_tokens: 12,
              total_tokens: 152,
              prompt_cache: {
                cacheStatus: 'miss',
                cachedInputTokens: 0,
                cacheWriteInputTokens: 0,
                uncachedInputTokens: 140,
                turnContextFingerprint: 'turn-b',
                conversionDiagnostics: ['context_conversion_unsupported'],
              },
            },
          },
        },
      ],
    } as unknown as AgentSession;

    const metrics = computeAgentRunMetrics([], [session]);

    expect(metrics.tokenUsage.perCallCacheObservations).toEqual([
      {
        turnContextFingerprint: 'turn-a',
        cachedInputTokens: 0,
        sourceErrors: [{ source: 'knowledge', code: 'unavailable' }],
      },
      {
        turnContextFingerprint: 'turn-b',
        cachedInputTokens: 0,
        conversionDiagnostics: ['context_conversion_unsupported'],
      },
    ]);
    expect(metrics.tokenUsage.sourceFailureCount).toBe(1);
    expect(metrics.tokenUsage.converterDropCount).toBe(1);
    expect(metrics.tokenUsage.sessionMissReasons).toMatchObject({
      turn_context_changed: 1,
      turn_context_source_failed: 1,
      context_conversion_unsupported: 1,
    });
  });
});
