import { create } from 'zustand';

interface CommandMenuState {
  showCommandMenu: boolean;
  toggleCommandMenu: (visible?: boolean) => void;
}

export const useCommandMenuStore = create<CommandMenuState>((set, get) => ({
  showCommandMenu: false,

  toggleCommandMenu: (visible) => {
    if (typeof visible === 'boolean') {
      set({ showCommandMenu: visible });
      return;
    }
    set({ showCommandMenu: !get().showCommandMenu });
  },
}));
