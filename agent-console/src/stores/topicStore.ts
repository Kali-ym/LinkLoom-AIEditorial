import { create } from 'zustand';

import type { TopicModelSelection } from '../domain/agentConsoleScope';
import { writeStoredActiveTopicId, clearStoredActiveTopicId } from '../adapters/api/activeTopicStorage';
import { isEphemeralTopicId } from '../adapters/api/mappers/sessionTopic';
import { filterTopicsForAgent } from '../services/topic/topicAgentScope';
import { saveClientTopic, removeClientTopic } from '../services/topic/clientTopicStorage';
import {
  clientRecordToTempTopic,
  findEmptyTempClientTopicForAgent,
  pruneEmptyTempClientTopicsForAgent,
} from '../services/topic/tempTopicDraft';
import {
  readStoredTopicModel,
  writeStoredTopicModel,
  clearStoredTopicModel,
} from '../services/topic/topicModelStorage';
import { ensureTopicModelLoaded as hydrateTopicModelFromStorage } from '../services/topic/topicModelBinding';
import { generateTopicId } from '../services/topic/topicId';
import { getAgentConsolePorts, isAgentConsoleApiMode } from '../adapters/registry';
import type { TopicImportPayload } from '../adapters/types';
import type { AgentConsoleSnapshot } from '../adapters/types';
import { TopicMoveError } from '../adapters/topicMoveAdapter';
import { searchTopicsByKeyword } from '../hooks/data/useTopics';
import {
  refreshAfterTopicListMutation,
  refreshTopicsForActiveAgent,
  refreshTopicsForAgent,
} from '../hooks/data/invalidate';
import type { Topic, TopicThread } from '../domain/types';
import type { TopicContextUsage } from '../domain/types/contextUsage';
import { showToast } from '../services/ui/toast';
import { markPendingUserTopicSelection, topicRouteSyncState } from '../services/topic/topicRouteSync';
import { useAgentStore } from './agentStore';
import { useChatStore } from './chatStore';
import { useLayoutStore } from './layoutStore';
import { useRouteStore } from './routeStore';
import { suggestTopicTitleFromMessages } from '../utils/suggestTopicTitleFromMessages';
import { collectClientOnlyTopicIds } from '../services/topic/topicDeletion';
import {
  type TopicGroupMode,
  type TopicSortBy,
} from './types';

function removeTopicFromChatStore(topicId: string): void {
  useChatStore.setState((state) => {
    const { [topicId]: _removed, ...messagesByTopicId } = state.messagesByTopicId;
    return { messagesByTopicId };
  });
}

function activeAgentIdForTopicStorage(): string {
  return useAgentStore.getState().activeAgentId;
}

function applyLocalTopicsRemoval(
  get: () => TopicState,
  set: (partial: Partial<TopicState> | ((state: TopicState) => Partial<TopicState>)) => void,
  topicIds: string[],
): void {
  const idSet = new Set(topicIds);
  const { topics, activeTopicId, contextUsageByTopicId } = get();
  const nextTopics = topics.filter((t) => !idSet.has(t.id));
  const nextActive = idSet.has(activeTopicId) ? (nextTopics[0]?.id ?? '') : activeTopicId;
  const nextUsage = Object.fromEntries(
    Object.entries(contextUsageByTopicId).filter(([id]) => !idSet.has(id)),
  );
  const nextModelByTopicId = Object.fromEntries(
    Object.entries(get().modelByTopicId).filter(([id]) => !idSet.has(id)),
  );

  set({
    topics: nextTopics.map((t) => ({ ...t, active: t.id === nextActive })),
    activeTopicId: nextActive,
    contextUsageByTopicId: nextUsage,
    modelByTopicId: nextModelByTopicId,
  });

  topicIds.forEach((topicId) => {
    removeTopicFromChatStore(topicId);
    removeClientTopic(topicId);
    clearStoredTopicModel(topicId);
  });

  if (nextActive) {
    writeStoredActiveTopicId(nextActive, activeAgentIdForTopicStorage());
    const topic = nextTopics.find((t) => t.id === nextActive);
    if (topic?.status === 'temp') useRouteStore.getState().showHome();
    else if (topic) useRouteStore.getState().showConversation(topic.title);
  } else {
    clearStoredActiveTopicId(activeAgentIdForTopicStorage());
    useRouteStore.getState().showHome();
  }
}

async function persistTopicDeletion(
  topicIds: string[],
  options?: { clientOnlyIds?: Set<string> },
): Promise<void> {
  const uniqueIds = [...new Set(topicIds.filter(Boolean))];
  if (!isAgentConsoleApiMode() || uniqueIds.length === 0) return;

  const clientOnlyIds = options?.clientOnlyIds ?? new Set<string>();
  const serverIds = uniqueIds.filter(
    (id) => !clientOnlyIds.has(id) && !isEphemeralTopicId(id),
  );
  if (serverIds.length === 0) return;

  await Promise.all(serverIds.map((id) => getAgentConsolePorts().topic.deleteTopic(id)));
  const agentId = useAgentStore.getState().activeAgentId;
  await refreshTopicsForAgent(agentId);
}

function handleTopicDeletionFailure(
  topicIds: string[],
  clientOnlyIds: Set<string>,
  error: unknown,
): void {
  console.error('[agentConsole] delete topic failed', error);
  const needsServerRollback = topicIds.some((id) => !clientOnlyIds.has(id));
  if (!needsServerRollback) {
    showToast('删除话题失败');
    return;
  }
  showToast('删除话题失败，正在恢复列表…');
  void refreshTopicsForActiveAgent();
}
interface TopicState {
  /** @deprecated server list — prefer `useTopics()`; kept for bootstrap + local mutations */
  topics: Topic[];
  /** 按 agent 缓存的话题列表，切换 agent 时用于即时恢复侧栏 */
  topicsByAgentId: Record<string, Topic[]>;
  activeTopicId: string;
  /** Topic 级模型选择（override agent 默认） */
  modelByTopicId: Record<string, TopicModelSelection>;
  groupMode: TopicGroupMode;
  topicSortBy: TopicSortBy;
  topicPageSize: number;
  showCompleted: boolean;
  expandTopicGroupKeys: string[] | undefined;
  topicRenamingId: string;
  topicLoadingIds: string[];
  isRevalidating: boolean;
  isExpandingPageSize: boolean;
  isLoadingMoreTopics: boolean;
  allTopicsDrawerOpen: boolean;
  inSearchingMode: boolean;
  isSearchingTopic: boolean;
  searchTopics: Topic[];
  threadsByTopicId: Record<string, TopicThread[]>;
  elapsedByTopicId: Record<string, string>;
  contextUsageByTopicId: Record<string, TopicContextUsage>;

  hydrate: (
    snapshot: Pick<
      AgentConsoleSnapshot,
      'topics' | 'activeTopicId' | 'threadsByTopicId' | 'elapsedByTopicId'
    >,
  ) => void;
  setActiveTopicId: (id: string) => void;
  setGroupMode: (mode: TopicGroupMode) => void;
  setTopicSortBy: (sort: TopicSortBy) => void;
  setTopicPageSize: (size: number) => void;
  setShowCompleted: (show: boolean) => void;
  setExpandTopicGroupKeys: (keys: string[] | undefined) => void;
  setTopicRenamingId: (id: string) => void;
  batchMoveTopicsToAgent: (topicIds: string[], targetAgentId: string) => Promise<void>;
  getFilteredTopics: () => Topic[];
  getThreads: (topicId: string) => TopicThread[];
  tickElapsed: () => void;
  newTopic: () => void;
  openNewTopicOrSaveTopic: () => void;
  selectTopic: (id: string) => void;
  /** Restore topic model override from localStorage into memory. */
  ensureTopicModelLoaded: (topicId: string) => void;
  setTopicModelProvider: (topicId: string, selection: TopicModelSelection) => void;
  /** §C.54 — clear sidebar active highlight when entering sub-routes */
  suspendTopicSelection: () => void;
  updateTopicTitle: (id: string, title: string) => void;
  setTopicWorkingDirectory: (id: string, workingDirectory?: string) => void;
  toggleFavorite: (topicId: string) => void;
  removeTopic: (topicId: string) => void;
  markTopicCompleted: (topicId: string) => void;
  unmarkTopicCompleted: (topicId: string) => void;
  autoRenameTopicTitle: (topicId: string) => void;
  duplicateTopic: (topicId: string) => void;
  importTopic: (fileName: string, payload?: TopicImportPayload) => void;
  removeUnstarredTopics: () => void;
  removeAllSessionTopics: () => void;
  revalidateTopics: () => void;
  loadMoreTopics: () => void;
  openAllTopicsDrawer: () => void;
  closeAllTopicsDrawer: () => void;
  searchTopicsForKeyword: (keyword: string) => Promise<void>;
  startTopicSearch: (keyword: string) => void;
  resetTopicSearchMode: () => void;
  clearTopicSearch: () => void;
  setTopicContextUsage: (topicId: string, usage: TopicContextUsage) => void;
}

/** Pure filter*/
export function filterTopics(topics: Topic[], showCompleted: boolean, agentId?: string): Topic[] {
  const scoped = agentId ? filterTopicsForAgent(topics, agentId) : topics;
  if (showCompleted) return scoped;
  return scoped.filter((t) => t.status !== 'completed');
}

export const useTopicStore = create<TopicState>((set, get) => ({
  topics: [],
  topicsByAgentId: {},
  activeTopicId: '',
  modelByTopicId: {},
  groupMode: 'byTime',
  topicSortBy: 'updatedAt',
  topicPageSize: 40,
  showCompleted: true,
  expandTopicGroupKeys: undefined,
  topicRenamingId: '',
  topicLoadingIds: [],
  isRevalidating: false,
  isExpandingPageSize: false,
  isLoadingMoreTopics: false,
  allTopicsDrawerOpen: false,
  inSearchingMode: false,
  isSearchingTopic: false,
  searchTopics: [],
  threadsByTopicId: {},
  elapsedByTopicId: {},
  contextUsageByTopicId: {},

  hydrate: (snapshot) =>
    set((state) => {
      const agentId = activeAgentIdForTopicStorage();
      const activeTopicId = snapshot.activeTopicId;
      const storedModel = activeTopicId ? readStoredTopicModel(activeTopicId) : null;
      return {
        topics: snapshot.topics,
        activeTopicId,
        threadsByTopicId: snapshot.threadsByTopicId,
        elapsedByTopicId: snapshot.elapsedByTopicId,
        topicsByAgentId: agentId
          ? { ...state.topicsByAgentId, [agentId]: snapshot.topics }
          : state.topicsByAgentId,
        modelByTopicId: storedModel
          ? { ...state.modelByTopicId, [activeTopicId]: storedModel }
          : state.modelByTopicId,
      };
    }),

  setActiveTopicId: (id) =>
    set((s) => {
      if (isAgentConsoleApiMode()) {
        writeStoredActiveTopicId(id, activeAgentIdForTopicStorage());
      }
      if (s.activeTopicId === id && s.topics.every((t) => t.active === (t.id === id))) {
        return s;
      }
      const storedModel = id ? readStoredTopicModel(id) : null;
      return {
        activeTopicId: id,
        topics: s.topics.map((t) => ({ ...t, active: t.id === id })),
        modelByTopicId: storedModel ? { ...s.modelByTopicId, [id]: storedModel } : s.modelByTopicId,
      };
    }),

  setGroupMode: (mode) => set({ groupMode: mode, expandTopicGroupKeys: undefined }),
  setTopicSortBy: (sort) => set({ topicSortBy: sort, expandTopicGroupKeys: undefined }),
  setTopicPageSize: (size) => set({ topicPageSize: size }),
  setShowCompleted: (show) => set({ showCompleted: show }),
  setExpandTopicGroupKeys: (keys) =>
    set((s) => {
      const prev = s.expandTopicGroupKeys;
      if (prev === keys) return s;
      if (prev && keys && prev.length === keys.length && prev.every((k, i) => k === keys[i])) {
        return s;
      }
      return { expandTopicGroupKeys: keys };
    }),
  setTopicRenamingId: (id) => set({ topicRenamingId: id }),

  batchMoveTopicsToAgent: async (topicIds, targetAgentId) => {
    try {
      await getAgentConsolePorts().topic.batchMove(topicIds, targetAgentId);
    } catch (err) {
      const message = err instanceof TopicMoveError ? err.message : '移动失败，请重试';
      showToast(message);
      throw err;
    }
    const state = get();
    const movedActive = topicIds.includes(state.activeTopicId);
    const sourceAgentId = useAgentStore.getState().activeAgentId;
    set((s) => ({
      topics: s.topics.map((t) =>
        topicIds.includes(t.id) ? { ...t, agentId: targetAgentId } : t,
      ),
    }));
    useAgentStore.getState().setActiveAgentId(targetAgentId);
    if (movedActive) {
      get().selectTopic(state.activeTopicId);
    }
    void refreshAfterTopicListMutation(sourceAgentId, targetAgentId);
    showToast(`已移动 ${topicIds.length} 个话题`);
  },

  getFilteredTopics: () => {
    const { topics, showCompleted } = get();
    return filterTopics(topics, showCompleted, activeAgentIdForTopicStorage());
  },

  getThreads: (topicId) => get().threadsByTopicId[topicId] ?? [],

  tickElapsed: () => {
    set((s) => {
      const next = { ...s.elapsedByTopicId };
      for (const t of s.topics) {
        if (t.status === 'running' && next[t.id]) {
          const [m, sec] = next[t.id].split(':').map(Number);
          const total = (m || 0) * 60 + (sec || 0) + 1;
          next[t.id] = `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
        }
      }
      return { elapsedByTopicId: next };
    });
  },

  newTopic: () => {
    const agentId = activeAgentIdForTopicStorage();
    const state = get();
    const existingTemp = state.topics.find(
      (topic) => topic.status === 'temp' && topic.agentId === agentId,
    );
    // 已出现在侧栏的 id（含已落库会话）不得再当空草稿恢复，否则会同 id 双条目双高亮并覆盖旧会话。
    const storedEmptyTemp = findEmptyTempClientTopicForAgent(agentId, {
      excludeTopicIds: state.topics.map((topic) => topic.id),
    });

    if (existingTemp) {
      get().selectTopic(existingTemp.id);
      useRouteStore.getState().showHome();
      return;
    }

    if (storedEmptyTemp) {
      const restored = clientRecordToTempTopic(storedEmptyTemp, agentId);
      if (!topicRouteSyncState.suppressStoreToUrl) {
        markPendingUserTopicSelection(restored.id);
      }
      set((s) => ({
        topics: [
          { ...restored, active: true },
          ...s.topics
            .filter((t) => t.id !== restored.id && t.status !== 'temp')
            .map((t) => ({ ...t, active: false })),
        ],
        activeTopicId: restored.id,
      }));
      if (isAgentConsoleApiMode()) {
        writeStoredActiveTopicId(restored.id, agentId);
      }
      useChatStore.getState().setMessages(restored.id, []);
      useRouteStore.getState().showHome();
      if (useLayoutStore.getState().isCompactViewport) {
        useLayoutStore.getState().setSidebarCollapsed(true);
      }
      return;
    }

    pruneEmptyTempClientTopicsForAgent(agentId);

    const topicId = generateTopicId();
    const now = new Date().toISOString();
    const tempTopic: Topic = {
      id: topicId,
      title: '新话题',
      status: 'temp',
      tag: '临时',
      agentId: agentId || undefined,
      createdAt: now,
      updatedAt: now,
      active: true,
    };
    saveClientTopic({
      id: topicId,
      title: tempTopic.title,
      agentId: agentId || undefined,
      messages: [],
      createdAt: now,
    });
    if (!topicRouteSyncState.suppressStoreToUrl) {
      markPendingUserTopicSelection(topicId);
    }
    set((s) => ({
      topics: [
        tempTopic,
        ...s.topics
          .filter((t) => t.status !== 'temp')
          .map((t) => ({ ...t, active: false })),
      ],
      activeTopicId: topicId,
    }));
    if (isAgentConsoleApiMode()) {
      writeStoredActiveTopicId(topicId, agentId);
    }
    useChatStore.getState().setMessages(topicId, []);
    useRouteStore.getState().showHome();
    if (useLayoutStore.getState().isCompactViewport) {
      useLayoutStore.getState().setSidebarCollapsed(true);
    }
  },

  /** §C.55*/
  openNewTopicOrSaveTopic: () => {
    const state = get();
    const activeTopic = state.topics.find((t) => t.id === state.activeTopicId);
    const messages = useChatStore.getState().getMessages(state.activeTopicId);

    if (
      activeTopic &&
      activeTopic.status !== 'temp' &&
      messages.length > 0 &&
      activeTopic.status !== 'completed'
    ) {
      void getAgentConsolePorts().topic.saveSnapshot(state.activeTopicId).then(() => {
        set((s) => ({
          topics: s.topics.map((t) =>
            t.id === state.activeTopicId
              ? { ...t, status: 'completed' as const, updatedAt: new Date().toISOString() }
              : t,
          ),
        }));
        showToast('已保存当前话题');
        get().newTopic();
      });
      return;
    }
    get().newTopic();
  },

  selectTopic: (id) => {
    const state = get();
    const topic = state.topics.find((t) => t.id === id);
    if (!topic) return;

    const needsUnreadClear = topic.status === 'unread';
    const sameTopic = state.activeTopicId === id;

    if (sameTopic && !needsUnreadClear) {
      if (topic.status === 'temp') {
        useRouteStore.getState().showHome();
      } else {
        useRouteStore.getState().showConversation(topic.title);
      }
      if (useLayoutStore.getState().isCompactViewport) {
        useLayoutStore.getState().setSidebarCollapsed(true);
      }
      return;
    }

    if (!topicRouteSyncState.suppressStoreToUrl) {
      markPendingUserTopicSelection(id);
    }
    set((s) => {
      const storedModel = readStoredTopicModel(id);
      return {
        activeTopicId: id,
        topics: s.topics.map((t) => {
          if (t.id === id && t.status === 'unread') {
            return { ...t, status: 'completed' as const, active: true };
          }
          return { ...t, active: t.id === id };
        }),
        modelByTopicId: storedModel
          ? { ...s.modelByTopicId, [id]: storedModel }
          : s.modelByTopicId,
      };
    });
    if (isAgentConsoleApiMode()) {
      writeStoredActiveTopicId(id, activeAgentIdForTopicStorage());
    }
    if (topic?.status === 'temp') {
      useRouteStore.getState().showHome();
    } else if (topic) {
      useRouteStore.getState().showConversation(topic.title);
    }
    if (useLayoutStore.getState().isCompactViewport) {
      useLayoutStore.getState().setSidebarCollapsed(true);
    }
    if (get().allTopicsDrawerOpen) {
      set({ allTopicsDrawerOpen: false });
    }
    if (useLayoutStore.getState().mobileTopicModalOpen) {
      useLayoutStore.getState().setMobileTopicModalOpen(false);
    }
  },

  setTopicModelProvider: (topicId, selection) => {
    if (!topicId) return;
    writeStoredTopicModel(topicId, selection);
    set((s) => ({
      modelByTopicId: { ...s.modelByTopicId, [topicId]: selection },
    }));
  },

  ensureTopicModelLoaded: (topicId) => {
    hydrateTopicModelFromStorage(topicId);
  },

  suspendTopicSelection: () => {
    set((s) => ({
      topics: s.topics.map((t) => ({ ...t, active: false })),
    }));
  },

  updateTopicTitle: (id, title) => {
    const trimmed = title.trim();
    if (!trimmed) {
      set({ topicRenamingId: '' });
      return;
    }

    set((s) => ({
      topics: s.topics.map((t) => (t.id === id ? { ...t, title: trimmed } : t)),
      topicRenamingId: '',
    }));

    if (isAgentConsoleApiMode() && !isEphemeralTopicId(id)) {
      void getAgentConsolePorts()
        .topic.renameTopic(id, trimmed)
        .then(() => refreshTopicsForActiveAgent())
        .catch((error) => {
          console.error('[agentConsole] rename topic failed', error);
          showToast('重命名保存失败');
        });
    }
  },

  setTopicWorkingDirectory: (id, workingDirectory) =>
    set((s) => ({
      topics: s.topics.map((t) =>
        t.id === id ? { ...t, workingDirectory: workingDirectory || undefined } : t,
      ),
    })),

  toggleFavorite: (topicId) =>
    set((s) => ({
      topics: s.topics.map((t) =>
        t.id === topicId ? { ...t, fav: !t.fav, tag: !t.fav ? 'fav' : t.tag === 'fav' ? undefined : t.tag } : t,
      ),
    })),

  removeTopic: (topicId) => {
    if (!topicId) return;
    const clientOnlyIds = collectClientOnlyTopicIds([topicId], get().topics);
    applyLocalTopicsRemoval(get, set, [topicId]);

    void persistTopicDeletion([topicId], { clientOnlyIds }).catch((error) => {
      handleTopicDeletionFailure([topicId], clientOnlyIds, error);
    });
  },

  markTopicCompleted: (topicId) =>
    set((s) => ({
      topics: s.topics.map((t) =>
        t.id === topicId ? { ...t, status: 'completed' as const } : t,
      ),
    })),

  unmarkTopicCompleted: (topicId) =>
    set((s) => ({
      topics: s.topics.map((t) =>
        // 取消「已完成」后回到可继续对话的中性态（Hash 图标），不要标成 running 转圈。
        t.id === topicId && t.status === 'completed'
          ? { ...t, status: 'platform' as const, platform: t.platform }
          : t,
      ),
    })),

  autoRenameTopicTitle: (topicId) => {
    const topic = get().topics.find((t) => t.id === topicId);
    if (!topic) return;

    const messages = useChatStore.getState().getMessages(topicId);
    const suggested = suggestTopicTitleFromMessages(messages);
    const generated = suggested || `${topic.title.slice(0, 12)} · 新话题`;

    if (generated === topic.title) {
      showToast('标题已是最新');
      return;
    }

    get().updateTopicTitle(topicId, generated);
    showToast('已智能重命名');
  },

  duplicateTopic: (topicId) => {
    const source = get().topics.find((t) => t.id === topicId);
    if (!source?.id) return;
    const newId = generateTopicId();
    set((s) => ({
      topics: [
        { ...source, active: false, id: newId, title: `${source.title} (副本)` },
        ...s.topics,
      ],
    }));
    showToast('已复制话题');
  },

  importTopic: (fileName, payload) => {
    if (!payload?.messages?.length) {
      showToast('导入失败：缺少消息数据');
      return;
    }
    void getAgentConsolePorts()
      .topic.persistImport(payload, fileName)
      .then(({ id, title }) => {
        set((s) => ({
          activeTopicId: id,
          topics: [
            {
              active: true,
              id,
              status: 'completed',
              title,
              agentId: activeAgentIdForTopicStorage() || undefined,
              updatedAt: new Date().toISOString(),
            },
            ...s.topics.map((t) => ({ ...t, active: false })),
          ],
        }));
        if (isAgentConsoleApiMode()) {
          writeStoredActiveTopicId(id, activeAgentIdForTopicStorage());
        }
        useChatStore.getState().setMessages(id, []);
        useRouteStore.getState().showConversation(title);
        void refreshTopicsForAgent(useAgentStore.getState().activeAgentId);
        showToast(`已导入话题：${title}`);
      })
      .catch((error) => {
        console.error('[agentConsole] import topic failed', error);
        showToast(error instanceof Error ? error.message : '导入失败');
      });
  },

  removeUnstarredTopics: () => {
    const removedIds = get()
      .topics.filter((t) => !(t.fav || t.tag === 'fav' || t.status === 'temp'))
      .map((t) => t.id);
    if (removedIds.length === 0) return;
    const clientOnlyIds = collectClientOnlyTopicIds(removedIds, get().topics);
    applyLocalTopicsRemoval(get, set, removedIds);
    void persistTopicDeletion(removedIds, { clientOnlyIds })
      .then(() => showToast('已删除未收藏话题'))
      .catch((error) => {
        handleTopicDeletionFailure(removedIds, clientOnlyIds, error);
      });
  },

  removeAllSessionTopics: () => {
    const removedIds = get()
      .topics.filter((t) => t.status !== 'temp')
      .map((t) => t.id);
    if (removedIds.length === 0) return;
    const clientOnlyIds = collectClientOnlyTopicIds(removedIds, get().topics);
    applyLocalTopicsRemoval(get, set, removedIds);
    void persistTopicDeletion(removedIds, { clientOnlyIds })
      .then(() => showToast('已删除全部话题'))
      .catch((error) => {
        handleTopicDeletionFailure(removedIds, clientOnlyIds, error);
      });
  },

  revalidateTopics: () => {
    if (isAgentConsoleApiMode()) {
      set({ isRevalidating: true });
      void refreshTopicsForActiveAgent()
        .catch((error) => {
          console.error('[agentConsole] topic revalidation failed', error);
        })
        .finally(() => {
          set({ isRevalidating: false });
        });
      return;
    }
    set({ isRevalidating: true });
    window.setTimeout(() => set({ isRevalidating: false }), 1200);
  },

  loadMoreTopics: () => {
    const { isExpandingPageSize, isLoadingMoreTopics, topicPageSize } = get();
    if (isExpandingPageSize || isLoadingMoreTopics) return;
    set({ isExpandingPageSize: true, isLoadingMoreTopics: true });
    window.setTimeout(() => {
      set({
        isExpandingPageSize: false,
        isLoadingMoreTopics: false,
        topicPageSize: topicPageSize + 20,
      });
    }, 320);
  },

  openAllTopicsDrawer: () => set({ allTopicsDrawerOpen: true }),

  closeAllTopicsDrawer: () => set({ allTopicsDrawerOpen: false }),

  searchTopicsForKeyword: async (keyword) => {
    const trimmed = keyword.trim();
    if (!trimmed) {
      set({ isSearchingTopic: false, searchTopics: [] });
      return;
    }
    set({ isSearchingTopic: true });
    const all = filterTopics(get().topics, get().showCompleted);
    const results = await searchTopicsByKeyword(trimmed, all);
    set({ isSearchingTopic: false, searchTopics: results });
  },

  startTopicSearch: (keyword) => {
    const trimmed = keyword.trim();
    const hasKeyword = trimmed.length > 0;
    set({ inSearchingMode: hasKeyword, isSearchingTopic: hasKeyword });
    if (hasKeyword) {
      void get().searchTopicsForKeyword(trimmed);
    } else {
      set({ searchTopics: [] });
    }
  },

  resetTopicSearchMode: () => set({ inSearchingMode: false, isSearchingTopic: false }),

  clearTopicSearch: () => set({ isSearchingTopic: false, searchTopics: [] }),

  setTopicContextUsage: (topicId, usage) =>
    set((s) => ({
      contextUsageByTopicId: {
        ...s.contextUsageByTopicId,
        [topicId]: usage,
      },
    })),
}));
