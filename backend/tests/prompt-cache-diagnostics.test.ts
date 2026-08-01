import { describe, expect, it } from 'vitest';
import {
  PROMPT_CACHE_MISS_NOISE_FLOOR_TOKENS,
  PROMPT_CACHE_TTL_MS,
  advancePromptCacheObservationBaseline,
  diagnosePromptCacheMiss,
  scanPromptCacheSessionDiagnostics
} from '../src/services/agents/engine/promptCacheDiagnostics.js';

describe('prompt cache diagnostics', () => {
  it('ignores the first call and providers that never report cache activity', () => {
    expect(
      diagnosePromptCacheMiss(undefined, {
        promptTokens: 4000,
        cachedInputTokens: 0,
        cacheWriteInputTokens: 0
      })
    ).toBeUndefined();

    const baseline = advancePromptCacheObservationBaseline(undefined, {
      promptTokens: 4000,
      cachedInputTokens: 0,
      cacheWriteInputTokens: 0,
      model: 'gpt-5',
      providerId: 'OPENAI',
      timestampMs: 1_000
    });

    expect(
      diagnosePromptCacheMiss(baseline, {
        promptTokens: 4500,
        cachedInputTokens: 0,
        cacheWriteInputTokens: 0,
        model: 'gpt-5',
        providerId: 'OPENAI',
        timestampMs: 2_000
      })
    ).toBeUndefined();
  });

  it('detects a significant miss after prior cache activity', () => {
    const baseline = advancePromptCacheObservationBaseline(undefined, {
      promptTokens: 8000,
      cachedInputTokens: 7000,
      cacheWriteInputTokens: 0,
      model: 'gpt-5',
      providerId: 'OPENAI',
      endpoint: 'chat_completions',
      timestampMs: 1_000
    });

    const miss = diagnosePromptCacheMiss(baseline, {
      promptTokens: 8500,
      cachedInputTokens: 0,
      cacheWriteInputTokens: 0,
      model: 'gpt-5',
      providerId: 'OPENAI',
      endpoint: 'chat_completions',
      timestampMs: 1_000 + PROMPT_CACHE_TTL_MS + 1
    });

    expect(miss?.missedTokens).toBeGreaterThan(PROMPT_CACHE_MISS_NOISE_FLOOR_TOKENS);
    expect(miss?.reason).toBe('idle_ttl_exceeded');
  });

  it('resets the baseline after compaction and does not count the next call as a miss', () => {
    const result = scanPromptCacheSessionDiagnostics([
      {
        promptTokens: 8000,
        cachedInputTokens: 7000,
        cacheWriteInputTokens: 0,
        model: 'gpt-5',
        providerId: 'OPENAI',
        timestampMs: 1_000
      },
      {
        promptTokens: 2000,
        cachedInputTokens: 0,
        cacheWriteInputTokens: 0,
        model: 'gpt-5',
        providerId: 'OPENAI',
        timestampMs: 2_000,
        afterCompaction: true
      },
      {
        promptTokens: 2500,
        cachedInputTokens: 0,
        cacheWriteInputTokens: 500,
        model: 'gpt-5',
        providerId: 'OPENAI',
        timestampMs: 3_000
      }
    ]);

    expect(result.missCount).toBe(0);
  });

  it('attributes model and endpoint changes in miss reasons', () => {
    const baseline = advancePromptCacheObservationBaseline(undefined, {
      promptTokens: 8000,
      cachedInputTokens: 7000,
      cacheWriteInputTokens: 0,
      model: 'gpt-5',
      providerId: 'OPENAI',
      endpoint: 'chat_completions',
      timestampMs: 1_000
    });

    expect(
      diagnosePromptCacheMiss(baseline, {
        promptTokens: 8200,
        cachedInputTokens: 0,
        cacheWriteInputTokens: 0,
        model: 'gpt-5.1',
        providerId: 'OPENAI',
        endpoint: 'chat_completions',
        timestampMs: 2_000
      })?.reason
    ).toBe('model_changed');

    expect(
      diagnosePromptCacheMiss(baseline, {
        promptTokens: 8200,
        cachedInputTokens: 0,
        cacheWriteInputTokens: 0,
        model: 'gpt-5',
        providerId: 'OPENAI',
        endpoint: 'responses',
        timestampMs: 2_000
      })?.reason
    ).toBe('endpoint_changed');
  });

  it('records turn_context_changed when dynamic fingerprint changes', () => {
    const result = scanPromptCacheSessionDiagnostics([
      {
        promptTokens: 4000,
        cachedInputTokens: 3000,
        cacheWriteInputTokens: 0,
        turnContextFingerprint: 'turn-a',
        timestampMs: 1_000,
      },
      {
        promptTokens: 4200,
        cachedInputTokens: 0,
        cacheWriteInputTokens: 0,
        turnContextFingerprint: 'turn-b',
        timestampMs: 2_000,
      },
    ]);

    expect(result.sessionMissReasons).toContain('turn_context_changed');
  });

  it('records turn_context_source_failed and context_conversion_unsupported', () => {
    const result = scanPromptCacheSessionDiagnostics([
      {
        promptTokens: 4000,
        cachedInputTokens: 0,
        cacheWriteInputTokens: 0,
        sourceErrors: [{ source: 'knowledge', code: 'unavailable' }],
        conversionDiagnostics: ['context_conversion_unsupported'],
      },
    ]);

    expect(result.sessionMissReasons).toEqual(
      expect.arrayContaining(['turn_context_source_failed', 'context_conversion_unsupported']),
    );
  });
});
