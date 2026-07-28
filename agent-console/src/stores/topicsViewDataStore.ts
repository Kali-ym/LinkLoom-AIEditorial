import { create } from 'zustand';

import { getAgentConsolePorts } from '../adapters/registry';
import { TOPICS_VIEW_API_PAGE_SIZE } from '../adapters/topicsViewApiAdapter';
import { enrichTopicsForView } from '../adapters/topicViewAdapter';
import type { TopicViewItem } from '../domain/types/topicView';
import { filterTopics, useTopicStore } from './topicStore';

export { TOPICS_VIEW_API_PAGE_SIZE as TOPICS_VIEW_PAGE_SIZE };

interface TopicsViewDataState {
  agentId: string | null;
  items: TopicViewItem[];
  currentPage: number;
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;

  hydrateForAgent: (agentId: string) => Promise<void>;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  getAllEnriched: () => TopicViewItem[];
}

function getSourceTopics(): TopicViewItem[] {
  const { topics, showCompleted } = useTopicStore.getState();
  return enrichTopicsForView(filterTopics(topics, showCompleted));
}

/** §C.53 — management view data via topic port */
export const useTopicsViewDataStore = create<TopicsViewDataState>((set, get) => ({
  agentId: null,
  items: [],
  currentPage: 1,
  hasMore: false,
  isLoading: false,
  isLoadingMore: false,

  getAllEnriched: () => getSourceTopics(),

  hydrateForAgent: async (agentId) => {
    set({ agentId, isLoading: true, currentPage: 1 });
    const sourceItems = getSourceTopics();
    const result = await getAgentConsolePorts().topic.fetchTopicsViewPage({
      agentId,
      page: 1,
      sourceItems,
    });
    set({
      items: result.items,
      hasMore: result.hasMore,
      isLoading: false,
      isLoadingMore: false,
    });
  },

  loadMore: async () => {
    const { agentId, currentPage, hasMore, isLoadingMore } = get();
    if (!agentId || !hasMore || isLoadingMore) return;
    set({ isLoadingMore: true });
    const sourceItems = getSourceTopics();
    const nextPage = currentPage + 1;
    const result = await getAgentConsolePorts().topic.fetchTopicsViewPage({
      agentId,
      page: nextPage,
      sourceItems,
    });
    set({
      currentPage: nextPage,
      items: result.items,
      hasMore: result.hasMore,
      isLoadingMore: false,
    });
  },

  refresh: async () => {
    const agentId = get().agentId;
    if (!agentId) return;
    await get().hydrateForAgent(agentId);
  },
}));
