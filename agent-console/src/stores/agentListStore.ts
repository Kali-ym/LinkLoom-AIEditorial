import { create } from 'zustand';

import { writeAgentListLayoutPrefs } from '../adapters/api/agentListLayoutStorage';
import { isAgentConsoleApiMode } from '../adapters/registry';
import type { CreateAgentInput } from '../adapters/ports/IAgentPort';
import type {
  AgentListGroup,
  AgentListLayout,
  AgentRuntimeStatus,
  SidebarAgentListItem,
} from '../domain/types/agentList';
import {
  DEFAULT_AGENT_PAGE_SIZE,
  DEFAULT_LIST_GROUP_ID,
} from '../domain/types/agentList';
import type { Agent } from '../domain/types';
import type { AgentConsoleSnapshot } from '../adapters/types';
import { openAgentConsoleInNewTab } from '../services/navigation/openAgentConsoleWindow';
import { showToast } from '../services/ui/toast';
import { useAgentStore } from './agentStore';

function persistAgentListLayoutPrefs(state: {
  pinnedAgentIds: string[];
  groups: AgentListGroup[];
  ungroupedAgentIds: string[];
  expandedGroupIds: string[];
  agentPageSize: number;
}): void {
  if (!isAgentConsoleApiMode()) return;
  writeAgentListLayoutPrefs({
    pinnedAgentIds: state.pinnedAgentIds,
    groups: state.groups,
    ungroupedAgentIds: state.ungroupedAgentIds,
    expandedGroupIds: state.expandedGroupIds,
    agentPageSize: state.agentPageSize,
  });
}

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

interface AgentListState extends AgentListLayout {
  runtimeByAgentId: Record<string, AgentRuntimeStatus>;
  agentUpdatingId: string | null;
  groupUpdatingId: string | null;
  hydrate: (
    snapshot: Pick<AgentConsoleSnapshot, 'agentListLayout' | 'agentRuntimeById' | 'agents'>,
  ) => void;
  finishAgentListInit: () => void;
  getSidebarItem: (agentId: string, agents: Agent[]) => SidebarAgentListItem | undefined;
  getPinnedList: (agents: Agent[]) => SidebarAgentListItem[];
  getCustomGroups: (agents: Agent[]) => { group: AgentListGroup; items: SidebarAgentListItem[] }[];
  getDefaultList: (agents: Agent[]) => SidebarAgentListItem[];
  getUngroupedCount: () => number;
  toggleGroupExpanded: (groupId: string) => void;
  setExpandedGroupIds: (ids: string[]) => void;
  pinAgent: (agentId: string, pinned: boolean) => void;
  moveAgentToGroup: (agentId: string, groupId: string | null) => void;
  duplicateAgent: (agentId: string) => void;
  createAgent: (input?: CreateAgentInput) => Promise<string | null>;
  performRemoveAgent: (agentId: string) => void;
  setAgentUpdating: (agentId: string | null) => void;
  renamingAgentId: string | null;
  setRenamingAgentId: (agentId: string | null) => void;
  createGroupForAgentId: string | null;
  getAgentGroupId: (agentId: string) => string | null;
  openCreateGroupModal: (agentId: string) => void;
  closeCreateGroupModal: () => void;
  addGroup: (name: string) => string;
  createGroupAndMoveAgent: (agentId: string, name: string) => void;
  openAgentInNewWindow: (agentId: string) => void;
  renamingGroupId: string | null;
  setRenamingGroupId: (groupId: string | null) => void;
  renameGroup: (groupId: string, name: string) => void;
  removeGroup: (groupId: string) => void;
}

export const useAgentListStore = create<AgentListState>((set, get) => ({
  inboxAgentId: '',
  pinnedAgentIds: [],
  groups: [],
  ungroupedAgentIds: [],
  expandedGroupIds: [],
  agentPageSize: DEFAULT_AGENT_PAGE_SIZE,
  isAgentListInit: false,
  runtimeByAgentId: {},
  agentUpdatingId: null,
  groupUpdatingId: null,
  renamingAgentId: null,
  createGroupForAgentId: null,
  renamingGroupId: null,

  hydrate: (snapshot) =>
    set({
      ...snapshot.agentListLayout,
      runtimeByAgentId: snapshot.agentRuntimeById,
    }),

  finishAgentListInit: () => set({ isAgentListInit: true }),

  getSidebarItem: (agentId, agents) => {
    const agent = agents.find((a) => a.id === agentId);
    if (!agent) return undefined;
    const { pinnedAgentIds } = get();
    return agentToSidebarItem(agent, pinnedAgentIds.includes(agentId));
  },

  getPinnedList: (agents) => {
    const { pinnedAgentIds } = get();
    return pinnedAgentIds
      .map((id) => get().getSidebarItem(id, agents))
      .filter((item): item is SidebarAgentListItem => Boolean(item));
  },

  getCustomGroups: (agents) => {
    const { groups } = get();
    return groups.map((group) => ({
      group,
      items: group.itemIds
        .map((id) => get().getSidebarItem(id, agents))
        .filter((item): item is SidebarAgentListItem => Boolean(item)),
    }));
  },

  getDefaultList: (agents) => {
    const { ungroupedAgentIds, agentPageSize } = get();
    return ungroupedAgentIds
      .slice(0, agentPageSize)
      .map((id) => get().getSidebarItem(id, agents))
      .filter((item): item is SidebarAgentListItem => Boolean(item));
  },

  getUngroupedCount: () => get().ungroupedAgentIds.length,

  getAgentGroupId: (agentId) => {
    const { groups, ungroupedAgentIds } = get();
    for (const group of groups) {
      if (group.itemIds.includes(agentId)) return group.id;
    }
    if (ungroupedAgentIds.includes(agentId)) return DEFAULT_LIST_GROUP_ID;
    return null;
  },

  toggleGroupExpanded: (groupId) => {
    const { expandedGroupIds } = get();
    const next = expandedGroupIds.includes(groupId)
      ? expandedGroupIds.filter((id) => id !== groupId)
      : [...expandedGroupIds, groupId];
    set({ expandedGroupIds: next });
  },

  setExpandedGroupIds: (ids) => {
    const { expandedGroupIds } = get();
    if (
      ids.length === expandedGroupIds.length &&
      ids.every((id, index) => id === expandedGroupIds[index])
    ) {
      return;
    }
    set({ expandedGroupIds: ids });
  },

  pinAgent: (agentId, pinned) => {
    const { pinnedAgentIds, ungroupedAgentIds } = get();
    if (pinned) {
      if (!pinnedAgentIds.includes(agentId)) {
        set({
          pinnedAgentIds: [...pinnedAgentIds, agentId],
          ungroupedAgentIds: ungroupedAgentIds.filter((id) => id !== agentId),
        });
      }
    } else {
      set({
        pinnedAgentIds: pinnedAgentIds.filter((id) => id !== agentId),
        ungroupedAgentIds: ungroupedAgentIds.includes(agentId)
          ? ungroupedAgentIds
          : [...ungroupedAgentIds, agentId],
      });
    }
    persistAgentListLayoutPrefs(get());
  },

  moveAgentToGroup: (agentId, groupId) => {
    const { groups, ungroupedAgentIds, pinnedAgentIds } = get();
    const nextGroups = groups.map((g) => ({
      ...g,
      itemIds: g.itemIds.filter((id) => id !== agentId),
    }));
    if (groupId) {
      const idx = nextGroups.findIndex((g) => g.id === groupId);
      if (idx >= 0) {
        nextGroups[idx] = {
          ...nextGroups[idx],
          itemIds: [...nextGroups[idx].itemIds, agentId],
        };
      }
    }
    set({
      groups: nextGroups,
      ungroupedAgentIds:
        groupId === null
          ? ungroupedAgentIds.includes(agentId)
            ? ungroupedAgentIds
            : [...ungroupedAgentIds, agentId]
          : ungroupedAgentIds.filter((id) => id !== agentId),
      pinnedAgentIds: pinnedAgentIds.filter((id) => id !== agentId),
    });
  },

  duplicateAgent: (agentId) => {
    get().setAgentUpdating(agentId);
    void (async () => {
      await new Promise((r) => window.setTimeout(r, 600));
      const groupId = get().getAgentGroupId(agentId);
      const newId = await useAgentStore.getState().duplicateAgentInCatalog(agentId);
      if (newId) {
        if (groupId && groupId !== DEFAULT_LIST_GROUP_ID) {
          get().moveAgentToGroup(newId, groupId);
        } else {
          get().moveAgentToGroup(newId, null);
        }
        showToast('已复制 Agent');
      }
      get().setAgentUpdating(null);
    })();
  },

  createAgent: async (input) => {
    try {
      const newId = await useAgentStore.getState().createAgentInCatalog(input);
      if (!newId) return null;

      const resolvedGroupId =
        input?.groupId && input.groupId !== DEFAULT_LIST_GROUP_ID ? input.groupId : null;
      if (resolvedGroupId) {
        get().moveAgentToGroup(newId, resolvedGroupId);
      } else {
        get().moveAgentToGroup(newId, null);
      }
      persistAgentListLayoutPrefs(get());
      showToast('已创建 Agent');
      return newId;
    } catch {
      showToast('创建 Agent 失败，请重试');
      return null;
    }
  },

  performRemoveAgent: (agentId) => {
    const { pinnedAgentIds, ungroupedAgentIds, groups } = get();
    set({
      pinnedAgentIds: pinnedAgentIds.filter((id) => id !== agentId),
      ungroupedAgentIds: ungroupedAgentIds.filter((id) => id !== agentId),
      groups: groups.map((g) => ({
        ...g,
        itemIds: g.itemIds.filter((id) => id !== agentId),
      })),
    });
    void useAgentStore.getState().removeAgentFromCatalog(agentId);
    showToast('已删除 Agent');
  },

  openCreateGroupModal: (agentId) => set({ createGroupForAgentId: agentId }),

  closeCreateGroupModal: () => set({ createGroupForAgentId: null }),

  addGroup: (name) => {
    const id = `group-${Date.now()}`;
    const { groups, expandedGroupIds } = get();
    set({
      groups: [...groups, { id, name, itemIds: [] }],
      expandedGroupIds: expandedGroupIds.includes(id)
        ? expandedGroupIds
        : [...expandedGroupIds, id],
    });
    return id;
  },

  createGroupAndMoveAgent: (agentId, name) => {
    const groupId = get().addGroup(name);
    get().moveAgentToGroup(agentId, groupId);
  },

  openAgentInNewWindow: (agentId) => {
    openAgentConsoleInNewTab({ agentId });
  },

  setAgentUpdating: (agentId) => set({ agentUpdatingId: agentId }),

  setRenamingAgentId: (agentId) => set({ renamingAgentId: agentId }),

  setRenamingGroupId: (groupId) => set({ renamingGroupId: groupId }),

  renameGroup: (groupId, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    set((s) => ({
      groups: s.groups.map((g) => (g.id === groupId ? { ...g, name: trimmed } : g)),
    }));
  },

  removeGroup: (groupId) => {
    const { groups, ungroupedAgentIds } = get();
    const target = groups.find((g) => g.id === groupId);
    if (!target) return;
    set({
      groups: groups.filter((g) => g.id !== groupId),
      ungroupedAgentIds: [...ungroupedAgentIds, ...target.itemIds.filter((id) => !ungroupedAgentIds.includes(id))],
      expandedGroupIds: get().expandedGroupIds.filter((id) => id !== groupId),
    });
    showToast('已删除分组');
  },
}));
