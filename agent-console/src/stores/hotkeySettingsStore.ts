import { create } from 'zustand';

import { getHotkeyRegistryItem } from '../constants/hotkeyRegistry';

const HOTKEY_SETTINGS_STORAGE_KEY = 'linkloom-agent-console-hotkeys';

function loadOverrides(): Record<string, string> {
  try {
    const raw = localStorage.getItem(HOTKEY_SETTINGS_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

function persistOverrides(overrides: Record<string, string>): void {
  try {
    localStorage.setItem(HOTKEY_SETTINGS_STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    /* ignore quota */
  }
}

interface HotkeySettingsState {
  overrides: Record<string, string>;

  getKeys: (id: string) => string;
  setKeys: (id: string, keys: string) => void;
  resetKeys: (id: string) => void;
}

export const useHotkeySettingsStore = create<HotkeySettingsState>((set, get) => ({
  overrides: loadOverrides(),

  getKeys: (id) => {
    const override = get().overrides[id];
    if (override) return override;
    return getHotkeyRegistryItem(id)?.keys ?? '';
  },

  setKeys: (id, keys) => {
    const item = getHotkeyRegistryItem(id);
    if (!item || item.nonEditable) return;
    const overrides = { ...get().overrides, [id]: keys };
    persistOverrides(overrides);
    set({ overrides });
  },

  resetKeys: (id) => {
    const overrides = { ...get().overrides };
    delete overrides[id];
    persistOverrides(overrides);
    set({ overrides });
  },
}));

export const hotkeySettingsSelectors = {
  getKeys:
    (id: string) =>
    (s: HotkeySettingsState): string =>
      s.getKeys(id),
};
