import { create } from 'zustand';

interface HotkeyHelperState {
  open: boolean;
  toggle: () => void;
  setOpen: (open: boolean) => void;
}

/** §C.55*/
export const useHotkeyHelperStore = create<HotkeyHelperState>((set) => ({
  open: false,
  toggle: () => set((s) => ({ open: !s.open })),
  setOpen: (open) => set({ open }),
}));
