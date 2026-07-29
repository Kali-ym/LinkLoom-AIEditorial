import { filterAgentsForConsole } from '../../domain/consoleAgentFilter';
import { applyAdminExclusiveBindings } from '../../domain/utils/adminExclusiveBindings';
import { DEFAULT_AGENCY_CONFIG } from '../../domain/defaults/workspaceControls';
import type { AgentPlusState } from '../../domain/types';
import { useWorkspaceControlsStore } from '../../stores/workspaceControlsStore';
import type { AgentConsoleSnapshot } from '../types';
import {
  EMPTY_CONSOLE_CONFIG,
  EMPTY_INPUT_MENU,
  EMPTY_PORTAL_CONTENT,
  EMPTY_SHOWCASE,
  EMPTY_SKILL_CATALOG,
  EMPTY_STATIC_CONVERSATION,
} from '../emptyDomainDefaults';
import { buildDefaultLayout, buildRuntimeMap } from './agentListPort';
import { readStoredActiveAgentId, writeStoredActiveAgentId } from './activeAgentStorage';
import { readStoredActiveTopicId, writeStoredActiveTopicId } from './activeTopicStorage';
import { agentConsoleGetJson } from './http';
import {
  mapBackendAgentToDomain,
  mapBackendAgentToPlusState,
  readAgencyConfigFromBackendAgent,
} from './mappers/agent';
import {
  mergeBindingsIntoPlusState,
  type BackendAgentResourceBindingDto,
  type KbCategoryNameDto,
} from './mappers/agentBindings';
import { mapBackendMessagesToDomain } from './mappers/message';
import { buildTopicSidebarData, sessionIdToTopicId } from './mappers/sessionTopic';
import { mapAgentRunsToTaskGroups } from './mappers/taskGroups';
import type { BackendAgentDto } from './types/agent';
import type { BackendSessionMessagesDto } from './types/message';
import type { BackendAgentRunPageDto } from './types/session';

export type ConsoleBootstrapDto = {
  ok: true;
  agents: BackendAgentDto[];
  kbCategories: Array<{ id: string; name: string }>;
  bindingsByAgentId: Record<string, BackendAgentResourceBindingDto[]>;
  agentRuns: BackendAgentRunPageDto;
  globalRuns: BackendAgentRunPageDto;
  activeAgentId: string;
  activeTopicId: string;
  activeSessionMessages: BackendSessionMessagesDto | null;
};

function hydrateAgencyConfigs(agents: BackendAgentDto[]): void {
  const configs = Object.fromEntries(
    agents
      .map((agent) => {
        const agency = readAgencyConfigFromBackendAgent(agent);
        return agency ? ([agent.id, { ...DEFAULT_AGENCY_CONFIG, ...agency }] as const) : null;
      })
      .filter((entry): entry is readonly [string, typeof DEFAULT_AGENCY_CONFIG] => entry !== null),
  );
  if (Object.keys(configs).length > 0) {
    useWorkspaceControlsStore.getState().hydrateAgencyConfigs(configs);
  }
}

function resolveActiveAgentId(agents: BackendAgentDto[], preferred: string): string {
  const visible = filterAgentsForConsole(agents.map(mapBackendAgentToDomain));
  const visibleIds = new Set(visible.map((agent) => agent.id));
  const stored = readStoredActiveAgentId();
  if (stored && visibleIds.has(stored)) return stored;
  if (preferred && visibleIds.has(preferred)) {
    writeStoredActiveAgentId(preferred);
    return preferred;
  }
  const first = visible[0]?.id ?? '';
  if (first) writeStoredActiveAgentId(first);
  return first;
}

function buildPlusStateMap(
  agents: BackendAgentDto[],
  bindingsByAgentId: Record<string, BackendAgentResourceBindingDto[]>,
  kbCategories: KbCategoryNameDto[],
): Record<string, AgentPlusState> {
  const visible = filterAgentsForConsole(agents.map(mapBackendAgentToDomain));
  const byId = new Map(agents.map((agent) => [agent.id, agent]));
  const entries = visible.map((agent) => {
    const dto = byId.get(agent.id)!;
    const base = mapBackendAgentToPlusState(dto);
    const bindings = bindingsByAgentId[agent.id] ?? [];
    return [
      agent.id,
      applyAdminExclusiveBindings(
        agent.id,
        mergeBindingsIntoPlusState(base, bindings, kbCategories),
      ),
    ] as const;
  });
  return Object.fromEntries(entries);
}

/** Fetch one aggregated payload and map into the hydrate snapshot core fields. */
export async function fetchAndMapConsoleBootstrap(): Promise<{
  hydrateCore: Pick<
    AgentConsoleSnapshot,
    | 'agents'
    | 'activeAgentId'
    | 'plusStateByAgentId'
    | 'agentListLayout'
    | 'agentRuntimeById'
    | 'topics'
    | 'activeTopicId'
    | 'threadsByTopicId'
    | 'elapsedByTopicId'
    | 'messagesByTopicId'
    | 'taskGroups'
  >;
}> {
  const storedAgentId = readStoredActiveAgentId() ?? '';
  const storedTopicId = storedAgentId ? readStoredActiveTopicId(storedAgentId) ?? '' : '';
  const params = new URLSearchParams();
  if (storedAgentId) params.set('agentId', storedAgentId);
  if (storedTopicId) params.set('topicId', storedTopicId);
  const qs = params.toString();
  const dto = await agentConsoleGetJson<ConsoleBootstrapDto>(
    `/api/console/bootstrap${qs ? `?${qs}` : ''}`,
    { timeoutMs: 60_000 },
  );

  hydrateAgencyConfigs(dto.agents);

  const agents = filterAgentsForConsole(dto.agents.map(mapBackendAgentToDomain));
  const activeAgentId = resolveActiveAgentId(dto.agents, dto.activeAgentId);
  const plusStateByAgentId = buildPlusStateMap(
    dto.agents,
    dto.bindingsByAgentId ?? {},
    (dto.kbCategories ?? []).map((category) => ({ id: category.id, name: category.name })),
  );
  const agentListLayout = buildDefaultLayout(agents);
  const agentRuntimeById = buildRuntimeMap(
    dto.globalRuns?.items ?? [],
    agents.map((agent) => agent.id),
  );

  const preferredTopic =
    (storedTopicId || dto.activeTopicId || '').trim() ||
    (dto.activeSessionMessages?.sessionId
      ? sessionIdToTopicId(dto.activeSessionMessages.sessionId)
      : '');

  const sidebar = buildTopicSidebarData(
    dto.agentRuns?.items ?? [],
    activeAgentId,
    preferredTopic || undefined,
  );
  const activeTopicId =
    preferredTopic && sidebar.topics.some((topic) => topic.id === preferredTopic)
      ? preferredTopic
      : sidebar.topics[0]?.id ?? '';

  if (activeTopicId) {
    writeStoredActiveTopicId(activeTopicId, activeAgentId);
  }

  const messagesByTopicId: AgentConsoleSnapshot['messagesByTopicId'] = {};
  if (dto.activeSessionMessages?.sessionId) {
    const topicId = sessionIdToTopicId(dto.activeSessionMessages.sessionId);
    messagesByTopicId[topicId] = mapBackendMessagesToDomain(
      dto.activeSessionMessages.messages ?? [],
      dto.activeSessionMessages.sessionId,
      dto.activeSessionMessages.threadId,
    );
  } else if (activeTopicId) {
    messagesByTopicId[activeTopicId] = [];
  }

  return {
    hydrateCore: {
      agents,
      activeAgentId,
      plusStateByAgentId,
      agentListLayout,
      agentRuntimeById,
      topics: sidebar.topics,
      activeTopicId,
      threadsByTopicId: sidebar.threadsByTopicId,
      elapsedByTopicId: sidebar.elapsedByTopicId,
      messagesByTopicId,
      taskGroups: mapAgentRunsToTaskGroups(dto.agentRuns?.items ?? []),
    },
  };
}

export function emptyBootstrapSecondaryFields(): Pick<
  AgentConsoleSnapshot,
  | 'staticConversation'
  | 'skillCatalog'
  | 'todos'
  | 'documents'
  | 'webPages'
  | 'fileTree'
  | 'reviewFiles'
  | 'workingDir'
  | 'portalContent'
  | 'inputMenu'
  | 'showcase'
  | 'config'
  | 'authorsByUserId'
  | 'shareByTopicId'
  | 'pendingAuthTools'
> {
  return {
    staticConversation: EMPTY_STATIC_CONVERSATION,
    skillCatalog: EMPTY_SKILL_CATALOG,
    todos: [],
    documents: [],
    webPages: [],
    fileTree: [],
    reviewFiles: [],
    workingDir: '',
    portalContent: EMPTY_PORTAL_CONTENT,
    inputMenu: EMPTY_INPUT_MENU,
    showcase: EMPTY_SHOWCASE,
    config: EMPTY_CONSOLE_CONFIG,
    authorsByUserId: {},
    shareByTopicId: {},
    pendingAuthTools: [],
  };
}
