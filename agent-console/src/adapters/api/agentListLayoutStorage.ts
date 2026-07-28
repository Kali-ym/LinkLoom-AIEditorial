import type { AgentListLayout } from '../../domain/types/agentList';

const AGENT_LIST_LAYOUT_KEY = 'agentConsole:agentListLayout';

export type AgentListLayoutPrefs = Pick<
  AgentListLayout,
  'pinnedAgentIds' | 'groups' | 'ungroupedAgentIds' | 'expandedGroupIds' | 'agentPageSize'
>;

export function readAgentListLayoutPrefs(): Partial<AgentListLayoutPrefs> | null {
  try {
    const raw = localStorage.getItem(AGENT_LIST_LAYOUT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<AgentListLayoutPrefs>;
  } catch {
    return null;
  }
}

export function writeAgentListLayoutPrefs(prefs: AgentListLayoutPrefs): void {
  try {
    localStorage.setItem(AGENT_LIST_LAYOUT_KEY, JSON.stringify(prefs));
  } catch {
    // ignore quota / private mode
  }
}
