import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';

import type { MenuContext, PageType, SelectedAgent } from './types';
import { detectContext } from './utils/context';
import type { ValidSearchType } from './utils/queryParser';
import { parseSearchQuery } from './utils/queryParser';

interface CommandMenuContextValue {
  activeAgentId: string | undefined;
  menuContext: MenuContext;
  onClose: () => void;
  page: PageType | undefined;
  pages: PageType[];
  pathname: string | null;
  search: string;
  selectedAgent: SelectedAgent | undefined;
  setPages: Dispatch<SetStateAction<PageType[]>>;
  setSearch: (search: string) => void;
  setSelectedAgent: (agent: SelectedAgent | undefined) => void;
  setTypeFilter: (typeFilter: ValidSearchType | undefined) => void;
  typeFilter: ValidSearchType | undefined;
  viewMode: 'default' | 'search';
}

const CommandMenuContext = createContext<CommandMenuContextValue | undefined>(undefined);

interface CommandMenuProviderProps {
  activeAgentId: string | undefined;
  children: ReactNode;
  onClose: () => void;
  pathname: string | null;
}

/** §C.41*/
export function CommandMenuProvider({
  activeAgentId: activeAgentIdProp,
  children,
  onClose,
  pathname,
}: CommandMenuProviderProps) {
  const [pages, setPages] = useState<PageType[]>([]);
  const [search, setSearchState] = useState('');
  const [typeFilter, setTypeFilterState] = useState<ValidSearchType | undefined>(undefined);
  const [selectedAgent, setSelectedAgentState] = useState<SelectedAgent | undefined>(undefined);

  const menuContext = useMemo(() => detectContext(pathname ?? '/'), [pathname]);
  const activeAgentId = menuContext === 'agent' ? activeAgentIdProp : undefined;
  const page = pages.at(-1);
  const viewMode = search.trim().length > 0 ? 'search' : 'default';

  const setSearch = useCallback((value: string) => {
    const parsedQuery = parseSearchQuery(value);
    if (parsedQuery.typeFilter) {
      setTypeFilterState(parsedQuery.typeFilter);
      setSearchState(parsedQuery.cleanQuery);
      return;
    }
    setSearchState(value);
  }, []);

  const setTypeFilter = useCallback((value: ValidSearchType | undefined) => {
    setTypeFilterState(value);
  }, []);

  const setSelectedAgent = useCallback((value: SelectedAgent | undefined) => {
    setSelectedAgentState(value);
  }, []);

  const contextValue = useMemo<CommandMenuContextValue>(
    () => ({
      activeAgentId,
      menuContext,
      onClose,
      page,
      pages,
      pathname,
      search,
      selectedAgent,
      setPages,
      setSearch,
      setSelectedAgent,
      setTypeFilter,
      typeFilter,
      viewMode,
    }),
    [
      activeAgentId,
      menuContext,
      onClose,
      page,
      pages,
      pathname,
      search,
      selectedAgent,
      setSearch,
      setSelectedAgent,
      setTypeFilter,
      typeFilter,
      viewMode,
    ],
  );

  return <CommandMenuContext value={contextValue}>{children}</CommandMenuContext>;
}

export function useCommandMenuContext(): CommandMenuContextValue {
  const context = use(CommandMenuContext);
  if (!context) {
    throw new Error('useCommandMenuContext must be used within CommandMenuProvider');
  }
  return context;
}

export function useResetCommandMenuState(open: boolean, reset: () => void): void {
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
      return;
    }
    if (wasOpenRef.current) {
      wasOpenRef.current = false;
      reset();
    }
  }, [open, reset]);
}
