import {
  createContext,
  memo,
  type PropsWithChildren,
  use,
  useCallback,
  useMemo,
  useState,
} from 'react';

import { HotkeyScopeEnum, type HotkeyScopeId } from '../../constants/hotkeyRegistry';

interface HotkeysContextValue {
  activeScopes: ReadonlySet<HotkeyScopeId>;
  enableScope: (scope: HotkeyScopeId) => void;
  disableScope: (scope: HotkeyScopeId) => void;
}

const HotkeysContext = createContext<HotkeysContextValue | null>(null);

/** §C.55*/
export const HotkeysProvider = memo(function HotkeysProvider({ children }: PropsWithChildren) {
  const [activeScopes, setActiveScopes] = useState<ReadonlySet<HotkeyScopeId>>(
    () => new Set([HotkeyScopeEnum.Global]),
  );

  const enableScope = useCallback((scope: HotkeyScopeId) => {
    setActiveScopes((prev) => {
      if (prev.has(scope)) return prev;
      return new Set([...prev, scope]);
    });
  }, []);

  const disableScope = useCallback((scope: HotkeyScopeId) => {
    setActiveScopes((prev) => {
      if (!prev.has(scope)) return prev;
      const next = new Set(prev);
      next.delete(scope);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ activeScopes, enableScope, disableScope }),
    [activeScopes, disableScope, enableScope],
  );

  return <HotkeysContext value={value}>{children}</HotkeysContext>;
});

export function useHotkeysContext(): HotkeysContextValue {
  const ctx = use(HotkeysContext);
  if (!ctx) {
    throw new Error('useHotkeysContext must be used within HotkeysProvider');
  }
  return ctx;
}
