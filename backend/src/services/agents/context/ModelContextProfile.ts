export type TokenizerEncoding = 'o200k_base' | 'cl100k_base' | 'p50k_base' | 'r50k_base';

export interface ModelContextProfile {
  providerId: string;
  modelId: string;
  theoreticalMax: number;
  providerEffectiveMax?: number;
  maxOutput?: number;
  driftMultiplier: number;
  encoding: TokenizerEncoding;
}

export interface ContextProfileOverrides {
  maxContextWindow?: number;
  maxOutput?: number;
}

const DEFAULT_PROFILES: ModelContextProfile[] = [
  { providerId: 'openai', modelId: 'gpt-4o', theoreticalMax: 128000, maxOutput: 16384, encoding: 'o200k_base', driftMultiplier: 1.1 },
  { providerId: 'openai', modelId: 'gpt-4o-mini', theoreticalMax: 128000, maxOutput: 16384, encoding: 'o200k_base', driftMultiplier: 1.1 },
  { providerId: 'openai', modelId: 'gpt-4.1', theoreticalMax: 1047576, maxOutput: 32768, encoding: 'o200k_base', driftMultiplier: 1.1 },
  { providerId: 'openai', modelId: 'o1', theoreticalMax: 200000, maxOutput: 100000, encoding: 'o200k_base', driftMultiplier: 1.1 },
  { providerId: 'openai', modelId: 'o3', theoreticalMax: 200000, maxOutput: 100000, encoding: 'o200k_base', driftMultiplier: 1.1 },
  { providerId: 'anthropic', modelId: 'claude-3-5-sonnet', theoreticalMax: 200000, maxOutput: 8192, encoding: 'cl100k_base', driftMultiplier: 1.25 },
  { providerId: 'anthropic', modelId: 'claude-3-5-haiku', theoreticalMax: 200000, maxOutput: 8192, encoding: 'cl100k_base', driftMultiplier: 1.25 },
  { providerId: 'anthropic', modelId: 'claude-sonnet-4', theoreticalMax: 200000, maxOutput: 16384, encoding: 'cl100k_base', driftMultiplier: 1.25 },
  { providerId: 'anthropic', modelId: 'claude-opus-4', theoreticalMax: 200000, maxOutput: 32768, encoding: 'cl100k_base', driftMultiplier: 1.25 },
  { providerId: 'google', modelId: 'gemini-2.5-pro', theoreticalMax: 2000000, maxOutput: 8192, encoding: 'o200k_base', driftMultiplier: 1.18 },
  { providerId: 'google', modelId: 'gemini-2.0-flash', theoreticalMax: 1000000, maxOutput: 8192, encoding: 'o200k_base', driftMultiplier: 1.18 },
  { providerId: 'deepseek', modelId: 'deepseek-chat', theoreticalMax: 64000, maxOutput: 8192, encoding: 'cl100k_base', driftMultiplier: 1.2 },
  { providerId: '*', modelId: '*', theoreticalMax: 200000, maxOutput: 8192, encoding: 'o200k_base', driftMultiplier: 1.15 }
];

export class ModelContextRegistry {
  private readonly profiles: ModelContextProfile[];

  constructor(profiles: ModelContextProfile[] = DEFAULT_PROFILES) {
    this.profiles = profiles;
  }

  resolve(providerId: string, modelId: string, overrides?: ContextProfileOverrides): ModelContextProfile {
    const exact = this.profiles.find((p) => p.providerId === providerId && p.modelId === modelId);
    const providerWildcard = this.profiles.find((p) => p.providerId === providerId && p.modelId === '*');
    const globalFallback = this.profiles.find((p) => p.providerId === '*' && p.modelId === '*');
    const base = exact ?? providerWildcard ?? globalFallback ?? {
      providerId,
      modelId,
      theoreticalMax: 200000,
      maxOutput: 8192,
      encoding: 'o200k_base' as TokenizerEncoding,
      driftMultiplier: 1.15
    };

    const theoreticalMax = overrides?.maxContextWindow && overrides.maxContextWindow > 0
      ? overrides.maxContextWindow
      : base.theoreticalMax;
    const maxOutput = overrides?.maxOutput && overrides.maxOutput > 0 ? overrides.maxOutput : base.maxOutput;

    return {
      ...base,
      theoreticalMax,
      maxOutput,
      providerEffectiveMax: base.providerEffectiveMax ?? theoreticalMax
    };
  }
}

const defaultRegistry = new ModelContextRegistry();

export function resolveContextProfile(
  providerId: string,
  modelId: string,
  overrides?: ContextProfileOverrides
): ModelContextProfile {
  return defaultRegistry.resolve(providerId, modelId, overrides);
}
