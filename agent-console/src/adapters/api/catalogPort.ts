import type { ICatalogPort } from '../ports/ICatalogPort';
import type { EnabledProviderWithModels } from '../../domain/types/aiModel';
import type { ValidSearchType } from '../../domain/types/commandSearch';
import type { CommandSearchSources } from '../catalogSearch';
import { queryCommandSearch } from '../catalogSearch';
import {
  enrichCommandSearchResults,
  type EnrichedCommandSearchResult,
} from '../enrichCommandSearchResults';
import { mapBackendConsoleSearchToResults } from './mappers/consoleSearch';
import type { BackendConsoleSearchDto } from './mappers/consoleSearch';
import { agentConsoleGetJson } from './http';
import {
  fetchKbDocumentsForMention,
  mapAgentFilesToMentionFiles,
  mapAgentsTopicsToInputMenu,
  mergeMentionFiles,
} from './mappers/inputMenu';
import { listAgentRunsForAgent, resolveActiveAgentId } from './agentRun';
import { apiAgentPort } from './agentPort';

interface SettingsAiProvider {
  id: string;
  name?: string;
  type?: string;
  apiUrl?: string;
  apiKey?: string;
  apiKeyConfigured?: boolean;
  model?: string;
  models?: string[];
}

interface SettingsResponse {
  ACTIVE_AI_PROVIDER_ID?: string;
  AI_PROVIDERS?: SettingsAiProvider[];
}

export function mapSettingsProvidersToCatalog(
  providers: SettingsAiProvider[] | undefined,
): EnabledProviderWithModels[] {
  if (!providers?.length) return [];

  return providers
    .map((provider) => {
      const modelIds = provider.models?.length
        ? provider.models
        : provider.model
          ? [provider.model]
          : [];
      const uniqueModels = [...new Set(modelIds.map((id) => id.trim()).filter(Boolean))];

      const providerDisplayName = provider.name?.trim() || provider.id;

      return {
        id: provider.id,
        name: providerDisplayName,
        source: 'custom' as const,
        providerType: provider.type,
        children: uniqueModels.map((modelId) => ({
          id: modelId,
          displayName: providerDisplayName || modelId,
          abilities: {},
        })),
      };
    })
    .filter((entry) => entry.children.length > 0);
}

export const apiCatalogPort: ICatalogPort = {
  async getEnabledChatModels() {
    const settings = await agentConsoleGetJson<SettingsResponse>('/api/settings');
    return mapSettingsProvidersToCatalog(settings.AI_PROVIDERS);
  },

  async getInputMenu(agentId: string) {
    const resolvedAgentId = agentId || (await resolveActiveAgentId());
    const [consoleAgents, runsPage, plusState, kbMentionFiles] = await Promise.all([
      apiAgentPort.listAgents(),
      listAgentRunsForAgent(resolvedAgentId),
      apiAgentPort.getPlusState(resolvedAgentId),
      fetchKbDocumentsForMention(),
    ]);

    const topics = runsPage.items
      .filter((run) => run.sessionId)
      .map((run) => ({
        id: run.sessionId!,
        title:
          typeof run.metadata?.topicTitle === 'string' && run.metadata.topicTitle.trim()
            ? run.metadata.topicTitle
            : run.outputPreview?.slice(0, 40) || run.sessionId!,
        status: run.status === 'running' ? ('running' as const) : ('completed' as const),
      }));

    const mentionFiles = mergeMentionFiles(
      mapAgentFilesToMentionFiles(plusState.files, { enabledOnly: true }),
      kbMentionFiles,
    );

    return mapAgentsTopicsToInputMenu(consoleAgents, topics, mentionFiles);
  },

  async searchCommands(
    query: string,
    typeFilter: ValidSearchType | undefined,
    sources: CommandSearchSources,
  ): Promise<EnrichedCommandSearchResult[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const params = new URLSearchParams({
      q: trimmed,
      agentId: sources.activeAgentId,
      limit: '20',
    });
    const dto = await agentConsoleGetJson<BackendConsoleSearchDto>(
      `/api/console/search?${params.toString()}`,
    );
    const serverResults = mapBackendConsoleSearchToResults(
      dto,
      sources.activeAgentId,
      typeFilter,
    );

    let merged = serverResults;
    if (!typeFilter || typeFilter === 'message') {
      const localMessages = queryCommandSearch(trimmed, 'message', sources, {
        includeExtraMocks: false,
      });
      merged = [...serverResults, ...localMessages].slice(0, typeFilter ? 50 : 20);
    }

    return enrichCommandSearchResults(merged, sources.agents, sources.topics);
  },
};
