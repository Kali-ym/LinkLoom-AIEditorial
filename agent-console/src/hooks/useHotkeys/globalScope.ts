import { useCallback } from 'react';
import { useLocation } from 'react-router-dom';

import { usePrimaryAgentId } from '../../hooks/usePrimaryAgentId';
import { useSwitchAgent } from '../../hooks/useSwitchAgent';
import {
  useAgentListStore,
  useAgentStore,
  useCommandMenuStore,
  useLayoutStore,
  useTopicStore,
} from '../../stores';
import { useHotkeyHelperStore } from '../../stores/hotkeyHelperStore';
import { useHotkeyById } from './useHotkeyById';
import { isTaskPanelRoute } from './routeHelpers';

/** §C.55*/
export function useRegisterGlobalHotkeys(): void {
  const { pathname } = useLocation();
  const zenMode = useLayoutStore((s) => s.zenMode);
  const toggleSidebar = useLayoutStore((s) => s.toggleSidebar);
  const toggleRightPanel = useLayoutStore((s) => s.toggleRightPanel);
  const toggleTaskAgentPanel = useLayoutStore((s) => s.toggleTaskAgentPanel);
  const toggleCommandMenu = useCommandMenuStore((s) => s.toggleCommandMenu);
  const toggleHotkeyHelper = useHotkeyHelperStore((s) => s.toggle);
  const switchAgent = useSwitchAgent();
  const pinAgent = useAgentListStore((s) => s.pinAgent);
  const agents = useAgentStore((s) => s.agents);
  const pinnedAgentIds = useAgentListStore((s) => s.pinnedAgentIds);
  const openAllTopicsDrawer = useTopicStore((s) => s.openAllTopicsDrawer);

  const panelHotkeysEnabled = useCallback(() => !zenMode, [zenMode]);

  const handleToggleRightPanel = useCallback(() => {
    if (isTaskPanelRoute(pathname)) {
      toggleTaskAgentPanel();
      return;
    }
    toggleRightPanel();
  }, [pathname, toggleRightPanel, toggleTaskAgentPanel]);

  const handleSwitchAgent = useCallback(
    (e: KeyboardEvent) => {
      const digit = Number(e.key);
      if (digit < 1 || digit > 9) return;
      const agentId = pinnedAgentIds[digit - 1];
      if (!agentId) return;
      if (!agents.some((a) => a.id === agentId)) return;
      switchAgent(agentId);
    },
    [agents, pinnedAgentIds, switchAgent],
  );

  useHotkeyById('commandPalette', () => toggleCommandMenu(), { enableOnContentEditable: true });

  const primaryAgentId = usePrimaryAgentId();

  useHotkeyById(
    'navigateToChat',
    () => {
      if (!primaryAgentId) return;
      switchAgent(primaryAgentId);
      pinAgent(primaryAgentId, false);
    },
  );

  useHotkeyById('toggleLeftPanel', () => toggleSidebar(), {
    enableOnContentEditable: true,
    enabled: panelHotkeysEnabled,
  });

  useHotkeyById('toggleRightPanel', () => handleToggleRightPanel(), {
    enableOnContentEditable: true,
    enabled: panelHotkeysEnabled,
  });

  useHotkeyById('openHotkeyHelper', () => toggleHotkeyHelper());
  useHotkeyById('search', () => openAllTopicsDrawer(), { enableOnContentEditable: true });
  useHotkeyById('switchAgent', handleSwitchAgent);
}
