import { describe, expect, it, vi } from 'vitest';
import {
  buildContextPolicyFromChatConfig,
  buildRuntimeContextHooks,
} from '../src/services/agents/AgentService.js';
import type { ModelContextProfile } from '../src/services/agents/context/ModelContextProfile.js';
import { createTurnContext } from '../src/services/agents/context/PiContextTypes.js';

const profile: ModelContextProfile = {
  providerId: 'openai',
  modelId: 'gpt-4o',
  theoreticalMax: 128000,
  maxOutput: 16384,
  encoding: 'o200k_base',
  driftMultiplier: 1.1
};

describe('buildContextPolicyFromChatConfig', () => {
  it('maps enableContextCompression=false to none strategy', () => {
    const policy = buildContextPolicyFromChatConfig(
      { enableContextCompression: false, enableMaxContextWindow: false } as Record<string, unknown>,
      profile
    );
    expect(policy.compactionStrategy).toBe('none');
  });

  it('maps enableMaxContextWindow + maxContextWindow to maxInputTokens', () => {
    const policy = buildContextPolicyFromChatConfig(
      { enableContextCompression: true, enableMaxContextWindow: true, maxContextWindow: 50000 } as Record<string, unknown>,
      profile
    );
    expect(policy.maxInputTokens).toBe(50000);
    expect(policy.compactionStrategy).toBe('hybrid');
  });

  it('defaults maxInputTokens to model theoreticalMax when no override', () => {
    const policy = buildContextPolicyFromChatConfig(
      { enableContextCompression: true, enableMaxContextWindow: false } as Record<string, unknown>,
      profile
    );
    expect(policy.maxInputTokens).toBe(128000);
  });

  it('computes compactionBuffer as min(20000, 10% of window)', () => {
    const policy = buildContextPolicyFromChatConfig(
      { enableContextCompression: true, enableMaxContextWindow: true, maxContextWindow: 100000 } as Record<string, unknown>,
      profile
    );
    expect(policy.compactionBuffer).toBe(10000);
  });

  it('maps enableHistoryCount + historyCount to maxMessages', () => {
    const policy = buildContextPolicyFromChatConfig(
      { enableHistoryCount: true, historyCount: 50 } as Record<string, unknown>,
      profile
    );
    expect(policy.maxMessages).toBe(50);
  });

  it('defaults maxMessages to 30 when historyCount disabled', () => {
    const policy = buildContextPolicyFromChatConfig(
      { enableHistoryCount: false } as Record<string, unknown>,
      profile
    );
    expect(policy.maxMessages).toBe(30);
  });
});

describe('buildRuntimeContextHooks', () => {
  const turnContext = createTurnContext({
    turnId: 'turn-1',
    sources: [{ source: 'date', content: '当前处理日期为: 2026-08-01', trust: 'runtime_metadata' }],
    sourceErrors: [],
  });

  it('always passes turnContext to runtime even when contextPolicy is undefined', () => {
    const summarizer = vi.fn();
    const hooks = buildRuntimeContextHooks({
      runSpec: { runId: 'run-1', sessionId: 'session-1' },
      summarizer,
      turnContext,
    });

    expect(hooks).toEqual({
      runId: 'run-1',
      sessionId: 'session-1',
      summarizer,
      turnContext,
    });
    expect(hooks.policy).toBeUndefined();
  });

  it('includes policy when contextPolicy is configured', () => {
    const policy = buildContextPolicyFromChatConfig(
      { enableContextCompression: true, enableMaxContextWindow: false } as Record<string, unknown>,
      profile,
    );

    const hooks = buildRuntimeContextHooks({
      runSpec: { runId: 'run-2', sessionId: 'session-2', contextPolicy: policy },
      turnContext,
    });

    expect(hooks.policy).toBe(policy);
    expect(hooks.turnContext).toBe(turnContext);
  });
});
