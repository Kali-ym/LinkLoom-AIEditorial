import { create } from 'zustand';

import type { AuthorInfo, ConsoleConfig } from '../domain/types';
import type { AgentConsoleSnapshot } from '../adapters/types';

interface ConfigState extends ConsoleConfig {
  hideTopicSharePrivacyWarning: boolean;
  authorsByUserId: Record<string, AuthorInfo>;
  useCmdEnterToSend: boolean;
  knowledgeBaseModalViewMode: 'list' | 'masonry';

  hydrate: (
    snapshot: Pick<AgentConsoleSnapshot, 'config' | 'authorsByUserId'>,
  ) => void;
  setHideTopicSharePrivacyWarning: (hide: boolean) => void;
  setUseCmdEnterToSend: (value: boolean) => void;
  setKnowledgeBaseModalViewMode: (mode: 'list' | 'masonry') => void;
}

export const useConfigStore = create<ConfigState>((set) => ({
  enableBusinessFeatures: true,
  documentCompareDocId: undefined,
  showInputFootnote: true,
  isDevMode: false,
  enableKnowledgeBase: true,
  enableGatewayMode: true,
  enableFC: true,
  showProviderSearch: true,
  enableInputMarkdown: true,
  hideTopicSharePrivacyWarning: false,
  authorsByUserId: {},
  useCmdEnterToSend: false,
  knowledgeBaseModalViewMode: 'list',

  hydrate: (snapshot) =>
    set({
      enableBusinessFeatures: snapshot.config.enableBusinessFeatures,
      documentCompareDocId: snapshot.config.documentCompareDocId,
      showInputFootnote: snapshot.config.showInputFootnote ?? true,
      isDevMode: snapshot.config.isDevMode ?? false,
      enableKnowledgeBase: snapshot.config.enableKnowledgeBase ?? true,
      enableGatewayMode: snapshot.config.enableGatewayMode ?? true,
      enableFC: snapshot.config.enableFC ?? true,
      showProviderSearch: snapshot.config.showProviderSearch ?? true,
      enableInputMarkdown: snapshot.config.enableInputMarkdown ?? true,
    }),

  setHideTopicSharePrivacyWarning: (hide) => set({ hideTopicSharePrivacyWarning: hide }),
  setUseCmdEnterToSend: (value) => set({ useCmdEnterToSend: value }),
  setKnowledgeBaseModalViewMode: (mode) => set({ knowledgeBaseModalViewMode: mode }),
}));
