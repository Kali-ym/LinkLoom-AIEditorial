import type { AiBuildBusinessEnums, AiBuildDomainCatalog } from '../../types/aiBuilder.js';

export interface AiBuilderDomainCatalogProvider {
  buildDomainCatalog(): AiBuildDomainCatalog;
  buildLegacyBusinessEnums?(): AiBuildBusinessEnums;
}

export class EmptyAiBuilderDomainCatalogProvider implements AiBuilderDomainCatalogProvider {
  buildDomainCatalog(): AiBuildDomainCatalog {
    return { domains: [] };
  }
}
