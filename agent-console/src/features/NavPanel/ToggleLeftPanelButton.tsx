import { ActionIcon } from '@lobehub/ui';
import { PanelLeftOpen } from 'lucide-react';
import { memo } from 'react';

import { DESKTOP_HEADER_ICON_SMALL_SIZE } from '../../constants/layoutTokens';
import { useLayoutStore } from '../../stores';

export const TOGGLE_BUTTON_ID = 'toggle_left_panel_button';

/** ChatHeader NavHeader 左槽 — 侧栏收起时显示 */
export const ToggleLeftPanelButton = memo(function ToggleLeftPanelButton({
  id = TOGGLE_BUTTON_ID,
}: {
  id?: string | null;
}) {
  const setSidebarCollapsed = useLayoutStore((s) => s.setSidebarCollapsed);

  return (
    <ActionIcon
      icon={PanelLeftOpen}
      id={id ?? undefined}
      size={DESKTOP_HEADER_ICON_SMALL_SIZE}
      title="展开侧栏"
      onClick={() => setSidebarCollapsed(false)}
    />
  );
});
