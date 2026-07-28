import { Flexbox } from '@lobehub/ui';
import { Suspense, lazy, memo, useRef } from 'react';
import { useLocation } from 'react-router-dom';

import { isAgentConsolePopupRoute, isAgentSubRoute } from '../constants/agentConsoleRoutes';
import { AgentConsoleRoutes } from '../routes/AgentConsoleRoutes';
import { RegisterHotkeys } from '../features/RegisterHotkeys';
import { AgentSidebar } from '../features/Sidebar';
import { layoutStyles } from '../styles/layoutStyles';
import { LayoutContainerContext } from './LayoutContainerContext';

const WorkingSidebar = lazy(() =>
  import('../features/WorkingSidebar').then((m) => ({ default: m.WorkingSidebar })),
);
const HotkeyHelperPanel = lazy(() =>
  import('../features/HotkeyHelperPanel').then((m) => ({ default: m.HotkeyHelperPanel })),
);
const AgentSettingDrawer = lazy(() =>
  import('../features/AgentSetting/AgentSettingDrawer').then((m) => ({
    default: m.AgentSettingDrawer,
  })),
);

/**
 * §B 布局几何 — [NavPanel | Conversation+Portal | WorkingSidebar]
 * §C.54 sub-routes 隐藏 WorkingSidebar（profile/topics/channel/task）
 */
export const AgentConsoleLayout = memo(function AgentConsoleLayout() {
  const layoutContainerRef = useRef<HTMLDivElement>(null);
  const pathname = useLocation().pathname;
  const isPopup = isAgentConsolePopupRoute(pathname);
  const hideWorkingSidebar = isAgentSubRoute(pathname) || isPopup;

  return (
    <LayoutContainerContext value={layoutContainerRef}>
      <Flexbox
        ref={layoutContainerRef}
        horizontal
        className={layoutStyles.page}
        height="100%"
        width="100%"
        style={{ minHeight: 0, overflow: 'hidden', position: 'relative' }}
      >
        {!isPopup && <AgentSidebar />}
        <Flexbox
          horizontal
          flex={1}
          className={layoutStyles.chatWorkspace}
          style={{ minWidth: 0, minHeight: 0, position: 'relative' }}
        >
          <RegisterHotkeys />
          <AgentConsoleRoutes />
        </Flexbox>
        {!hideWorkingSidebar && (
          <Suspense fallback={null}>
            <WorkingSidebar />
          </Suspense>
        )}
      </Flexbox>
      <Suspense fallback={null}>
        <HotkeyHelperPanel />
        <AgentSettingDrawer />
      </Suspense>
    </LayoutContainerContext>
  );
});
