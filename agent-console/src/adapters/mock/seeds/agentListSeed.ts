import type { AgentListLayout, AgentRuntimeStatus } from '../../../domain/types';
import { resolvePrimaryAgentId } from '../../../domain/resolvePrimaryAgent';
import { filterAgentsForConsole } from '../../../domain/consoleAgentFilter';
import { DEFAULT_AGENT_PAGE_SIZE } from '../../../domain/types/agentList';
import { getMockAgents } from './agentSeed';

/** §C.19 — mock layout derived from agent metadata. */
export function getMockAgentListLayout(): AgentListLayout {
  const agents = getMockAgents();
  const visible = filterAgentsForConsole(agents);

  return {
    inboxAgentId: resolvePrimaryAgentId(agents),
    pinnedAgentIds: [],
    groups: [],
    ungroupedAgentIds: visible.map((agent) => agent.id),
    expandedGroupIds: [],
    agentPageSize: DEFAULT_AGENT_PAGE_SIZE,
    isAgentListInit: true,
  };
}

export function getMockAgentRuntimeById(): Record<string, AgentRuntimeStatus> {
  return Object.fromEntries(
    getMockAgents().map((agent) => [agent.id, { isRunning: false }]),
  );
}
