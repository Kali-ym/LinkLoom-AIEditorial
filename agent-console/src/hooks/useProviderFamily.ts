import { useMemo } from 'react';

import { useEnabledChatModels } from './useEnabledChatModels';

export type ProviderFamily = 'openai' | 'anthropic' | 'google' | 'ollama' | 'unknown';

export function mapProviderTypeToFamily(providerType?: string, providerId?: string): ProviderFamily {
  switch (providerType) {
    case 'OPENAI':
    case 'GLM':
    case 'SMALL':
      return 'openai';
    case 'CLAUDE':
      return 'anthropic';
    case 'GEMINI':
      return 'google';
    case 'OLLAMA':
      return 'ollama';
    default:
      break;
  }

  const hint = `${providerType ?? ''} ${providerId ?? ''}`.toLowerCase();
  if (hint.includes('claude') || hint.includes('anthropic')) return 'anthropic';
  if (hint.includes('gemini') || hint.includes('google')) return 'google';
  if (hint.includes('ollama')) return 'ollama';
  if (hint.includes('openai') || hint.includes('glm') || hint.includes('gpt')) return 'openai';
  return 'unknown';
}

/** Resolve lobehub-style provider family from settings-backed catalog + agent provider id. */
export function useProviderFamily(providerId: string): ProviderFamily {
  const catalog = useEnabledChatModels();
  return useMemo(() => {
    const entry = catalog.find((item) => item.id === providerId);
    return mapProviderTypeToFamily(entry?.providerType, providerId);
  }, [catalog, providerId]);
}
