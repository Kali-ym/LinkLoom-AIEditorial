import { describe, expect, it, vi } from 'vitest';
import {
  AgentGovernanceManager,
  resolveLiveProviderModel,
  withResolvedProviderModel
} from '../src/services/agents/managers/AgentGovernanceManager.js';
import type { AgentDefinition } from '../src/types/agent.js';
import type { AIProviderConfig } from '../src/types/config.js';
import type { AIProvider } from '../src/services/AIProvider.js';

function createAgent(overrides: Partial<AgentDefinition> = {}): AgentDefinition {
  return {
    id: 'agent-1',
    name: 'Test Agent',
    description: 'test',
    systemPrompt: 'You are a test agent.',
    providerId: 'prov-openai',
    model: 'gpt-5.6-luna',
    temperature: 0,
    toolIds: [],
    skillIds: [],
    mcpServerIds: [],
    ...overrides
  };
}

function createProviderConfig(overrides: Partial<AIProviderConfig> = {}): AIProviderConfig {
  return {
    id: 'prov-openai',
    type: 'OPENAI',
    name: 'GPT 5.6 Luna',
    apiUrl: 'https://example.test/v1',
    apiKey: 'test-key',
    models: ['gpt-5.6-terra'],
    ...overrides
  } as AIProviderConfig;
}

describe('resolveLiveProviderModel', () => {
  it('prefers live models[0] when providerId is bound', () => {
    const config = createProviderConfig({ models: ['gpt-5.6-terra'] });
    expect(resolveLiveProviderModel('prov-openai', config, 'gpt-5.6-luna')).toBe('gpt-5.6-terra');
  });

  it('falls back to agent model when no providerId', () => {
    const config = createProviderConfig({ models: ['gpt-5.6-terra'] });
    expect(resolveLiveProviderModel('', config, 'gpt-5.6-luna')).toBe('gpt-5.6-luna');
  });

  it('falls back to agent model when provider has empty models', () => {
    const config = createProviderConfig({ models: [] });
    expect(resolveLiveProviderModel('prov-openai', config, 'gpt-5.6-luna')).toBe('gpt-5.6-luna');
  });
});

describe('withResolvedProviderModel', () => {
  it('returns a copy with resolved model when different', () => {
    const agent = createAgent({ model: 'gpt-5.6-luna' });
    const next = withResolvedProviderModel(agent, 'gpt-5.6-terra');
    expect(next).not.toBe(agent);
    expect(next.model).toBe('gpt-5.6-terra');
    expect(agent.model).toBe('gpt-5.6-luna');
  });

  it('returns same reference when model unchanged', () => {
    const agent = createAgent({ model: 'gpt-5.6-terra' });
    expect(withResolvedProviderModel(agent, 'gpt-5.6-terra')).toBe(agent);
  });
});

describe('AgentGovernanceManager.resolveProviderForAgent', () => {
  it('uses live provider models[0] over stale agent.model snapshot', async () => {
    const providerConfig = createProviderConfig({ models: ['gpt-5.6-terra'] });
    const store = {
      get: vi.fn().mockResolvedValue({
        AI_PROVIDERS: [providerConfig],
        ACTIVE_AI_PROVIDER_ID: providerConfig.id
      })
    };
    const globalProvider = { name: 'global' } as AIProvider;
    const manager = new AgentGovernanceManager(store as any, globalProvider);

    const resolved = await manager.resolveProviderForAgent(
      createAgent({ providerId: providerConfig.id, model: 'gpt-5.6-luna' }),
      true
    );

    expect(resolved.model).toBe('gpt-5.6-terra');
    expect(resolved.provider).not.toBe(globalProvider);
    expect(resolved.providerConfig?.id).toBe(providerConfig.id);
  });

  it('keeps agent.model when providerId is absent', async () => {
    const providerConfig = createProviderConfig({
      id: 'active-prov',
      models: ['active-model']
    });
    const store = {
      get: vi.fn().mockResolvedValue({
        AI_PROVIDERS: [providerConfig],
        ACTIVE_AI_PROVIDER_ID: providerConfig.id
      })
    };
    const globalProvider = { name: 'global' } as AIProvider;
    const manager = new AgentGovernanceManager(store as any, globalProvider);

    const resolved = await manager.resolveProviderForAgent(
      createAgent({ providerId: '', model: 'custom-snapshot' }),
      true
    );

    expect(resolved.model).toBe('custom-snapshot');
  });
});
