export type PromptCacheProviderFamily =
  | 'openai-compatible'
  | 'anthropic-messages'
  | 'unsupported'
  | 'unknown';

export interface PromptCacheCapability {
  family: PromptCacheProviderFamily;
  supportsPromptCache: boolean;
  supportsExplicitBreakpoint: boolean;
  supportsCacheNamespace: boolean;
  reportsCacheRead: boolean;
  reportsCacheWrite: boolean;
  reason?: string;
}

const OPENAI_COMPATIBLE_PROVIDER_IDS = new Set(['OPENAI', 'GLM', 'DEEPSEEK']);

export function resolvePromptCacheCapability(
  providerId: string,
  endpoint?: string
): PromptCacheCapability {
  const normalizedProviderId = providerId.trim().toUpperCase();
  const normalizedEndpoint = endpoint?.trim().toLowerCase();

  if (normalizedProviderId === 'CLAUDE' || normalizedProviderId === 'ANTHROPIC') {
    return {
      family: 'anthropic-messages',
      supportsPromptCache: normalizedEndpoint !== 'chat',
      supportsExplicitBreakpoint: normalizedEndpoint !== 'chat',
      supportsCacheNamespace: false,
      reportsCacheRead: true,
      reportsCacheWrite: true,
      ...(normalizedEndpoint === 'chat'
        ? { reason: 'Anthropic prompt caching requires the Messages API endpoint' }
        : {})
    };
  }

  if (OPENAI_COMPATIBLE_PROVIDER_IDS.has(normalizedProviderId)) {
    return {
      family: 'openai-compatible',
      supportsPromptCache: true,
      supportsExplicitBreakpoint: false,
      supportsCacheNamespace: true,
      reportsCacheRead: true,
      reportsCacheWrite: true,
      ...(normalizedProviderId === 'DEEPSEEK'
        ? { reason: 'DeepSeek caching depends on the configured compatible gateway' }
        : {})
    };
  }

  if (normalizedProviderId === 'GEMINI' || normalizedProviderId === 'OLLAMA') {
    return {
      family: 'unsupported',
      supportsPromptCache: false,
      supportsExplicitBreakpoint: false,
      supportsCacheNamespace: false,
      reportsCacheRead: false,
      reportsCacheWrite: false,
      reason: `${normalizedProviderId} provider adapter does not expose prompt cache controls`
    };
  }

  return {
    family: 'unknown',
    supportsPromptCache: false,
    supportsExplicitBreakpoint: false,
    supportsCacheNamespace: false,
    reportsCacheRead: false,
    reportsCacheWrite: false,
    reason: `Unknown provider type: ${normalizedProviderId || 'empty'}`
  };
}
