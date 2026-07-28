import { describe, expect, it } from 'vitest';
import { buildContextPolicyFromChatConfig } from '../src/services/agents/AgentService.js';
import type { ModelContextProfile } from '../src/services/agents/context/ModelContextProfile.js';

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
