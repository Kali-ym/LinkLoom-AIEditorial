import { ActionIcon } from '@lobehub/ui';
import { PanelRightOpen } from 'lucide-react';
import { memo } from 'react';

import { DESKTOP_HEADER_ICON_SMALL_SIZE } from '../../../constants/layoutTokens';
import { isAgentConsolePopupRoute } from '../../../constants/agentConsoleRoutes';
import { useLayoutStore } from '../../../stores';

/** §C.15 WorkingPanelToggle — `/popup` 或右栏已展开时隐藏 */
export const WorkingPanelToggle = memo(function WorkingPanelToggle() {
  const rightCollapsed = useLayoutStore((s) => s.rightCollapsed);
  const viewportSynced = useLayoutStore((s) => s.viewportSynced);
  const setRightPanelOpen = useLayoutStore((s) => s.setRightPanelOpen);

  if (
    !viewportSynced ||
    isAgentConsolePopupRoute(window.location.pathname) ||
    !rightCollapsed
  ) {
    return null;
  }

  return (
    <ActionIcon
      icon={PanelRightOpen}
      id="rightPanelExpandBtn"
      size={DESKTOP_HEADER_ICON_SMALL_SIZE}
      title="展开工作面板"
      onClick={() => setRightPanelOpen(true)}
    />
  );
});
