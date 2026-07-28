import { filterAgentsForConsole } from '../../../domain/consoleAgentFilter';
import { MOCK_AGENTS as MOCK_AGENTS_FULL } from '../../../mock/data';
import { SKILL_CATALOG } from '../../../fixtures/mockCatalogs';
import { buildPlusStateByAgentId } from '../../../fixtures/plusMenuData';
import type { Agent, AgentPlusState } from '../../../domain/types';
import { resolvePrimaryAgentId } from '../../../domain/resolvePrimaryAgent';
import { MOCK_FALLBACK_AGENT_ID } from '../constants';

function buildAgents(): Agent[] {
  const gradientById = new Map(SKILL_CATALOG.agents.map((a) => [a.id, a.gradient]));

  return MOCK_AGENTS_FULL.map((agent) => ({
    id: agent.id,
    name: agent.name,
    description: agent.description,
    gradient: agent.gradient ?? gradientById.get(agent.id) ?? '',
    welcome: agent.welcome,
    openingQuestions: agent.openingQuestions,
    consoleVisible: agent.consoleVisible,
    isPrimary: agent.isPrimary,
    sessionType: agent.sessionType,
    groupMembers: agent.groupMembers,
    isLocalSystemEnabled: agent.isLocalSystemEnabled,
    workingDirectory: agent.workingDirectory,
  }));
}

let cachedAgents: Agent[] | null = null;
let cachedPlusState: Record<string, AgentPlusState> | null = null;

export function getMockAgents(): Agent[] {
  if (!cachedAgents) {
    cachedAgents = filterAgentsForConsole(buildAgents());
  }
  return cachedAgents;
}

export function getMockPlusStateByAgentId(): Record<string, AgentPlusState> {
  cachedPlusState ??= buildPlusStateByAgentId(getMockAgents());
  return cachedPlusState;
}

export function getMockActiveAgentId(): string {
  return resolvePrimaryAgentId(getMockAgents()) || MOCK_FALLBACK_AGENT_ID;
}
