import type { EnabledProviderWithModels } from '../../domain/types/aiModel';
import type { InputMenuData } from '../../domain/types/inputMenu';
import type { ValidSearchType } from '../../domain/types/commandSearch';
import type { EnrichedCommandSearchResult } from '../enrichCommandSearchResults';
import type { CommandSearchSources } from '../catalogSearch';

export interface ICatalogPort {
  getEnabledChatModels(): Promise<EnabledProviderWithModels[]>;
  getInputMenu(agentId: string): Promise<InputMenuData>;
  searchCommands(
    query: string,
    typeFilter: ValidSearchType | undefined,
    sources: CommandSearchSources,
  ): Promise<EnrichedCommandSearchResult[]>;
}
