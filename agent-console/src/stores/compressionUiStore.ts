import { create } from 'zustand';

import type { CompressedGroupTab } from '../domain/types/messageBlocks';

interface CompressionUiState {
  expandedByMessageId: Record<string, boolean>;
  activeTabByMessageId: Record<string, CompressedGroupTab>;

  isExpanded: (messageId: string, defaultExpanded?: boolean) => boolean;
  toggleExpanded: (messageId: string) => void;
  setActiveTab: (messageId: string, tab: CompressedGroupTab) => void;
  getActiveTab: (messageId: string) => CompressedGroupTab;
}

export const useCompressionUiStore = create<CompressionUiState>((set, get) => ({
  expandedByMessageId: {},
  activeTabByMessageId: {},

  isExpanded: (messageId, defaultExpanded = true) =>
    get().expandedByMessageId[messageId] ?? defaultExpanded,

  toggleExpanded: (messageId) =>
    set((s) => ({
      expandedByMessageId: {
        ...s.expandedByMessageId,
        [messageId]: !(s.expandedByMessageId[messageId] ?? true),
      },
    })),

  setActiveTab: (messageId, tab) =>
    set((s) => ({
      activeTabByMessageId: { ...s.activeTabByMessageId, [messageId]: tab },
    })),

  getActiveTab: (messageId) => get().activeTabByMessageId[messageId] ?? 'summary',
}));
