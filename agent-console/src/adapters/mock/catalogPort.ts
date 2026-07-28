import type { ICatalogPort } from '../ports/ICatalogPort';
import { queryCommandSearch } from '../catalogSearch';
import { getEnabledChatModels } from '../modelAdapter';
import { getMockInputMenu } from './seeds/catalogSeed';

export const mockCatalogPort: ICatalogPort = {
  async getEnabledChatModels() {
    return getEnabledChatModels();
  },

  async getInputMenu(_agentId: string) {
    return getMockInputMenu();
  },

  async searchCommands(query, typeFilter, sources) {
    return Promise.resolve(queryCommandSearch(query, typeFilter, sources));
  },
};
