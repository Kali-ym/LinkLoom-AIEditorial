import { DraggablePanel, ActionIcon, Flexbox } from '@lobehub/ui';
import { cssVar, cx } from 'antd-style';
import { PanelRightClose } from 'lucide-react';
import { Suspense, lazy, memo, useCallback, useMemo } from 'react';

import {
  DESKTOP_HEADER_ICON_SMALL_SIZE,
  WORKING_SIDEBAR_DEFAULT_WIDTH,
  WORKING_SIDEBAR_HEADER_HEIGHT,
  WORKING_SIDEBAR_MAX_WIDTH,
  WORKING_SIDEBAR_MIN_WIDTH,
} from '../../constants/layoutTokens';
import {
  resolveWorkingSidebarTab,
  useWorkingSidebarAvailability,
} from '../../hooks/useWorkingSidebarAvailability';
import { panelStyles } from '../../layout/panelStyles';
import { useLayoutStore, useWorkingSidebarStore } from '../../stores';
import type { WorkingSidebarTab } from '../../stores/types';
import { FilesPanel } from './FilesPanel';
import { ReviewPanel } from './ReviewPanel';
import { ResourcesSection } from './ResourcesSection';
import { TodoProgressCard } from './TodoProgressCard';
import { workingSidebarStyles } from './workingSidebarStyles';

const ParamsSection = lazy(() => import('./ParamsSection'));

const ALL_TABS: { key: WorkingSidebarTab; label: string }[] = [
  { key: 'space', label: '空间' },
  { key: 'review', label: '审查' },
  { key: 'files', label: '文件' },
  { key: 'params', label: '参数' },
];

/** §C.5 / §C.27 WorkingSidebar*/
export const WorkingSidebar = memo(function WorkingSidebar() {
  const zenMode = useLayoutStore((s) => s.zenMode);
  const rightCollapsed = useLayoutStore((s) => s.rightCollapsed);
  const rightWidth = useLayoutStore((s) => s.rightWidth);
  const setWidth = useLayoutStore((s) => s.setRightWidth);
  const setRightPanelOpen = useLayoutStore((s) => s.setRightPanelOpen);
  const isCompactViewport = useLayoutStore((s) => s.isCompactViewport);
  const storedTab = useWorkingSidebarStore((s) => s.tab);
  const setTab = useWorkingSidebarStore((s) => s.setTab);
  const availability = useWorkingSidebarAvailability();
  const { filesAvailable, reviewAvailable, paramsAvailable } = availability;

  const activeTab = useMemo(
    () => resolveWorkingSidebarTab(storedTab, availability),
    [availability, storedTab],
  );

  const visibleTabs = useMemo(
    () =>
      ALL_TABS.filter((t) => {
        if (t.key === 'review') return reviewAvailable;
        if (t.key === 'files') return filesAvailable;
        if (t.key === 'params') return paramsAvailable;
        return true;
      }),
    [filesAvailable, paramsAvailable, reviewAvailable],
  );

  const handleSizeChange = useCallback(
    (_delta: unknown, size?: { width?: number | string }) => {
      if (!size?.width) return;
      const next =
        typeof size.width === 'string' ? Number.parseInt(size.width, 10) : size.width;
      if (next) setWidth(next);
    },
    [setWidth],
  );

  if (zenMode) return null;

  const inner = (
    <Flexbox height="100%" width="100%" style={{ minHeight: 0 }}>
      <Flexbox
        horizontal
        align="center"
        className={workingSidebarStyles.header}
        height={WORKING_SIDEBAR_HEADER_HEIGHT}
        justify="space-between"
        paddingInline={4}
      >
        <div className={workingSidebarStyles.tabs}>
          {visibleTabs.map((t) => (
            <button
              key={t.key}
              type="button"
              className={cx(
                workingSidebarStyles.tab,
                activeTab === t.key && workingSidebarStyles.tabActive,
              )}
              data-pane={t.key === 'space' ? 'resources' : t.key}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <ActionIcon
          icon={PanelRightClose}
          size={DESKTOP_HEADER_ICON_SMALL_SIZE}
          title="收起工作面板"
          onClick={() => setRightPanelOpen(false)}
        />
      </Flexbox>

      <div className={workingSidebarStyles.body}>
        <Flexbox
          className={cx(
            workingSidebarStyles.pane,
            workingSidebarStyles.resourcesPane,
            activeTab !== 'space' && workingSidebarStyles.paneHidden,
          )}
          id="pane-resources"
        >
          <TodoProgressCard />
          <ResourcesSection />
        </Flexbox>

        {paramsAvailable ? (
          <div
            className={cx(
              workingSidebarStyles.pane,
              activeTab !== 'params' && workingSidebarStyles.paneHidden,
            )}
            id="pane-params"
          >
            <div className={workingSidebarStyles.paneScroll} id="paramsPanelMount">
              <Suspense fallback={null}>
                <ParamsSection />
              </Suspense>
            </div>
          </div>
        ) : null}

        {reviewAvailable ? (
          <div
            className={cx(
              workingSidebarStyles.pane,
              activeTab !== 'review' && workingSidebarStyles.paneHidden,
            )}
            id="pane-review"
          >
            <ReviewPanel />
          </div>
        ) : null}

        {filesAvailable ? (
          <div
            className={cx(
              workingSidebarStyles.pane,
              activeTab !== 'files' && workingSidebarStyles.paneHidden,
            )}
            id="pane-files"
          >
            <FilesPanel />
          </div>
        ) : null}
      </div>
    </Flexbox>
  );

  if (isCompactViewport) {
    return (
      <aside className="working-sidebar" id="workingSidebar" data-region="working-sidebar">
        {inner}
      </aside>
    );
  }

  return (
    <DraggablePanel
      backgroundColor={cssVar.colorBgContainer}
      className={panelStyles.rightPanel}
      classNames={{ content: panelStyles.rightPanelContent }}
      data-region="working-sidebar"
      defaultSize={{ width: rightWidth || WORKING_SIDEBAR_DEFAULT_WIDTH }}
      expand={!rightCollapsed}
      expandable={false}
      id="workingSidebar"
      maxWidth={WORKING_SIDEBAR_MAX_WIDTH}
      minWidth={WORKING_SIDEBAR_MIN_WIDTH}
      pin
      placement="right"
      showHandleWhenCollapsed={false}
      size={{ height: '100%', width: rightWidth }}
      stableLayout
      onExpandChange={(expand) => setRightPanelOpen(expand)}
      onSizeChange={handleSizeChange}
    >
      {inner}
    </DraggablePanel>
  );
});
