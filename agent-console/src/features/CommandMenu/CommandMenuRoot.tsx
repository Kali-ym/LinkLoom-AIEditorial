import { stopPropagation } from '@lobehub/ui';
import { cx } from 'antd-style';
import { Command, defaultFilter } from 'cmdk';
import { CornerDownLeft } from 'lucide-react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';

import { useAgentStore, useCommandMenuStore } from '../../stores';
import { AgentAvatar } from '../../utils/agentAvatar';
import { AskAgentCommands } from './AskAgentCommands';
import { AskAIMenu } from './AskAIMenu';
import {
  CommandMenuProvider,
  useCommandMenuContext,
  useResetCommandMenuState,
} from './CommandMenuContext';
import { CommandFooter, CommandInput } from './components';
import { commandStrings } from './commandStrings';
import { MainMenu } from './MainMenu';
import { SearchResults } from './SearchResults';
import { commandMenuStyles as styles } from './styles';
import { mobileStyles } from '../../styles/mobileStyles';
import { ThemeMenu } from './ThemeMenu';
import { useCommandMenu } from './useCommandMenu';

const CLOSE_ANIMATION_DURATION = 150;

interface CommandMenuContentProps {
  isClosing: boolean;
  onClose: () => void;
}

const CommandMenuContent = memo(function CommandMenuContent({
  isClosing,
  onClose,
}: CommandMenuContentProps) {
  const {
    handleBack,
    handleSendToSelectedAgent,
    hasSearch,
    isSearching,
    searchQuery,
    searchResults,
    setTypeFilter,
    typeFilter,
  } = useCommandMenu();

  const { page, pages, search, setPages, setSearch, setSelectedAgent, selectedAgent } =
    useCommandMenuContext();

  const listRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState<string | undefined>();

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0;
    setValue(undefined);
  }, [search, page, selectedAgent]);

  useEffect(() => {
    if (page && page !== 'ask-ai') setSearch('');
  }, [page, setSearch]);

  const commandFilter = useCallback(
    (itemValue: string, searchValue: string, keywords?: string[]) => {
      if (itemValue.startsWith('search-result ')) return 0.5;
      return defaultFilter?.(itemValue, searchValue, keywords) ?? 0;
    },
    [],
  );

  const showEmpty =
    hasSearch && !isSearching && searchResults.length === 0 && !selectedAgent && !page;

  return (
    <div className={cx(styles.overlay, mobileStyles.commandMenuMobile)} data-closing={isClosing} onClick={onClose}>
      <div onClick={stopPropagation}>
        <Command
          className={cx(styles.commandRoot, mobileStyles.commandRootMobile)}
          data-closing={isClosing}
          filter={commandFilter}
          shouldFilter={page !== 'ask-ai' && !selectedAgent && !search.trimStart().startsWith('@')}
          value={value}
          onValueChange={setValue}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && selectedAgent && search.trim()) {
              e.preventDefault();
              handleSendToSelectedAgent();
              return;
            }
            if (e.key === 'Tab' && page !== 'ask-ai' && !selectedAgent) {
              e.preventDefault();
              setPages([...pages, 'ask-ai']);
              return;
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              if (selectedAgent) setSelectedAgent(undefined);
              else if (pages.length > 0) handleBack();
              else onClose();
            }
            if (e.key === 'Backspace' && !search) {
              if (selectedAgent) {
                e.preventDefault();
                setSelectedAgent(undefined);
              } else if (pages.length > 0) {
                e.preventDefault();
                setPages((prev) => prev.slice(0, -1));
              }
            }
          }}
        >
          <CommandInput />

          <Command.List ref={listRef}>
            {showEmpty ? <Command.Empty>{commandStrings.empty}</Command.Empty> : null}

            {selectedAgent ? (
              <Command.Group>
                <Command.Item
                  disabled={!search.trim()}
                  value="send-to-agent"
                  onSelect={handleSendToSelectedAgent}
                >
                  <CornerDownLeft className={styles.icon} />
                  <AgentAvatar
                    agent={{ id: selectedAgent.id, name: selectedAgent.title }}
                    background={selectedAgent.backgroundColor}
                    size={18}
                  />
                  <div className={styles.itemContent}>
                    <div className={styles.itemLabel}>
                      {commandStrings.sendToAgent(selectedAgent.title)}
                    </div>
                  </div>
                </Command.Item>
              </Command.Group>
            ) : null}

            {!page && !selectedAgent ? <AskAgentCommands /> : null}

            {!page && !selectedAgent && !search.trimStart().startsWith('@') ? <MainMenu /> : null}

            {page === 'theme' ? <ThemeMenu /> : null}

            {page === 'ask-ai' ? <AskAIMenu /> : null}

            {!page && !selectedAgent && hasSearch && !search.trimStart().startsWith('@') ? (
              <SearchResults
                isLoading={isSearching}
                results={searchResults}
                searchQuery={searchQuery}
                typeFilter={typeFilter}
                onSetTypeFilter={setTypeFilter}
              />
            ) : null}
          </Command.List>

          <CommandFooter />
        </Command>
      </div>
    </div>
  );
});

/** §C.41 CommandMenu — portal 到 `.agent-console-provider-root` */
export const CommandMenu = memo(function CommandMenu() {
  const open = useCommandMenuStore((s) => s.showCommandMenu);
  const setOpen = useCommandMenuStore((s) => s.toggleCommandMenu);
  const activeAgentId = useAgentStore((s) => s.activeAgentId);
  const { pathname } = useLocation();

  const [mounted, setMounted] = useState(false);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const resetStateRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      setIsVisible(true);
      setIsClosing(false);
    }
  }, [open]);

  useEffect(() => {
    if (!mounted) return;
    const root =
      (document.querySelector('.agent-console-provider-root') as HTMLElement | null) ??
      document.body;
    setPortalRoot(root);
  }, [mounted]);

  const handleClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    window.setTimeout(() => {
      setOpen(false);
      setIsVisible(false);
      setIsClosing(false);
    }, CLOSE_ANIMATION_DURATION);
  }, [isClosing, setOpen]);

  if (!mounted || !isVisible || !portalRoot) return null;

  return createPortal(
    <CommandMenuProvider activeAgentId={activeAgentId} pathname={pathname} onClose={handleClose}>
      <CommandMenuResetBridge
        onRegisterReset={(fn) => {
          resetStateRef.current = fn;
        }}
        open={open}
      />
      <CommandMenuContent isClosing={isClosing} onClose={handleClose} />
    </CommandMenuProvider>,
    portalRoot,
  );
});

function CommandMenuResetBridge({
  onRegisterReset,
  open,
}: {
  onRegisterReset: (fn: () => void) => void;
  open: boolean;
}) {
  const { setPages, setSearch, setSelectedAgent, setTypeFilter } = useCommandMenuContext();

  const reset = useCallback(() => {
    setPages([]);
    setSearch('');
    setSelectedAgent(undefined);
    setTypeFilter(undefined);
  }, [setPages, setSearch, setSelectedAgent, setTypeFilter]);

  useEffect(() => {
    onRegisterReset(reset);
  }, [onRegisterReset, reset]);

  useResetCommandMenuState(open, reset);

  return null;
}
