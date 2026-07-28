import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import {
  findEnabledModel,
  getEnabledChatModels,
  getModelDisplayName,
  isModelImageOutput,
} from '../../adapters/modelAdapter';
import { getNavigableRoutes, getSettingsRoutePath } from '../../adapters/navigableRoutes';
import type { CommandSearchSources } from '../../adapters/catalogSearch';
import type { ValidSearchType } from '../../domain/types/commandSearch';
import type { EnabledProviderWithModels } from '../../domain/types/aiModel';
import { getAgentConsolePorts, isAgentConsoleApiMode } from './ports';
import { agentConsoleQueryKeys } from './queryKeys';

export {
  buildSlashCatalogItems,
  filterSlashCatalogItems,
} from '../../adapters/slashActionItems';
export type { SlashCatalogItem, SlashTriggerPosition } from '../../adapters/slashActionItems';
export { getNavigableRoutes as useNavigableRoutes, getSettingsRoutePath };

export function useEnabledChatModelsQuery() {
  return useQuery({
    queryKey: agentConsoleQueryKeys.catalogModels(),
    queryFn: () => getAgentConsolePorts().catalog.getEnabledChatModels(),
    staleTime: 60_000,
    initialData: isAgentConsoleApiMode() ? undefined : getEnabledChatModels(),
  });
}

export function useEnabledChatModels(): EnabledProviderWithModels[] {
  const { data } = useEnabledChatModelsQuery();
  return data ?? getEnabledChatModels();
}

export function useModelDisplayName(modelId: string, providerId: string): string {
  const models = useEnabledChatModels();
  return useMemo(
    () =>
      findEnabledModel(modelId, providerId, models)?.displayName ??
      getModelDisplayName(modelId, providerId),
    [modelId, models, providerId],
  );
}

export function useFindEnabledModel(modelId: string, providerId: string) {
  const models = useEnabledChatModels();
  return useMemo(
    () => findEnabledModel(modelId, providerId, models),
    [modelId, models, providerId],
  );
}

export function useModelSupportsImageOutput(modelId: string, providerId: string): boolean {
  const models = useEnabledChatModels();
  return useMemo(
    () =>
      isModelImageOutput(modelId, providerId) ||
      findEnabledModel(modelId, providerId, models)?.abilities.imageOutput === true,
    [modelId, models, providerId],
  );
}

export function useCommandSearch(
  query: string,
  typeFilter: ValidSearchType | undefined,
  sources: CommandSearchSources,
) {
  return useQuery({
    enabled: query.trim().length > 0,
    queryKey: agentConsoleQueryKeys.commandSearch(query, typeFilter),
    queryFn: () =>
      getAgentConsolePorts().catalog.searchCommands(query, typeFilter, sources),
    staleTime: 5_000,
  });
}
