import { useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { useTheme } from '../../context/ThemeContext';
import { useCommandSearch } from '../../hooks/data/useCatalog';
import { runOrDefer, useCreateAgentAction } from '../shared';
import { usePrimaryAgentId } from '../../hooks/usePrimaryAgentId';
import { useSwitchAgent } from '../../hooks/useSwitchAgent';
import { usePermission } from '../../hooks/usePermission';
import { showToast } from '../../services/ui/toast';
import {
  useAgentStore,
  useChatStore,
  useCommandMenuStore,
  useInputStore,
  useLayoutStore,
  useTopicStore,
  useWorkingSidebarStore,
} from '../../stores';
import { applyCommandSearchSelection } from './commandSearchNavigation';
import { useCommandMenuContext } from './CommandMenuContext';
import type { CommandSearchResult, ThemeMode } from './types';
import { useDebouncedValue } from './useDebouncedValue';

const SEARCH_DEBOUNCE_MS = 600;

function injectMessageDraft(message: string): void {
  const trimmed = message.trim();
  if (!trimmed) return;
  useInputStore.getState().setDraft(trimmed);
  useInputStore.getState().setMarkdownContent(trimmed);
}

/** §C.41*/
export function useCommandMenu() {
  const navigate = useNavigate();
  const open = useCommandMenuStore((s) => s.showCommandMenu);
  const { allowed: canCreate } = usePermission('create_content');
  const {
    activeAgentId,
    onClose,
    search,
    setPages,
    setSearch,
    setSelectedAgent,
    selectedAgent,
    typeFilter,
    setTypeFilter,
  } = useCommandMenuContext();

  const { theme, toggleTheme } = useTheme();
  const newTopic = useTopicStore((s) => s.newTopic);
  const selectTopic = useTopicStore((s) => s.selectTopic);
  const topics = useTopicStore((s) => s.topics);
  const agents = useAgentStore((s) => s.agents);
  const switchAgent = useSwitchAgent();
  const messagesByTopicId = useChatStore((s) => s.messagesByTopicId);
  const toggleSidebar = useLayoutStore((s) => s.toggleSidebar);
  const toggleRightPanel = useLayoutStore((s) => s.toggleRightPanel);
  const toggleZenMode = useLayoutStore((s) => s.toggleZenMode);
  const openWorkingSidebar = useWorkingSidebarStore((s) => s.openWorkingSidebar);
  const { createAgentAndNavigate } = useCreateAgentAction();
  const primaryAgentId = usePrimaryAgentId();

  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const hasSearch = debouncedSearch.trim().length > 0;
  const searchQuery = debouncedSearch.trim();

  const searchSources = useMemo(
    () => ({
      activeAgentId: activeAgentId ?? primaryAgentId,
      agents,
      messagesByTopicId,
      topics,
    }),
    [activeAgentId, agents, messagesByTopicId, primaryAgentId, topics],
  );

  const {
    data: searchResults = [],
    isFetching: isSearchFetching,
    isLoading: isSearchLoading,
  } = useCommandSearch(searchQuery, typeFilter, searchSources);

  const isSearching =
    hasSearch &&
    (search.trim() !== debouncedSearch.trim() || isSearchFetching || isSearchLoading);

  useEffect(() => {
    if (!open) return;
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, [open]);

  const closeCommandMenu = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleNavigate = useCallback(
    (path: string) => {
      if (path.startsWith('http://') || path.startsWith('https://')) {
        window.open(path, '_blank', 'noopener,noreferrer');
        onClose();
        return;
      }
      navigate(path);
      onClose();
    },
    [navigate, onClose],
  );

  const handleExternalLink = useCallback(
    (url: string) => {
      window.open(url, '_blank', 'noopener,noreferrer');
      onClose();
    },
    [onClose],
  );

  const handleOpenFeedback = useCallback(() => {
    showToast('反馈功能（演示）');
    onClose();
  }, [onClose]);

  const handleBack = useCallback(() => {
    setPages((prev) => prev.slice(0, -1));
  }, [setPages]);

  const handleCreateTopic = useCallback(() => {
    if (!canCreate) return;
    newTopic();
    onClose();
  }, [canCreate, newTopic, onClose]);

  const handleCreateSession = useCallback(() => {
    if (!canCreate) return;
    void createAgentAndNavigate(undefined, { onClose });
  }, [canCreate, createAgentAndNavigate, onClose]);

  const handleCreateAgentTeam = useCallback(() => {
    if (!canCreate) return;
    runOrDefer('createAgent', () => showToast('新建助理团队（演示）'));
    onClose();
  }, [canCreate, onClose]);

  const handleCreatePage = useCallback(() => {
    if (!canCreate) return;
    runOrDefer('createAgent', () => showToast('新建文稿（演示）'));
    onClose();
  }, [canCreate, onClose]);

  const handleCreateLibrary = useCallback(() => {
    if (!canCreate) return;
    runOrDefer('createAgent', () => showToast('新建库（演示）'));
    onClose();
  }, [canCreate, onClose]);

  const handleToggleSidebar = useCallback(() => {
    toggleSidebar();
    onClose();
  }, [onClose, toggleSidebar]);

  const handleToggleRightPanel = useCallback(() => {
    toggleRightPanel();
    onClose();
  }, [onClose, toggleRightPanel]);

  const handleToggleZenMode = useCallback(() => {
    toggleZenMode();
    onClose();
  }, [onClose, toggleZenMode]);

  const handleOpenWorkingSidebar = useCallback(() => {
    openWorkingSidebar({ resourceFilter: 'skills', tab: 'space' });
    onClose();
  }, [onClose, openWorkingSidebar]);

  const handleThemeChange = useCallback(
    (mode: ThemeMode) => {
      if (mode === 'system') {
        showToast('跟随系统（演示）');
        onClose();
        return;
      }
      if (mode === 'light' && theme !== 'light') toggleTheme();
      if (mode === 'dark' && theme !== 'dark') toggleTheme();
      onClose();
    },
    [onClose, theme, toggleTheme],
  );

  const handleSelectAgentWithMessage = useCallback(
    (agentId: string) => {
      switchAgent(agentId);
      if (search.trim()) {
        injectMessageDraft(search);
      }
      setSearch('');
      onClose();
    },
    [onClose, search, switchAgent, setSearch],
  );

  const handleAskInboxAgent = useCallback(() => {
    if (!primaryAgentId) return;
    handleSelectAgentWithMessage(primaryAgentId);
  }, [handleSelectAgentWithMessage, primaryAgentId]);

  const handleAgentBuilder = useCallback(() => {
    if (search.trim()) {
      showToast(`Agent 构建器（演示）：${search.trim().slice(0, 40)}`);
    } else {
      showToast('Agent 构建器（演示）');
    }
    onClose();
  }, [onClose, search]);

  const handleAIPainting = useCallback(() => {
    if (search.trim()) {
      handleExternalLink(`https://example.com/image?prompt=${encodeURIComponent(search.trim())}`);
      return;
    }
    handleExternalLink('https://example.com/image');
  }, [handleExternalLink, search]);

  const handleSearchResultSelect = useCallback(
    (result: CommandSearchResult) => {
      applyCommandSearchSelection(result, {
        navigate: handleNavigate,
        newTopic: () => {
          if (canCreate) newTopic();
        },
        onFallback: (hit) => showToast(`打开 ${hit.title}（演示）`),
        openWorkingSidebar,
        selectTopic,
        setActiveAgentId: switchAgent,
      });
      onClose();
    },
    [
      canCreate,
      handleNavigate,
      newTopic,
      onClose,
      openWorkingSidebar,
      selectTopic,
      switchAgent,
    ],
  );

  const handleSendToSelectedAgent = useCallback(() => {
    if (!selectedAgent || !search.trim()) return;
    switchAgent(selectedAgent.id);
    injectMessageDraft(search);
    setSearch('');
    setSelectedAgent(undefined);
    onClose();
  }, [onClose, search, selectedAgent, switchAgent, setSearch, setSelectedAgent]);

  return {
    closeCommandMenu,
    handleAgentBuilder,
    handleAIPainting,
    handleAskInboxAgent,
    handleBack,
    handleCreateAgentTeam,
    handleCreateLibrary,
    handleCreatePage,
    handleCreateSession,
    handleCreateTopic,
    handleExternalLink,
    handleNavigate,
    handleOpenFeedback,
    handleOpenWorkingSidebar,
    handleSearchResultSelect,
    handleSelectAgentWithMessage,
    handleSendToSelectedAgent,
    handleThemeChange,
    handleToggleRightPanel,
    handleToggleSidebar,
    handleToggleZenMode,
    hasSearch,
    isSearching,
    searchQuery,
    searchResults,
    setTypeFilter,
    typeFilter,
  };
};
