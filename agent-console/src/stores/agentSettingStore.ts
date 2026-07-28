import { create } from 'zustand';

interface AgentSettingState {
  open: boolean;
  tab: 'general' | 'params' | 'tools';
  openAgentSetting: (tab?: AgentSettingState['tab']) => void;
  closeAgentSetting: () => void;
  setTab: (tab: AgentSettingState['tab']) => void;
}

/** §C.55*/
export const useAgentSettingStore = create<AgentSettingState>((set) => ({
  open: false,
  tab: 'general',
  openAgentSetting: (tab = 'general') => set({ open: true, tab }),
  closeAgentSetting: () => set({ open: false }),
  setTab: (tab) => set({ tab }),
}));
