import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import {
  fetchAiSettingsFromApi,
  findAiProvider,
  type AiProviderConfigSnapshot,
} from '../../adapters/aiProviderSettings';
import { getMockAiSettings } from '../../adapters/mock/seeds/aiSettingsSeed';
import { isAgentConsoleApiMode } from './ports';

const AI_SETTINGS_QUERY_KEY = ['agentConsole', 'aiSettings'] as const;

export function useAiProviderSettings(providerId: string): {
  provider: AiProviderConfigSnapshot | undefined;
  isActive: boolean;
  isLoading: boolean;
} {
  const { data, isLoading } = useQuery({
    queryKey: AI_SETTINGS_QUERY_KEY,
    queryFn: async () => {
      if (isAgentConsoleApiMode()) {
        return fetchAiSettingsFromApi();
      }
      return getMockAiSettings();
    },
    staleTime: 60_000,
  });

  const provider = useMemo(
    () => (providerId ? findAiProvider(data, providerId) : undefined),
    [data, providerId],
  );

  const isActive = Boolean(
    data?.ACTIVE_AI_PROVIDER_ID === providerId && provider?.enabled !== false,
  );

  return { provider, isActive, isLoading };
}
