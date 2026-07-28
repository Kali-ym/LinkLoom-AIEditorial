import { agentConsoleGetJson } from './api/http';

export interface AiProviderConfigSnapshot {
  id: string;
  name?: string;
  type?: string;
  apiUrl?: string;
  apiKey?: string;
  apiKeyConfigured?: boolean;
  model?: string;
  models?: string[];
  enabled?: boolean;
  useProxy?: boolean;
  apiEndpoint?: string;
  reasoningEffort?: string;
  modelCapabilities?: Record<string, string[]>;
}

export interface AiSettingsSnapshot {
  ACTIVE_AI_PROVIDER_ID?: string;
  AI_PROVIDERS?: AiProviderConfigSnapshot[];
}

export async function fetchAiSettingsFromApi(): Promise<AiSettingsSnapshot> {
  return agentConsoleGetJson<AiSettingsSnapshot>('/api/settings');
}

export function findAiProvider(
  settings: AiSettingsSnapshot | undefined,
  providerId: string,
): AiProviderConfigSnapshot | undefined {
  return settings?.AI_PROVIDERS?.find((provider) => provider.id === providerId);
}

export function isModelMultimodalEnabled(
  provider: AiProviderConfigSnapshot,
  modelId: string,
): boolean {
  const capabilities = provider.modelCapabilities?.[modelId];
  return Array.isArray(capabilities) && capabilities.includes('vision');
}

export function formatProviderModelsList(
  provider: AiProviderConfigSnapshot,
  currentModel: string,
): string {
  const models = provider.models?.length
    ? provider.models
    : provider.model
      ? [provider.model]
      : [];
  if (!models.length) return '—';
  return models
    .map((modelId) => (modelId === currentModel ? `${modelId}（当前）` : modelId))
    .join('、');
}
