import { create } from 'zustand';

import { DEFAULT_CONVERSATION_TITLE, DEFAULT_HOME_CHAT_TITLE } from './types';

type RouteView = 'home' | 'conversation';

interface RouteState {
  view: RouteView;
  chatTitle: string;
  showHome: () => void;
  showConversation: (title?: string) => void;
}

export const useRouteStore = create<RouteState>((set) => ({
  view: 'conversation',
  chatTitle: DEFAULT_CONVERSATION_TITLE,

  showHome: () =>
    set({
      view: 'home',
      chatTitle: DEFAULT_HOME_CHAT_TITLE,
    }),

  showConversation: (title) =>
    set((s) => ({
      view: 'conversation',
      chatTitle: title ?? s.chatTitle,
    })),
}));
