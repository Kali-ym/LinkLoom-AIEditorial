/** §C.42*/

export interface AiModelAbilities {
  functionCall?: boolean;
  imageOutput?: boolean;
  reasoning?: boolean;
  vision?: boolean;
}

export interface AiModelForSelect {
  abilities: AiModelAbilities;
  contextWindowTokens?: number;
  displayName: string;
  id: string;
  maxOutput?: number;
  releasedAt?: string;
  type?: string;
}

export interface EnabledProviderWithModels {
  children: AiModelForSelect[];
  id: string;
  logo?: string;
  name: string;
  source?: 'builtin' | 'custom';
  /** Settings `AI_PROVIDERS[].type` — OPENAI | CLAUDE | GEMINI | … */
  providerType?: string;
}
