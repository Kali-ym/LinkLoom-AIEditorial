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
});
