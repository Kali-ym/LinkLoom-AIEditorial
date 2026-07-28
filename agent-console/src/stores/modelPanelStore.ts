import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { GroupMode } from '../features/ChatInput/ModelSwitchPanel/types';

const STORAGE_KEY = 'agent-console-model-panel';

interface ModelPanelState {
  groupMode: GroupMode;
  panelWidth: number;
  setGroupMode: (mode: GroupMode) => void;
  setPanelWidth: (width: number) => void;
}

/** §C.42*/
export const useModelPanelStore = create<ModelPanelState>()(
  persist(
    (set) => ({
      groupMode: 'byModel',
      panelWidth: 320,
      setGroupMode: (groupMode) => set({ groupMode }),
      setPanelWidth: (panelWidth) => set({ panelWidth }),
    }),
    { name: STORAGE_KEY },
  ),
);
