import { Accordion, ActionIcon, DraggablePanel, Flexbox } from '@lobehub/ui';
import { PanelLeftClose } from 'lucide-react';
import { memo } from 'react';

import {
  DESKTOP_HEADER_ICON_SMALL_SIZE,
  NAV_PANEL_MAX_WIDTH,
  NAV_PANEL_MIN_WIDTH,
} from '../../constants/layoutTokens';
import { useLayoutStore } from '../../stores';
import { panelStyles } from '../../layout/panelStyles';
import { NAV_PANEL_RIGHT_DRAWER_ID } from '../NavPanel/constants';
import { AgentSwitcher } from './AgentSwitcher';
import { ConnectionStatusControl } from './ConnectionStatusControl';
import { SidebarNav } from './SidebarNav';
import { sidebarShellStyles } from './sidebarShellStyles';
import { TopicSection } from './Topic';

function SidebarContent({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  return (
    <>
      <Flexbox horizontal align="center" className={sidebarShellStyles.topbar} gap={4} padding="6px 8px">
        <ConnectionStatusControl />
        <AgentSwitcher />
        <ActionIcon
          icon={PanelLeftClose}
          id="sidebarCollapseBtn"
          size={DESKTOP_HEADER_ICON_SMALL_SIZE}
          title="收起侧栏"
          onClick={onToggleSidebar}
        />
      </Flexbox>
      <SidebarNav />
      <div className={sidebarShellStyles.body}>
        <Accordion defaultExpandedKeys={['topics']} gap={8}>
          <TopicSection itemKey="topics" />
        </Accordion>
      </div>
    </>
  );
}

/** §B/C.1 NavPanel — DraggablePanel 240–400（compact 视口保留 overlay aside） */
export const AgentSidebar = memo(function AgentSidebar() {
  const zenMode = useLayoutStore((s) => s.zenMode);
  const sidebarCollapsed = useLayoutStore((s) => s.sidebarCollapsed);
  const navPanelWidth = useLayoutStore((s) => s.navPanelWidth);
  const setNavPanelWidth = useLayoutStore((s) => s.setNavPanelWidth);
  const setSidebarCollapsed = useLayoutStore((s) => s.setSidebarCollapsed);
  const isCompactViewport = useLayoutStore((s) => s.isCompactViewport);

  if (zenMode) return null;

  const content = <SidebarContent onToggleSidebar={() => setSidebarCollapsed(true)} />;

  if (isCompactViewport) {
    return (
      <aside className="agent-sidebar agent-sidebar--overlay" data-region="sidebar">
        {content}
        <div
          id={NAV_PANEL_RIGHT_DRAWER_ID}
          style={{ height: '100%', position: 'absolute', insetBlock: 0, insetInlineEnd: 0, width: 0, zIndex: 10 }}
        />
      </aside>
    );
  }

  return (
    <DraggablePanel
      className={panelStyles.navPanel}
      classNames={{ content: panelStyles.navPanelContent }}
      data-region="sidebar"
      defaultSize={{ height: '100%', width: navPanelWidth }}
      expand={!sidebarCollapsed}
      expandable={false}
      maxWidth={NAV_PANEL_MAX_WIDTH}
      minWidth={NAV_PANEL_MIN_WIDTH}
      placement="left"
      showBorder={false}
      showHandleWhenCollapsed={false}
      size={{ height: '100%', width: navPanelWidth }}
      onExpandChange={(expand) => setSidebarCollapsed(!expand)}
      onSizeDragging={(_delta, size) => {
        const next =
          size?.width && typeof size.width === 'number'
            ? size.width
            : typeof size?.width === 'string'
              ? Number.parseInt(size.width, 10)
              : undefined;
        if (next) setNavPanelWidth(next);
      }}
    >
      <aside className="agent-sidebar agent-sidebar-panel" style={{ position: 'relative' }}>
        {content}
        <div
          id={NAV_PANEL_RIGHT_DRAWER_ID}
          style={{ height: '100%', position: 'absolute', insetBlock: 0, insetInlineEnd: 0, width: 0, zIndex: 10 }}
        />
      </aside>
    </DraggablePanel>
  );
});
