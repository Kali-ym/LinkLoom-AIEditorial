import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  INTERVENTION_SETTINGS_STORAGE_KEY,
  loadInterventionSettings,
  persistInterventionSettings,
} from './interventionSettingsStorage';

function createLocalStorageMock() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
}

describe('interventionSettingsStorage', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock());
  });

  afterEach(() => {
    localStorage.removeItem(INTERVENTION_SETTINGS_STORAGE_KEY);
    vi.unstubAllGlobals();
  });

  it('returns defaults when storage is empty', () => {
    expect(loadInterventionSettings()).toEqual({
      approvalMode: 'manual',
      toolAllowList: [],
    });
  });

  it('loads valid persisted settings', () => {
    persistInterventionSettings({
      approvalMode: 'allow-list',
      toolAllowList: ['linkloom-agent/createTodos'],
    });

    expect(loadInterventionSettings()).toEqual({
      approvalMode: 'allow-list',
      toolAllowList: ['linkloom-agent/createTodos'],
    });
  });

  it('falls back to defaults for corrupt JSON', () => {
    localStorage.setItem(INTERVENTION_SETTINGS_STORAGE_KEY, '{not-json');

    expect(loadInterventionSettings()).toEqual({
      approvalMode: 'manual',
      toolAllowList: [],
    });
  });

  it('falls back for invalid approval mode and filters allow-list entries', () => {
    localStorage.setItem(
      INTERVENTION_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        approvalMode: 'headless',
        toolAllowList: ['valid/key', '', 42, null],
      }),
    );

    expect(loadInterventionSettings()).toEqual({
      approvalMode: 'manual',
      toolAllowList: ['valid/key'],
    });
  });
});
