import { create } from 'zustand';

import { getAgentConsolePorts } from '../adapters/registry';
import { makeShareId } from '../adapters/shareUtils';
import type { ShareVisibility, TopicShareInfo } from '../domain/types';
import type { AgentConsoleSnapshot } from '../adapters/types';

interface ShareState {
  shareByTopicId: Record<string, TopicShareInfo>;

  hydrate: (snapshot: Pick<AgentConsoleSnapshot, 'shareByTopicId'>) => void;
  getShareInfo: (topicId: string) => TopicShareInfo | undefined;
  ensureShareRecord: (topicId: string) => TopicShareInfo;
  updateVisibility: (topicId: string, visibility: ShareVisibility) => Promise<TopicShareInfo>;
}

export const useShareStore = create<ShareState>((set, get) => ({
  shareByTopicId: {},

  hydrate: (snapshot) => set({ shareByTopicId: snapshot.shareByTopicId }),

  getShareInfo: (topicId) => get().shareByTopicId[topicId],

  ensureShareRecord: (topicId) => {
    const existing = get().shareByTopicId[topicId];
    if (existing) return existing;

    const created: TopicShareInfo = {
      topicId,
      shareId: makeShareId(topicId),
      visibility: 'private',
    };
    set((s) => ({
      shareByTopicId: { ...s.shareByTopicId, [topicId]: created },
    }));
    return created;
  },

  updateVisibility: async (topicId, visibility) => {
    const updated = await getAgentConsolePorts().share.updateVisibility(topicId, visibility);
    set((s) => ({
      shareByTopicId: {
        ...s.shareByTopicId,
        [topicId]: updated,
      },
    }));
    return updated;
  },
}));
