import type { AgentConsoleSnapshot } from '../types';
import { getMockActiveAgentId, getMockAgents, getMockPlusStateByAgentId } from './seeds/agentSeed';
import { getMockAgentListLayout, getMockAgentRuntimeById } from './seeds/agentListSeed';
import { getMockMessagesByTopicId, getMockStaticConversation } from './seeds/chatSeed';
import { getMockInputMenu, getMockShowcase } from './seeds/catalogSeed';
import { getMockAuthorsByUserId, getMockConsoleConfig } from './seeds/configSeed';
import { getMockPendingAuthTools } from './seeds/runtimeSeed';
import { getMockShareByTopicId } from './seeds/shareSeed';
import { getMockTaskGroups } from './seeds/taskSeed';
import {
  getMockActiveTopicId,
  getMockElapsedByTopicId,
  getMockThreadsByTopicId,
  getMockTopics,
} from './seeds/topicSeed';
import {
  getMockDocuments,
  getMockFileTree,
  getMockPortalContent,
  getMockReviewFiles,
  getMockSkillCatalog,
  getMockTodos,
  getMockWebPages,
  getMockWorkingDirectory,
} from './seeds/workspaceSeed';

function buildSnapshot(): AgentConsoleSnapshot {
  return {
    agents: getMockAgents(),
    plusStateByAgentId: getMockPlusStateByAgentId(),
    activeAgentId: getMockActiveAgentId(),
    topics: getMockTopics(),
    activeTopicId: getMockActiveTopicId(),
    threadsByTopicId: getMockThreadsByTopicId(),
    elapsedByTopicId: getMockElapsedByTopicId(),
    messagesByTopicId: getMockMessagesByTopicId(),
    staticConversation: getMockStaticConversation(),
    skillCatalog: getMockSkillCatalog(),
    todos: getMockTodos(),
    documents: getMockDocuments(),
    webPages: getMockWebPages(),
    fileTree: getMockFileTree(),
    reviewFiles: getMockReviewFiles(),
    workingDir: getMockWorkingDirectory(),
    portalContent: getMockPortalContent(),
    inputMenu: getMockInputMenu(),
    showcase: getMockShowcase(),
    taskGroups: getMockTaskGroups(),
    config: getMockConsoleConfig(),
    authorsByUserId: getMockAuthorsByUserId(),
    shareByTopicId: getMockShareByTopicId(),
    agentListLayout: getMockAgentListLayout(),
    agentRuntimeById: getMockAgentRuntimeById(),
    pendingAuthTools: getMockPendingAuthTools(),
  };
}

let cachedSnapshot: AgentConsoleSnapshot | null = null;

/** @deprecated Phase 5 — use getAgentConsolePorts() instead. */
export function getMockSnapshot(): AgentConsoleSnapshot {
  if (!cachedSnapshot) {
    cachedSnapshot = buildSnapshot();
  }
  return cachedSnapshot;
}

/** @deprecated Phase 5 — use getAgentConsolePorts() instead. */
export function createMockAdapter(): { getSnapshot: () => AgentConsoleSnapshot } {
  return { getSnapshot: getMockSnapshot };
}
