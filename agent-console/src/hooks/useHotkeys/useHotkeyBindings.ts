import { useEffect, useRef } from 'react';

import { useLayoutStore } from '../../stores';
import type { HotkeyBinding } from './types';
import { isTypingTarget } from './keyMatchers';

/** §C.55 — single listener; mobile disables all bindings. */
export function useHotkeyBindings(bindings: HotkeyBinding[]): void {
  const isMobileViewport = useLayoutStore((s) => s.isMobileViewport);
  const bindingsRef = useRef(bindings);
  bindingsRef.current = bindings;

  useEffect(() => {
    if (isMobileViewport) return;

    const onKeyDown = (e: KeyboardEvent) => {
      for (const binding of bindingsRef.current) {
        if (binding.enabled && !binding.enabled()) continue;
        if (!binding.enableOnContentEditable && isTypingTarget(e)) continue;
        if (!binding.match(e)) continue;
        e.preventDefault();
        binding.handler(e);
        return;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMobileViewport]);
}
