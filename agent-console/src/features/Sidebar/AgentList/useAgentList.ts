import type { Agent } from '../../../domain/types';
import type { SidebarAgentListItem } from '../../../domain/types/agentList';
import { APPLICATION_CONSOLE_AGENT_IDS } from '../../../domain/applicationConsoleAgents';
import { filterAgentsForConsole } from '../../../domain/consoleAgentFilter';

function agentToSidebarItem(agent: Agent, pinned?: boolean): SidebarAgentListItem {
  return {
    id: agent.id,
    title: agent.name,
    avatar: agent.name.slice(0, 1),
    backgroundColor: agent.gradient,
    pinned,
    type: agent.sessionType === 'group' ? 'group' : 'agent',
  };
}

/** Flat application-agent rows for the header switcher (stable editorial order). */
export function buildAgentSwitchList(agents: Agent[]): SidebarAgentListItem[] {
  const visible = filterAgentsForConsole(agents);
  const order = new Map(APPLICATION_CONSOLE_AGENT_IDS.map((id, index) => [id, index]));
  return [...visible]
    .sort(
      (a, b) =>
        (order.get(a.id as (typeof APPLICATION_CONSOLE_AGENT_IDS)[number]) ?? 99) -
        (order.get(b.id as (typeof APPLICATION_CONSOLE_AGENT_IDS)[number]) ?? 99),
    )
    .map((agent) => agentToSidebarItem(agent));
}
