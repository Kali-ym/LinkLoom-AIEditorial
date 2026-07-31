import { describe, expect, it } from 'vitest';
import { buildPromptCacheContract } from '../src/services/agents/engine/promptCacheContract.js';
import { resolvePromptCacheCapability } from '../src/services/agents/engine/promptCacheCapabilities.js';
import { applyMultiAgentPromptCachePolicy } from '../src/services/agents/engine/multiAgentPromptCache.js';

const openAiCapability = resolvePromptCacheCapability('OPENAI', 'chat');

describe('prompt cache contract', () => {
  it('resolves conservative provider capabilities', () => {
    expect(resolvePromptCacheCapability('OPENAI')).toMatchObject({
      supportsPromptCache: true,
      supportsCacheNamespace: true,
      reportsCacheRead: true
    });
    expect(resolvePromptCacheCapability('CLAUDE', 'messages')).toMatchObject({
      supportsPromptCache: true,
      supportsExplicitBreakpoint: true,
      reportsCacheWrite: true
    });
    expect(resolvePromptCacheCapability('GEMINI')).toMatchObject({
      supportsPromptCache: false,
      family: 'unsupported'
    });
    expect(resolvePromptCacheCapability('gateway-x')).toMatchObject({
      supportsPromptCache: false,
      family: 'unknown'
    });
  });

  it('creates a global namespace independent of session id', () => {
    const first = buildPromptCacheContract({
      providerId: 'OPENAI',
      model: 'gpt-5',
      endpoint: 'chat',
      stablePrefix: 'stable prompt',
      variantParts: ['base-agent-v1'],
      toolset: [{ name: 'search' }],
      capability: openAiCapability,
      sessionId: 'session-a'
    });
    const second = buildPromptCacheContract({
      providerId: 'OPENAI',
      model: 'gpt-5',
      endpoint: 'chat',
      stablePrefix: 'stable prompt',
      variantParts: ['base-agent-v1'],
      toolset: [{ name: 'search' }],
      capability: openAiCapability,
      sessionId: 'session-b'
    });

    expect(first.cacheEligibility).toBe(true);
    expect(first.cacheScope).toBe('global');
    expect(first.cacheNamespace).toBe(second.cacheNamespace);
    expect(first.stablePrefixHash).toBe(second.stablePrefixHash);
  });

  it('supports shadow and disabled governance modes', () => {
    const shadow = buildPromptCacheContract({
      providerId: 'OPENAI',
      model: 'gpt-5',
      stablePrefix: 'stable prompt',
      capability: openAiCapability,
      cacheMode: 'shadow'
    });
    const disabled = buildPromptCacheContract({
      providerId: 'OPENAI',
      model: 'gpt-5',
      stablePrefix: 'stable prompt',
      capability: openAiCapability,
      cacheMode: 'disabled',
      cacheRequested: false
    });

    expect(shadow.cacheMode).toBe('shadow');
    expect(shadow.cacheEligibility).toBe(true);
    expect(disabled.cacheMode).toBe('disabled');
    expect(disabled.cacheEligibility).toBe(false);
    expect(disabled.cacheDisableReason).toContain('cache_disabled');
  });

  it('changes the variant when the toolset changes', () => {
    const first = buildPromptCacheContract({
      providerId: 'OPENAI',
      model: 'gpt-5',
      stablePrefix: 'stable prompt',
      toolset: [{ name: 'search' }],
      capability: openAiCapability
    });
    const second = buildPromptCacheContract({
      providerId: 'OPENAI',
      model: 'gpt-5',
      stablePrefix: 'stable prompt',
      toolset: [{ name: 'write' }],
      capability: openAiCapability
    });

    expect(first.stablePrefixHash).toBe(second.stablePrefixHash);
    expect(first.toolsetHash).not.toBe(second.toolsetHash);
    expect(first.variantHash).not.toBe(second.variantHash);
    expect(first.cacheNamespace).not.toBe(second.cacheNamespace);
  });

  it('changes the namespace when the stable prefix changes', () => {
    const first = buildPromptCacheContract({
      providerId: 'OPENAI',
      model: 'gpt-5',
      stablePrefix: 'stable prompt v1',
      capability: openAiCapability
    });
    const second = buildPromptCacheContract({
      providerId: 'OPENAI',
      model: 'gpt-5',
      stablePrefix: 'stable prompt v2',
      capability: openAiCapability
    });

    expect(first.stablePrefixHash).not.toBe(second.stablePrefixHash);
    expect(first.cacheNamespace).not.toBe(second.cacheNamespace);
  });

  it('disables eligibility for unsupported providers', () => {
    const contract = buildPromptCacheContract({
      providerId: 'GEMINI',
      model: 'gemini-2.5',
      stablePrefix: 'stable prompt',
      capability: resolvePromptCacheCapability('GEMINI')
    });

    expect(contract.cacheEligibility).toBe(false);
    expect(contract.cacheDisableReason).toContain('provider adapter');
  });

  it('requires a session for sensitive stable prefixes', () => {
    const withoutSession = buildPromptCacheContract({
      providerId: 'OPENAI',
      model: 'gpt-5',
      stablePrefix: 'tenant-specific prompt',
      sensitiveStablePrefix: true,
      capability: openAiCapability
    });
    const withSession = buildPromptCacheContract({
      providerId: 'OPENAI',
      model: 'gpt-5',
      stablePrefix: 'tenant-specific prompt',
      sensitiveStablePrefix: true,
      sessionId: 'session-a',
      capability: openAiCapability
    });

    expect(withoutSession.cacheEligibility).toBe(false);
    expect(withoutSession.cacheScope).toBe('session');
    expect(withSession.cacheEligibility).toBe(true);
    expect(withSession.cacheNamespace).toContain('session:session-a');
  });

  it('enforces explicit multi-agent cache policies', () => {
    const parent = buildPromptCacheContract({
      providerId: 'OPENAI',
      model: 'gpt-5',
      stablePrefix: 'shared base',
      toolset: [{ name: 'search' }],
      capability: openAiCapability
    });
    const compatibleChild = buildPromptCacheContract({
      providerId: 'OPENAI',
      model: 'gpt-5',
      stablePrefix: 'shared base',
      toolset: [{ name: 'search' }],
      capability: openAiCapability
    });
    const differentChild = buildPromptCacheContract({
      providerId: 'OPENAI',
      model: 'gpt-5',
      stablePrefix: 'different base',
      toolset: [{ name: 'search' }],
      capability: openAiCapability
    });

    const isolated = applyMultiAgentPromptCachePolicy(compatibleChild, 'isolated', parent);
    const derived = applyMultiAgentPromptCachePolicy(compatibleChild, 'derived', parent);
    const inherited = applyMultiAgentPromptCachePolicy(compatibleChild, 'inherit', parent);
    const rejected = applyMultiAgentPromptCachePolicy(differentChild, 'inherit', parent);

    expect(isolated.cacheNamespace).toBe(compatibleChild.cacheNamespace);
    expect(derived.cacheNamespace).toContain(`${parent.cacheNamespace}:derived:`);
    expect(inherited.cacheNamespace).toBe(parent.cacheNamespace);
    expect(rejected.cacheEligibility).toBe(false);
    expect(rejected.cacheDisableReason).toContain('parent_cache_contract_mismatch');
  });
});
