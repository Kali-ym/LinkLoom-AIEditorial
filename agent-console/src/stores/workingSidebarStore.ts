import { create } from 'zustand';

import type { ResourceFilter, WorkingSidebarTab } from './types';
import { useLayoutStore } from './layoutStore';

interface OpenWorkingSidebarOptions {
  tab?: WorkingSidebarTab;
  resourceFilter?: ResourceFilter;
}

interface WorkingSidebarState {
  tab: WorkingSidebarTab;
  resourceFilter: ResourceFilter;
  mounted: boolean;

  setTab: (tab: WorkingSidebarTab) => void;
  setResourceFilter: (filter: ResourceFilter) => void;
  setMounted: (mounted: boolean) => void;
  openWorkingSidebar: (options?: OpenWorkingSidebarOptions) => void;
}

export const useWorkingSidebarStore = create<WorkingSidebarState>((set, get) => ({
  tab: 'space',
  resourceFilter: 'skills',
  mounted: true,

  setTab: (tab) => set({ tab }),
  setResourceFilter: (filter) => set({ resourceFilter: filter }),
  setMounted: (mounted) => set({ mounted }),

  openWorkingSidebar: (options) => {
    const tab = options?.tab ?? 'space';
    const resourceFilter =
      options?.resourceFilter ?? (tab === 'space' ? 'skills' : get().resourceFilter);
    useLayoutStore.getState().setRightPanelOpen(true);
    set({ tab, resourceFilter });
  },
}));
