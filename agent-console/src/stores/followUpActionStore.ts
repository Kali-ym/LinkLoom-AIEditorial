import { create } from 'zustand';

import { getAgentConsolePorts } from '../adapters/registry';
import type { FollowUpChip } from '../domain/types/followUp';

export function followUpSlotKey(conversationKey: string, messageId: string): string {
  return `${conversationKey}::${messageId}`;
}

const EMPTY_CHIPS: FollowUpChip[] = [];

interface FollowUpActionState {
  chipsBySlot: Record<string, FollowUpChip[]>;

  getChips: (conversationKey: string, messageId: string) => FollowUpChip[];
  fetchFor: (conversationKey: string, params: { messageId: string; topicId: string; threadId?: string }) => Promise<void>;
  clear: (conversationKey: string) => void;
}

export const useFollowUpActionStore = create<FollowUpActionState>((set, get) => ({
  chipsBySlot: {},

  getChips: (conversationKey, messageId) => {
    return get().chipsBySlot[followUpSlotKey(conversationKey, messageId)] ?? EMPTY_CHIPS;
  },

  fetchFor: async (conversationKey, params) => {
    const chips = await getAgentConsolePorts().runtime.fetchFollowUpChips({
      conversationKey,
      messageId: params.messageId,
      topicId: params.topicId,
      threadId: params.threadId,
    });
    if (chips.length === 0) return;
    set((s) => ({
      chipsBySlot: {
        ...s.chipsBySlot,
        [followUpSlotKey(conversationKey, params.messageId)]: chips,
      },
    }));
  },

  clear: (conversationKey) =>
    set((s) => {
      const prefix = `${conversationKey}::`;
      const next: Record<string, FollowUpChip[]> = {};
      for (const [key, value] of Object.entries(s.chipsBySlot)) {
        if (!key.startsWith(prefix)) next[key] = value;
      }
      return { chipsBySlot: next };
    }),
}));
