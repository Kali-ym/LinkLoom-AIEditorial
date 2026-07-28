import type { LayoutState } from '../stores/layoutStore';

/** §C.58*/
export const systemStatusSelectors = {
  showChatHeader: (s: LayoutState) => !s.zenMode,
  showTaskAgentPanel: (s: LayoutState) => !s.zenMode && s.showTaskAgentPanel,
};
