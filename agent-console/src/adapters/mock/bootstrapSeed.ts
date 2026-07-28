import type { AgentConsoleSnapshot } from '../types';
import {
  EMPTY_AGENT_LIST_LAYOUT,
  EMPTY_CONSOLE_CONFIG,
  EMPTY_INPUT_MENU,
  EMPTY_PORTAL_CONTENT,
  EMPTY_SHOWCASE,
  EMPTY_SKILL_CATALOG,
  EMPTY_STATIC_CONVERSATION,
} from '../emptyDomainDefaults';
import { getAgentConsolePorts, isAgentConsoleApiMode } from '../registry';
import { getAllClientTopics } from '../../services/topic/clientTopicStorage';
import {
  clientRecordToTempTopic,
  dedupeEmptyTempTopicsForAgent,
} from '../../services/topic/tempTopicDraft';
import {
  emptyBootstrapSecondaryFields,
  fetchAndMapConsoleBootstrap,
} from '../api/mapConsoleBootstrap';

export interface PortSeedResult {
  activeTopicId: string;
  agentListLayout: AgentConsoleSnapshot['agentListLayout'];
  hydrate: AgentConsoleSnapshot;
}

/**
 * Resilient single-port resolve for api mode.
 * On rejection (notably NOT_IMPLEMENTED/501 from stub ports) returns `fallback`
 * so one un-implemented domain never blocks the rest of the hydrate.
 */
async function settle<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[agentConsole] api seed fallback (using default for one domain):', error);
    }
    return fallback;
  }
}

async function seedFromAggregatedBootstrap(): Promise<PortSeedResult | null> {
  if (!isAgentConsoleApiMode()) return null;
  try {
    const { hydrateCore } = await fetchAndMapConsoleBootstrap();
    const ports = getAgentConsolePorts();
    const secondaryDefaults = emptyBootstrapSecondaryFields();

    const [
      skillCatalog,
      documents,
      webPages,
      fileTree,
      reviewFiles,
      workingDir,
      portalContent,
      todos,
      showcase,
      staticConversation,
      inputMenu,
      config,
      authorsByUserId,
      shareByTopicId,
      pendingAuthTools,
    ] = await Promise.all([
      settle(ports.workspace.getSkillCatalog(), secondaryDefaults.skillCatalog),
      settle(ports.workspace.getWorkspaceDocumentTree(hydrateCore.activeAgentId), []),
      settle(ports.workspace.getWebPages(), []),
      settle(ports.workspace.getFileTree(), []),
      settle(ports.workspace.getReviewFiles(), []),
      settle(ports.workspace.getWorkingDirectory(), ''),
      settle(ports.workspace.getPortalContent(), secondaryDefaults.portalContent),
      settle(ports.workspace.getTodos(), []),
      settle(ports.workspace.getShowcase(), secondaryDefaults.showcase),
      settle(ports.workspace.getStaticConversation(), secondaryDefaults.staticConversation),
      settle(ports.catalog.getInputMenu(hydrateCore.activeAgentId), secondaryDefaults.inputMenu),
      settle(ports.runtime.getConsoleConfig(), secondaryDefaults.config),
      settle(ports.runtime.getAuthorsByUserId(), {}),
      settle(ports.share.getShareByTopicId(), {}),
      settle(ports.runtime.getPendingAuthTools(), []),
    ]);

    const hydrate: AgentConsoleSnapshot = {
      ...hydrateCore,
      skillCatalog,
      documents,
      webPages,
      fileTree,
      reviewFiles,
      workingDir,
      portalContent,
      todos,
      showcase,
      staticConversation,
      inputMenu,
      config,
      authorsByUserId,
      shareByTopicId,
      pendingAuthTools,
    };

    mergeClientTopicsIntoHydrate(hydrate, hydrate.activeAgentId);
    hydrate.topics = dedupeEmptyTempTopicsForAgent(hydrate.topics, hydrate.activeAgentId);

    return {
      activeTopicId: hydrate.activeTopicId,
      agentListLayout: hydrate.agentListLayout,
      hydrate,
    };
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[agentConsole] aggregated bootstrap failed, falling back to ports:', error);
    }
    return null;
  }
}

/** Async port gather — mock and api modes both resolve via getAgentConsolePorts(). */
export async function seedStoresFromPorts(): Promise<PortSeedResult> {
  const aggregated = await seedFromAggregatedBootstrap();
  if (aggregated) return aggregated;

  const ports = getAgentConsolePorts();
  const stubFallback = {
    agentListLayout: EMPTY_AGENT_LIST_LAYOUT,
    skillCatalog: EMPTY_SKILL_CATALOG,
    portalContent: EMPTY_PORTAL_CONTENT,
    showcase: EMPTY_SHOWCASE,
    staticConversation: EMPTY_STATIC_CONVERSATION,
    inputMenu: EMPTY_INPUT_MENU,
    config: EMPTY_CONSOLE_CONFIG,
  };

  const [
    agents,
    activeAgentId,
    plusStateByAgentId,
    agentListLayout,
    agentRuntimeById,
    activeTopicId,
    threadsByTopicId,
    elapsedByTopicId,
    messagesByTopicId,
  ] = await Promise.all([
    settle(ports.agent.listAgents(), []),
    settle(ports.agent.getActiveAgentId(), ''),
    settle(ports.agent.getPlusStateMap(), {}),
    settle(ports.agentList.getLayout(), EMPTY_AGENT_LIST_LAYOUT),
    settle(ports.agentList.getRuntimeByAgentId(), {}),
    settle(ports.topic.getActiveTopicId(), ''),
    settle(ports.topic.getThreadsByTopicId(), {}),
    settle(ports.topic.getElapsedByTopicId(), {}),
    settle(ports.chat.getMessagesByTopicId(), {}),
  ]);

  const [
    topics,
    taskGroups,
    skillCatalog,
    documents,
    webPages,
    fileTree,
    reviewFiles,
    workingDir,
    portalContent,
    todos,
    showcase,
    staticConversation,
    inputMenu,
    config,
    authorsByUserId,
    shareByTopicId,
    pendingAuthTools,
  ] = await Promise.all([
    settle(ports.topic.listTopics(activeAgentId), []),
    settle(ports.task.getTaskGroups(activeAgentId), []),
    settle(ports.workspace.getSkillCatalog(), stubFallback.skillCatalog),
    settle(ports.workspace.getWorkspaceDocumentTree(activeAgentId), []),
    settle(ports.workspace.getWebPages(), []),
    settle(ports.workspace.getFileTree(), []),
    settle(ports.workspace.getReviewFiles(), []),
    settle(ports.workspace.getWorkingDirectory(), ''),
    settle(ports.workspace.getPortalContent(), stubFallback.portalContent),
    settle(ports.workspace.getTodos(), []),
    settle(ports.workspace.getShowcase(), stubFallback.showcase),
    settle(ports.workspace.getStaticConversation(), stubFallback.staticConversation),
    settle(ports.catalog.getInputMenu(activeAgentId), stubFallback.inputMenu),
    settle(ports.runtime.getConsoleConfig(), stubFallback.config),
    settle(ports.runtime.getAuthorsByUserId(), {}),
    settle(ports.share.getShareByTopicId(), {}),
    settle(ports.runtime.getPendingAuthTools(), []),
  ]);

  const hydrate: AgentConsoleSnapshot = {
    agents,
    activeAgentId,
    plusStateByAgentId,
    agentListLayout,
    agentRuntimeById,
    topics,
    activeTopicId,
    threadsByTopicId,
    elapsedByTopicId,
    messagesByTopicId,
    staticConversation,
    skillCatalog,
    todos,
    documents,
    webPages,
    fileTree,
    reviewFiles,
    workingDir,
    portalContent,
    inputMenu,
    showcase,
    taskGroups,
    config,
    authorsByUserId,
    shareByTopicId,
    pendingAuthTools,
  };

  mergeClientTopicsIntoHydrate(hydrate, hydrate.activeAgentId);
  hydrate.topics = dedupeEmptyTempTopicsForAgent(hydrate.topics, hydrate.activeAgentId);

  return { activeTopicId, agentListLayout, hydrate };
}

function mergeClientTopicsIntoHydrate(
  hydrate: AgentConsoleSnapshot,
  activeAgentId: string,
): void {
  for (const clientTopic of getAllClientTopics()) {
    if (clientTopic.agentId && clientTopic.agentId !== activeAgentId) continue;
    if (!hydrate.messagesByTopicId[clientTopic.id]?.length) {
      hydrate.messagesByTopicId[clientTopic.id] = clientTopic.messages;
    }
    if (hydrate.topics.some((topic) => topic.id === clientTopic.id)) continue;
    hydrate.topics.unshift({
      ...clientRecordToTempTopic(clientTopic, activeAgentId),
      status: clientTopic.messages.length > 0 ? 'completed' : 'temp',
      active: hydrate.activeTopicId === clientTopic.id,
    });
  }
}
