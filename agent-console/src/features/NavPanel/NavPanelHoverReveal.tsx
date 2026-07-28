import { memo } from 'react';
import { cx } from 'antd-style';

import { useLayoutStore } from '../../stores';
import { ToggleLeftPanelButton } from './ToggleLeftPanelButton';
import {
  NAV_PANEL_TOGGLE_WRAP_CLASS,
  navPanelHoverRevealStyles,
} from './navPanelHoverRevealStyles';

/** Desktop-only left-edge hover zone when NavPanel is collapsed. */
export const NavPanelHoverReveal = memo(function NavPanelHoverReveal() {
  const sidebarCollapsed = useLayoutStore((s) => s.sidebarCollapsed);
  const zenMode = useLayoutStore((s) => s.zenMode);
  const isCompactViewport = useLayoutStore((s) => s.isCompactViewport);

  if (!sidebarCollapsed || zenMode || isCompactViewport) return null;

  return (
    <div
      aria-hidden
      className={navPanelHoverRevealStyles.root}
      data-region="nav-panel-hover-reveal"
    >
      <div className={cx(navPanelHoverRevealStyles.buttonWrap, NAV_PANEL_TOGGLE_WRAP_CLASS)}>
        <ToggleLeftPanelButton />
      </div>
    </div>
  );
});
