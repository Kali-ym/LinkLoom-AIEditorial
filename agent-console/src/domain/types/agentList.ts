/** Inbox / primary agent id lives on {@link AgentListLayout.inboxAgentId} — resolved from agent metadata. */
export const DEFAULT_AGENT_PAGE_SIZE = 5;

export const DEFAULT_LIST_GROUP_ID = 'default';

/** Sidebar row*/
export interface SidebarAgentListItem {
  id: string;
  title: string;
  avatar: string;
  backgroundColor: string;
  pinned?: boolean;
  /** Group chat session row (vs folder accordion). */
  type?: 'agent' | 'group';
}

export interface AgentListGroup {
  id: string;
  name: string;
  itemIds: string[];
}

export interface AgentListLayout {
  inboxAgentId: string;
  pinnedAgentIds: string[];
  groups: AgentListGroup[];
  ungroupedAgentIds: string[];
  expandedGroupIds: string[];
  agentPageSize: number;
  isAgentListInit: boolean;
}

export interface AgentRuntimeStatus {
  isRunning?: boolean;
  unreadCount?: number;
}
