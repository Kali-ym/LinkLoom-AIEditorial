import { describe, expect, it, vi } from 'vitest';
import { ToolRegistry } from '../src/registries/ToolRegistry.js';
import { BaseTool } from '../src/plugins/base/BaseTool.js';
import { AgentService } from '../src/services/agents/AgentService.js';
import {
  createProviderGovernanceHealthStore,
  createProviderGovernanceProvider,
  isProviderGovernanceBudgetError,
  providerGovernanceBudgetErrorToUsage
} from '../src/services/agents/providerGovernance.js';
import type { AIProvider } from '../src/services/AIProvider.js';
import type { AgentDefinition } from '../src/types/agent.js';

class GovernanceSaveTool extends BaseTool {
  readonly id = 'save_governance_state';
  readonly name = 'save_governance_state';
  readonly description = 'Writes a value for provider governance resume tests';
  readonly parameters = {
    type: 'object',
    properties: {
      text: { type: 'string' }
    },
    required: ['text']
  };

  async handler(args: { text?: string }) {
    return { saved: args.text || '' };
  }
}

function createProvider(name: string, generateContent: AIProvider['generateContent']): AIProvider {
  return { name, generateContent };
}

function createAgent(overrides: Partial<AgentDefinition> = {}): AgentDefinition {
  return {
    id: 'governance-agent',
    name: 'Governance Agent',
    description: 'provider governance test agent',
    systemPrompt: 'You are a provider governance test agent.',
    providerId: '',
    model: 'governance-model',
    temperature: 0,
    toolIds: [],
    skillIds: [],
    mcpServerIds: [],
    runtime: {
      mode: 'react',
      maxRounds: 3,
      returnTrace: true
    },
    ...overrides
  };
}

function createStore(agent: AgentDefinition, settings: Record<string, unknown> = {}) {
  const values = new Map<string, unknown>();
  const systemSettings = {
    AI_PROVIDERS: [],
    CLOSED_PLUGINS: [],
    PROVIDER_GOVERNANCE: { enabled: true },
    ...settings
  };
  return {
    getAgent: vi.fn().mockResolvedValue(agent),
    get: vi.fn(async (key: string) => (key === 'system_settings' ? systemSettings : values.get(key))),
    put: vi.fn(async (key: string, value: unknown) => {
      values.set(key, value);
    }),
    getMCPConfig: vi.fn().mockResolvedValue(undefined)
  };
}

function createService(agent: AgentDefinition, provider: AIProvider, settings?: Record<string, unknown>) {
  ToolRegistry.getInstance().registerTool(new GovernanceSaveTool());
  return new AgentService(
    createStore(agent, settings) as any,
    provider,
    { buildSkillsPrompt: vi.fn().mockResolvedValue('') } as any,
    { getTools: vi.fn().mockResolvedValue([]), callTool: vi.fn() } as any
  );
}

describe('Provider Governance', () => {
  it('falls back after primary failure and keeps health/attempt metadata', async () => {
    const primaryGenerate = vi.fn(async () => {
      throw new Error('primary unavailable');
    });
    const fallbackGenerate = vi.fn(async () => ({
      content: 'fallback answer',
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
    }));
    const governed = createProviderGovernanceProvider({
      primary: {
        provider: createProvider('primary-provider', primaryGenerate),
        providerId: 'primary',
        model: 'primary-model'
      },
      fallbacks: [
        {
          provider: createProvider('fallback-provider', fallbackGenerate),
          providerId: 'fallback',
          model: 'fallback-model'
        }
      ],
      policy: {
        enabled: true,
        health: { failureThreshold: 1, cooldownMs: 60_000 }
      },
      budgetPolicy: { maxModelCalls: 3 },
      runId: 'run-fallback',
      sessionId: 'session-fallback'
    });

    const first = await governed.generateContent([{ role: 'user', content: 'hello' }], []);
    const firstGovernance = first.usage?.governance as any;
    const second = await governed.generateContent([{ role: 'user', content: 'hello again' }], []);
    const secondGovernance = second.usage?.governance as any;

    expect(first.content).toBe('fallback answer');
    expect(firstGovernance).toMatchObject({
      runId: 'run-fallback',
      sessionId: 'session-fallback',
      selectedProviderId: 'fallback',
      selectedModel: 'fallback-model',
      fallbackUsed: true,
      retryCount: 1
    });
    expect(firstGovernance.attempts.map((attempt: any) => attempt.status)).toEqual(['error', 'ok']);
    expect(firstGovernance.health).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'primary:primary-model', failures: 1 })
      ])
    );
    expect(secondGovernance.attempts.map((attempt: any) => attempt.providerId)).toEqual(['fallback']);
    expect(primaryGenerate).toHaveBeenCalledTimes(1);
    expect(fallbackGenerate).toHaveBeenCalledTimes(2);
  });

  it('retries a transient provider failure before using fallback', async () => {
    let calls = 0;
    const primaryGenerate = vi.fn(async () => {
      calls += 1;
      if (calls === 1) throw new Error('transient');
      return { content: 'primary recovered', usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 } };
    });
    const fallbackGenerate = vi.fn(async () => ({ content: 'fallback' }));
    const governed = createProviderGovernanceProvider({
      primary: {
        provider: createProvider('primary-provider', primaryGenerate),
        providerId: 'primary',
        model: 'primary-model'
      },
      fallbacks: [
        {
          provider: createProvider('fallback-provider', fallbackGenerate),
          providerId: 'fallback',
          model: 'fallback-model'
        }
      ],
      policy: { enabled: true, retry: { maxAttempts: 2, backoffMs: 0 } },
      healthStore: createProviderGovernanceHealthStore(),
      budgetPolicy: { maxModelCalls: 2 }
    });

    const result = await governed.generateContent([{ role: 'user', content: 'hello' }], []);
    const governance = result.usage?.governance as any;

    expect(result.content).toBe('primary recovered');
    expect(governance).toMatchObject({ selectedProviderId: 'primary', fallbackUsed: false, retryCount: 1 });
    expect(governance.attempts.map((attempt: any) => attempt.status)).toEqual(['error', 'ok']);
    expect(primaryGenerate).toHaveBeenCalledTimes(2);
    expect(fallbackGenerate).not.toHaveBeenCalled();
  });

  it('rejects over-budget model calls before provider invocation', async () => {
    const generate = vi.fn(async () => ({ content: 'should not run' }));
    const governed = createProviderGovernanceProvider({
      primary: {
        provider: createProvider('budget-provider', generate),
        providerId: 'budget',
        model: 'budget-model'
      },
      policy: { enabled: true },
      budgetPolicy: { maxModelCalls: 0 }
    });

    let caught: unknown;
    try {
      await governed.generateContent([{ role: 'user', content: 'hello' }], []);
    } catch (error) {
      caught = error;
    }

    expect(isProviderGovernanceBudgetError(caught)).toBe(true);
    expect(providerGovernanceBudgetErrorToUsage(caught as any).governance).toMatchObject({
      budget: {
        cumulative: { modelCalls: 0 },
        exceeded: ['max_model_calls']
      }
    });
    expect(generate).not.toHaveBeenCalled();
  });

  it('normalizes usage and estimates per-model cost', async () => {
    const governed = createProviderGovernanceProvider({
      primary: {
        provider: createProvider('cost-provider', async () => ({
          content: 'costed answer',
          usage: { prompt_tokens: 1000, completion_tokens: 500, total_tokens: 1500 }
        })),
        providerId: 'cost',
        model: 'cost-model',
        cost: { inputUsdPer1M: 2, outputUsdPer1M: 4 }
      },
      policy: { enabled: true },
      budgetPolicy: { maxCostUsd: 1 }
    });

    const result = await governed.generateContent([{ role: 'user', content: 'hello' }], []);

    expect(result.usage).toMatchObject({
      prompt_tokens: 1000,
      completion_tokens: 500,
      total_tokens: 1500,
      estimated_cost_usd: 0.004,
      cost: { input_usd: 0.002, output_usd: 0.002, total_usd: 0.004 }
    });
    expect((result.usage?.governance as any).budget.cumulative).toMatchObject({
      modelCalls: 1,
      promptTokens: 1000,
      completionTokens: 500,
      totalTokens: 1500,
      estimatedCostUsd: 0.004
    });
  });

  it('uses cached input pricing when the provider reports cache usage', async () => {
    const governed = createProviderGovernanceProvider({
      primary: {
        provider: createProvider('cache-cost-provider', async () => ({
          content: 'cached answer',
          usage: {
            prompt_tokens: 1000,
            completion_tokens: 500,
            total_tokens: 1500,
            prompt_cache: {
              cacheStatus: 'hit',
              cachedInputTokens: 800,
              cacheWriteInputTokens: 0,
              uncachedInputTokens: 200,
              requested: true
            }
          }
        })),
        providerId: 'cache-cost',
        model: 'cache-cost-model',
        cost: {
          inputUsdPer1M: 2,
          cachedInputUsdPer1M: 0.5,
          outputUsdPer1M: 4
        }
      },
      policy: { enabled: true }
    });

    const result = await governed.generateContent([{ role: 'user', content: 'hello' }], []);

    expect(result.usage).toMatchObject({
      estimated_cost_usd: 0.0028,
      cost: { input_usd: 0.0008, output_usd: 0.002, total_usd: 0.0028 },
      prompt_cache: { estimatedCacheSavingsUsd: 0.0012 }
    });
  });

  it('wraps temporary external providers for budget governance', async () => {
    const externalProvider = createProvider('external-provider', vi.fn(async () => ({ content: 'nope' })));
    const service = createService(createAgent(), createProvider('default-provider', async () => ({ content: 'default' })));

    const result = await service.runTemporaryAgent({
      agentDef: createAgent({ runtime: { mode: 'classic', maxRounds: 1, returnTrace: true } }),
      messages: [{ role: 'user', content: 'hello' }],
      tools: [],
      provider: externalProvider,
      budgetPolicy: { maxModelCalls: 0 },
      silent: true
    });

    expect(result.stopReason).toBe('budget_exceeded');
    expect(externalProvider.generateContent).not.toHaveBeenCalled();
    expect(result.trace?.rounds[0].budget).toMatchObject({
      modelCalls: 0,
      exceeded: ['max_model_calls']
    });
  });

  it('inherits provider governance ledger when resuming permission-paused runs', async () => {
    const provider = createProvider('resume-provider', vi.fn(async () => ({
      content: '',
      tool_calls: [
        { id: 'call-save', name: 'save_governance_state', arguments: { text: 'approved' } }
      ],
      usage: { prompt_tokens: 4, completion_tokens: 2, total_tokens: 6 }
    })));
    const service = createService(
      createAgent({ toolIds: ['save_governance_state'] }),
      provider
    );
    let runId = '';

    const paused = await service.runAgent('governance-agent', 'run gated tool', undefined, {
      silent: true,
      budgetPolicy: {
        maxModelCalls: 1,
        providerGovernance: { enabled: true }
      },
      onRunCreated: (spec) => {
        runId = spec.runId;
      }
    });
    const pendingHitl = await service.getRunHitl(runId);

    expect(paused.stopReason).toBe('permission_required');
    expect(provider.generateContent).toHaveBeenCalledTimes(1);
    expect(pendingHitl?.permissionId).toBeTruthy();

    const resumed = await service.resolveRunPermission({
      runId,
      permissionId: pendingHitl!.permissionId!,
      effect: 'allow',
      reason: 'approved by test',
      resolvedBy: 'human'
    });

    expect(resumed.stopReason).toBe('budget_exceeded');
    expect(provider.generateContent).toHaveBeenCalledTimes(1);
    expect((resumed.trace as any).rounds.at(-1).budget).toMatchObject({
      modelCalls: 1,
      inputTokens: 4,
      outputTokens: 2,
      estimatedCostUsd: 0,
      exceeded: ['max_model_calls']
    });
  });


  it('disables prompt cache key reuse when falling back to a mismatched provider/model', async () => {
    const { adaptCallOptionsForCandidate, collectFallbackCacheMismatchReasons } = await import(
      '../src/services/agents/providerGovernance.js'
    );

    const primary = {
      provider: createProvider('primary', vi.fn()),
      providerId: 'OPENAI',
      model: 'gpt-5'
    };
    const fallback = {
      provider: createProvider('fallback', vi.fn()),
      providerId: 'OPENAI-BACKUP',
      model: 'gpt-4.1'
    };

    expect(
      collectFallbackCacheMismatchReasons(
        { providerId: 'OPENAI', model: 'gpt-5', endpoint: 'chat_completions' },
        fallback
      )
    ).toEqual(expect.arrayContaining(['fallback_provider_mismatch', 'fallback_model_mismatch']));

    const adapted = adaptCallOptionsForCandidate(
      {
        responseCache: {
          enableStore: true,
          cacheKey: 'session-key',
          providerId: 'OPENAI',
          model: 'gpt-5',
          endpoint: 'chat_completions'
        }
      },
      fallback,
      primary
    );

    expect(adapted?.responseCache?.cacheKey).toBeUndefined();
    expect(adapted?.responseCache?.enableStore).toBe(false);
    expect(adapted?.responseCache?.cacheDisableReason).toContain('fallback_provider_mismatch');
  });

  it('keeps prompt cache when fallback candidate matches the cache contract identity', async () => {
    const { adaptCallOptionsForCandidate } = await import(
      '../src/services/agents/providerGovernance.js'
    );

    const primary = {
      provider: createProvider('primary', vi.fn()),
      providerId: 'OPENAI',
      model: 'gpt-5'
    };
    const sameIdentityFallback = {
      provider: createProvider('fallback-same', vi.fn()),
      providerId: 'OPENAI',
      model: 'gpt-5'
    };

    const adapted = adaptCallOptionsForCandidate(
      {
        responseCache: {
          enableStore: true,
          cacheKey: 'session-key',
          providerId: 'OPENAI',
          model: 'gpt-5'
        }
      },
      sameIdentityFallback,
      primary
    );

    expect(adapted?.responseCache?.cacheKey).toBe('session-key');
    expect(adapted?.responseCache?.enableStore).toBe(true);
  });

});
