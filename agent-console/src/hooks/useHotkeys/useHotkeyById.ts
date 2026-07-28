import { useMemo } from 'react';

import { getHotkeyRegistryItem } from '../../constants/hotkeyRegistry';
import { useHotkeySettingsStore } from '../../stores/hotkeySettingsStore';
import { useHotkeysContext } from './HotkeysProvider';
import { buildKeyMatcher } from './parseHotkey';
import type { HotkeyBinding } from './types';
import { useHotkeyBindings } from './useHotkeyBindings';

export interface UseHotkeyByIdOptions {
  enableOnContentEditable?: boolean;
  enabled?: () => boolean;
}

/** §C.55*/
export function useHotkeyById(
  hotkeyId: string,
  handler: (e: KeyboardEvent) => void,
  options?: UseHotkeyByIdOptions,
): void {
  const keys = useHotkeySettingsStore((s) => s.getKeys(hotkeyId));
  const { activeScopes } = useHotkeysContext();
  const item = getHotkeyRegistryItem(hotkeyId);

  const scopeActive = useMemo(() => {
    if (!item?.scopes.length) return true;
    return item.scopes.some((scope) => activeScopes.has(scope));
  }, [activeScopes, item?.scopes]);

  const match = useMemo(() => buildKeyMatcher(keys), [keys]);

  const bindings = useMemo((): HotkeyBinding[] => {
    if (!scopeActive || !keys) return [];

    return [
      {
        id: hotkeyId,
        match,
        handler,
        enableOnContentEditable: options?.enableOnContentEditable,
        enabled: () => options?.enabled?.() ?? true,
      },
    ];
  }, [
    handler,
    hotkeyId,
    keys,
    match,
    options?.enableOnContentEditable,
    options?.enabled,
    scopeActive,
  ]);

  useHotkeyBindings(bindings);
}
