import { memo, useEffect, useLayoutEffect, type ReactNode } from 'react';

import { AgentListQueryHydration } from '../hooks/data/AgentListQueryHydration';
import { isAgentConsolePopupRoute } from '../constants/agentConsoleRoutes';
import { AgentConsoleRouteHydration } from '../features/Conversation/AgentConsoleRouteHydration';
import { InputMenuHydration } from '../features/Conversation/InputMenuHydration';
import { MessagesHydration } from '../features/Conversation/MessagesHydration';
import { TaskHydration } from '../features/Sidebar/Task/TaskHydration';
import { NavPanelHoverReveal } from '../features/NavPanel/NavPanelHoverReveal';
import { mobileStyles } from '../styles/mobileStyles';
import {
  bootstrapAgentConsole,
  initLayoutListeners,
  teardownAgentConsole,
  useLayoutStore,
} from '../stores';
import '../styles/index-html.css';

interface AgentConsoleShellProps {
  children: ReactNode;
}

/** Full-viewport shell for Agent Console — hides Admin chrome via AppLayout. */
export const AgentConsoleShell = memo(function AgentConsoleShell({
  children,
}: AgentConsoleShellProps) {
  const zenMode = useLayoutStore((s) => s.zenMode);
  const sidebarCollapsed = useLayoutStore((s) => s.sidebarCollapsed);
  const rightCollapsed = useLayoutStore((s) => s.rightCollapsed);
  const isPortalMobile = useLayoutStore((s) => s.isPortalMobile);
  const portalOpen = useLayoutStore((s) => s.portalOpen);
  const wideScreen = useLayoutStore((s) => s.wideScreen);

  // Bootstrap before child layout effects (e.g. ChatHydration) so topic store is hydrated first.
  useLayoutEffect(() => {
    bootstrapAgentConsole();
    if (isAgentConsolePopupRoute(window.location.pathname)) {
      useLayoutStore.getState().setSidebarCollapsed(true);
      useLayoutStore.getState().setRightPanelOpen(false);
    }
  }, []);

  useEffect(() => {
    const removeLayoutListeners = initLayoutListeners();
    return () => {
      removeLayoutListeners();
      teardownAgentConsole();
    };
  }, []);

  const pageClass = [
    'agent-page',
    'agent-console-root',
    mobileStyles.pageOverflowGuard,
    sidebarCollapsed && 'sidebar-collapsed',
    rightCollapsed && 'right-collapsed',
    isPortalMobile && portalOpen && 'portal-mobile-active',
    wideScreen && 'wide-screen',
    zenMode && 'zen-mode',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={pageClass}
      id="agentPage"
      data-region="agent-page"
    >
      <AgentListQueryHydration />
      <AgentConsoleRouteHydration />
      <InputMenuHydration />
      <MessagesHydration />
      <TaskHydration />
      {children}
      <NavPanelHoverReveal />
    </div>
  );
});
