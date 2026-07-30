import type { AgentDefinition } from '../../../types/agent.js';
import type {
  AIProviderConfig,
  ProviderGovernanceConfig,
  ProviderModelCostConfig,
  SystemSettings
} from '../../../types/config.js';
import { createAIProvider, type AIProvider, type GeminiThinkingConfig } from '../../AIProvider.js';
import type { LocalStore } from '../../LocalStore.js';
import { LogService } from '../../LogService.js';
import type { AgentBudgetPolicy, AgentRunSpec } from '../engine/AgentRunSpec.js';
import {
  createProviderGovernanceProvider,
  type ProviderGovernanceCandidate,
  type ProviderGovernanceLedger
} from '../providerGovernance.js';

export type ProviderRuntimeOptions = {
  builtinSearch?: 'off' | 'full';
};

export type ResolvedAgentProvider = {
  provider: AIProvider;
  providerConfig?: AIProviderConfig;
  model?: string;
};

export type GovernanceProviderInput = ResolvedAgentProvider & {
  agentDef: AgentDefinition;
  runSpec: AgentRunSpec;
  budgetPolicy?: AgentBudgetPolicy;
  settings?: Partial<SystemSettings>;
  initialLedger?: Partial<ProviderGovernanceLedger>;
};

export class AgentGovernanceManager {
  constructor(
    private readonly store: LocalStore,
    private readonly aiProvider: AIProvider,
    private readonly proxyAgent?: any
  ) {}

  async resolveProviderForAgent(
    agentDef: AgentDefinition,
    silent?: boolean,
    settingsInput?: Partial<SystemSettings>,
    runtimeOptions?: ProviderRuntimeOptions,
  ): Promise<ResolvedAgentProvider> {
    const settings = settingsInput ?? await this.store.get('system_settings');
    const providers = settings?.AI_PROVIDERS || [];
    const providerId = String(agentDef.providerId || '').trim();
    const model = String(agentDef.model || '').trim();
    const providerConfig = providerId
      ? providers.find((p: AIProviderConfig) => p.id === providerId)
      : providers.find((p: AIProviderConfig) => p.id === settings?.ACTIVE_AI_PROVIDER_ID) || providers[0];

    if (!hasProviderOverride(agentDef) || !providerConfig) {
      return {
        provider: this.aiProvider,
        providerConfig,
        model: resolveLiveProviderModel(providerId, providerConfig, model)
      };
    }

    const dispatcher = providerConfig.useProxy === true ? this.proxyAgent : undefined;
    // Bound providerId → follow live models[0]; stale agent.model snapshots must not win.
    const selectedModel = resolveLiveProviderModel(providerId, providerConfig, model);
    if (!silent) {
      LogService.info(
        `Initializing AI provider ${providerConfig.id} for agent ${agentDef.name}. Using Proxy: ${!!dispatcher}`
      );
    }
    const reasoningEffort = resolveReasoningEffort(agentDef, providerConfig);
    const thinkingConfig =
      providerConfig.type === 'GEMINI' ? resolveGeminiThinkingConfig(agentDef) : undefined;
    return {
      provider:
        createAIProvider(
          {
            ...providerConfig,
            model: selectedModel,
            reasoningEffort,
            thinkingConfig,
            builtinSearch: runtimeOptions?.builtinSearch ?? 'off',
          },
          dispatcher
        ) || this.aiProvider,
      providerConfig,
      model: selectedModel
    };
  }

  createGovernedProvider(input: GovernanceProviderInput): AIProvider {
    const policy = this.mergeProviderGovernancePolicy(
      input.settings?.PROVIDER_GOVERNANCE,
      input.budgetPolicy?.providerGovernance
    );
    const primary = this.toGovernanceCandidate(input.provider, input.providerConfig, input.model, policy);
    const fallbacks = this.resolveGovernanceFallbacks(policy, input.settings, primary);
    return createProviderGovernanceProvider({
      primary,
      fallbacks,
      policy,
      budgetPolicy: input.budgetPolicy,
      runId: input.runSpec.runId,
      sessionId: input.runSpec.sessionId,
      initialLedger: input.initialLedger
    });
  }

  private mergeProviderGovernancePolicy(
    base?: ProviderGovernanceConfig,
    override?: ProviderGovernanceConfig
  ): ProviderGovernanceConfig | undefined {
    if (!base && !override) return undefined;
    return {
      ...(base || {}),
      ...(override || {}),
      retry: {
        ...(base?.retry || {}),
        ...(override?.retry || {})
      },
      health: {
        ...(base?.health || {}),
        ...(override?.health || {})
      },
      quotas: {
        ...(base?.quotas || {}),
        ...(override?.quotas || {})
      },
      models: {
        ...(base?.models || {}),
        ...(override?.models || {})
      },
      fallbacks: override?.fallbacks ?? base?.fallbacks
    };
  }

  private resolveGovernanceFallbacks(
    policy: ProviderGovernanceConfig | undefined,
    settings: Partial<SystemSettings> | undefined,
    primary: ProviderGovernanceCandidate
  ): ProviderGovernanceCandidate[] {
    if (!policy?.fallbacks?.length) return [];
    const providers = settings?.AI_PROVIDERS || [];
    return policy.fallbacks.flatMap((fallback) => {
      const providerConfig = fallback.providerId
        ? providers.find((provider) => provider.id === fallback.providerId)
        : primary.providerId
          ? providers.find((provider) => provider.id === primary.providerId)
          : undefined;
      if (!providerConfig) return [];
      const model = fallback.model || providerConfig.models?.[0];
      if (!model) return [];
      const dispatcher = providerConfig.useProxy === true ? this.proxyAgent : undefined;
      const provider = createAIProvider({ ...providerConfig, model }, dispatcher);
      if (!provider) return [];
      const candidate = this.toGovernanceCandidate(provider, providerConfig, model, policy);
      if (!this.hasRequiredCapabilities(candidate, fallback.requiredCapabilities)) return [];
      return [candidate];
    });
  }

  private toGovernanceCandidate(
    provider: AIProvider,
    providerConfig?: AIProviderConfig,
    model?: string,
    policy?: ProviderGovernanceConfig
  ): ProviderGovernanceCandidate {
    const selectedModel = model || providerConfig?.models?.[0];
    return {
      provider,
      providerId: providerConfig?.id,
      providerName: providerConfig?.name ?? provider.name,
      model: selectedModel,
      capabilities: this.resolveModelCapabilities(providerConfig, selectedModel, policy),
      cost: this.resolveModelCost(providerConfig, selectedModel, policy)
    };
  }

  private resolveModelCapabilities(
    providerConfig?: AIProviderConfig,
    model?: string,
    policy?: ProviderGovernanceConfig
  ): string[] | undefined {
    if (!model) return undefined;
    return policy?.models?.[model]?.capabilities ?? providerConfig?.modelCapabilities?.[model];
  }

  private resolveModelCost(
    providerConfig?: AIProviderConfig,
    model?: string,
    policy?: ProviderGovernanceConfig
  ): ProviderModelCostConfig | undefined {
    if (!model) return undefined;
    return policy?.models?.[model]?.cost ?? providerConfig?.modelCosts?.[model];
  }

  private hasRequiredCapabilities(
    candidate: ProviderGovernanceCandidate,
    required?: string[]
  ): boolean {
    if (!required?.length) return true;
    const capabilities = new Set(candidate.capabilities || []);
    return required.every((capability) => capabilities.has(capability));
  }
}

function hasProviderOverride(agentDef: AgentDefinition): boolean {
  return Boolean(String(agentDef.providerId || '').trim() || String(agentDef.model || '').trim());
}

/** Prefer live provider primary model when agent is bound to a provider config id. */
export function resolveLiveProviderModel(
  providerId: string,
  providerConfig: AIProviderConfig | undefined,
  agentModel?: string
): string | undefined {
  const livePrimary =
    String(providerConfig?.models?.[0] || '').trim() ||
    String((providerConfig as AIProviderConfig & { model?: string } | undefined)?.model || '').trim();
  const snapshot = String(agentModel || '').trim();
  if (providerId && livePrimary) return livePrimary;
  return snapshot || livePrimary || undefined;
}

/** Apply resolved API model onto a per-run agentDef copy so downstream reads stay consistent. */
export function withResolvedProviderModel(
  agentDef: AgentDefinition,
  resolvedModel?: string
): AgentDefinition {
  const model = String(resolvedModel || '').trim();
  if (!model || model === agentDef.model) return agentDef;
  return { ...agentDef, model };
}

function hasAgentConsoleChatConfig(agentDef: AgentDefinition): boolean {
  const consoleMeta = agentDef.metadata?.agentConsole;
  if (!consoleMeta || typeof consoleMeta !== 'object') return false;
  const chatConfig = (consoleMeta as Record<string, unknown>).chatConfig;
  return Boolean(chatConfig && typeof chatConfig === 'object');
}

function isAgentConsoleReasoningRequested(agentDef: AgentDefinition): boolean {
  const consoleMeta = agentDef.metadata?.agentConsole;
  if (!consoleMeta || typeof consoleMeta !== 'object') return false;

  const chatConfig = (consoleMeta as Record<string, unknown>).chatConfig;
  if (!chatConfig || typeof chatConfig !== 'object') return false;

  const cfg = chatConfig as Record<string, unknown>;
  if (cfg.thinking === 'disabled') return false;

  return (
    cfg.enableReasoning === true ||
    cfg.enableReasoningEffort === true ||
    cfg.thinking === 'enabled'
  );
}

function resolveReasoningEffort(
  agentDef: AgentDefinition,
  providerConfig?: AIProviderConfig
): string | undefined {
  const fromAgent = resolveReasoningEffortFromAgent(agentDef);
  if (fromAgent) return fromAgent;
  // Console chatConfig present → user toggles are authoritative; do not inherit provider effort.
  if (hasAgentConsoleChatConfig(agentDef)) return undefined;
  const providerEffort = providerConfig?.reasoningEffort;
  if (providerEffort && providerEffort !== 'none') return providerEffort;
  return undefined;
}

function resolveReasoningEffortFromAgent(agentDef: AgentDefinition): string | undefined {
  const consoleMeta = agentDef.metadata?.agentConsole;
  if (!consoleMeta || typeof consoleMeta !== 'object') return undefined;

  const chatConfig = (consoleMeta as Record<string, unknown>).chatConfig;
  const params = (consoleMeta as Record<string, unknown>).params;
  if (!chatConfig || typeof chatConfig !== 'object') return undefined;

  const cfg = chatConfig as Record<string, unknown>;
  const thinking = cfg.thinking;
  if (thinking === 'disabled') return undefined;

  const enableReasoningEffort = cfg.enableReasoningEffort === true;
  const enableReasoning = cfg.enableReasoning === true;
  const thinkingEnabled = cfg.thinking === 'enabled';
  if (!enableReasoningEffort && !enableReasoning && !thinkingEnabled) return undefined;

  const effort =
    params && typeof params === 'object'
      ? (params as Record<string, unknown>).reasoning_effort
      : undefined;
  return typeof effort === 'string' && effort.trim() ? effort : 'medium';
}

function resolveGeminiThinkingConfig(agentDef: AgentDefinition): GeminiThinkingConfig | undefined {
  const consoleMeta = agentDef.metadata?.agentConsole;
  if (!consoleMeta || typeof consoleMeta !== 'object') return undefined;

  const chatConfig = (consoleMeta as Record<string, unknown>).chatConfig;
  if (!chatConfig || typeof chatConfig !== 'object') return undefined;

  const cfg = chatConfig as Record<string, unknown>;
  const thinking = cfg.thinking;
  const enableReasoning =
    cfg.enableReasoning === true || cfg.enableReasoningEffort === true;
  const budget = 32000;

  if (thinking === 'disabled') return undefined;
  if (thinking === 'enabled' || enableReasoning) {
    return { includeThoughts: true, thinkingBudget: budget };
  }

  if (!isAgentConsoleReasoningRequested(agentDef)) return undefined;

  const model = String(agentDef.model || '').toLowerCase();
  if (thinking === 'auto' || thinking == null) {
    if (
      model.includes('thinking') ||
      model.includes('2.5') ||
      model.includes('gemini') ||
      model.includes('glm')
    ) {
      return { includeThoughts: true, thinkingBudget: budget };
    }
  }

  return undefined;
}

export { resolveReasoningEffort, resolveGeminiThinkingConfig };