import { create } from 'zustand';

import { useLayoutStore } from './layoutStore';
import type { PortalFrame, PortalViewType } from './types';

interface PortalState {
  stack: PortalFrame[];
  mobileOpen: boolean;

  pushPortalView: (type: PortalViewType, payload?: Record<string, unknown>) => void;
  replacePortalView: (type: PortalViewType, payload?: Record<string, unknown>) => void;
  resetPortalView: (type: PortalViewType, payload?: Record<string, unknown>) => void;
  goHomePortal: () => void;
  goBackPortal: () => void;
  clearPortalStack: () => void;
  setMobileOpen: (open: boolean) => void;
  patchCurrentPayload: (patch: Record<string, unknown>) => void;
  currentView: () => PortalFrame | null;
}

function syncPortalLayout(open: boolean): void {
  const layout = useLayoutStore.getState();
  layout.setPortalOpen(open);
  layout.applyCssVars();
  layout.syncLayoutBackdrops();
}

export const usePortalStore = create<PortalState>((set, get) => ({
  stack: [],
  mobileOpen: false,

  pushPortalView: (type, payload = {}) => {
    set((s) => {
      const top = s.stack[s.stack.length - 1];
      const frame = { type, payload };
      if (top?.type === type) {
        return { stack: [...s.stack.slice(0, -1), frame] };
      }
      return { stack: [...s.stack, frame] };
    });
    syncPortalLayout(true);
    useLayoutStore.getState().clampPortalWidthForView();
  },

  replacePortalView: (type, payload = {}) => {
    const frame = { type, payload };
    set((s) => {
      if (s.stack.length === 0) {
        return { stack: [frame] };
      }
      return { stack: [...s.stack.slice(0, -1), frame] };
    });
    syncPortalLayout(true);
    useLayoutStore.getState().clampPortalWidthForView();
  },

  resetPortalView: (type, payload = {}) => {
    set({ stack: [{ type, payload }] });
    syncPortalLayout(true);
    useLayoutStore.getState().clampPortalWidthForView();
  },

  goHomePortal: () => {
    set({ stack: [{ type: 'Home', payload: {} }] });
    syncPortalLayout(true);
  },

  goBackPortal: () => {
    const { stack } = get();
    if (stack.length <= 1) {
      set({ stack: [], mobileOpen: false });
      syncPortalLayout(false);
      return;
    }
    set({ stack: stack.slice(0, -1) });
  },

  clearPortalStack: () => {
    set({ stack: [], mobileOpen: false });
    syncPortalLayout(false);
  },

  setMobileOpen: (open) => set({ mobileOpen: open }),

  patchCurrentPayload: (patch) => {
    set((s) => {
      const top = s.stack[s.stack.length - 1];
      if (!top) return s;
      return {
        stack: [...s.stack.slice(0, -1), { ...top, payload: { ...top.payload, ...patch } }],
      };
    });
  },

  currentView: () => {
    const { stack } = get();
    return stack.length ? stack[stack.length - 1] : null;
  },
}));
