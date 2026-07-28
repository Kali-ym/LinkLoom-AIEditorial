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
import { workingSidebarStyles } from './workingSidebarStyles';

const TodoProgressCard = lazy(() =>
  import('./TodoProgressCard').then((m) => ({ default: m.TodoProgressCard })),
);
const ResourcesSection = lazy(() =>
  import('./ResourcesSection').then((m) => ({ default: m.ResourcesSection })),
);
const ReviewPanel = lazy(() =>
  import('./ReviewPanel').then((m) => ({ default: m.ReviewPanel })),
);
const FilesPanel = lazy(() =>
  import('./FilesPanel').then((m) => ({ default: m.FilesPanel })),
);
const ParamsSection = lazy(() => import('./ParamsSection'));

const ALL_TABS: { key: WorkingSidebarTab; label: string }[] = [
  { key: 'space', label: '空间' },
  { key: 'review', label: '审查' },
  { key: 'files', label: '文件' },
  { key: 'params', label: '参数' },
];

function ActiveTabBody({
  activeTab,
  paramsAvailable,
  reviewAvailable,
  filesAvailable,
}: {
  activeTab: WorkingSidebarTab;
  paramsAvailable: boolean;
  reviewAvailable: boolean;
  filesAvailable: boolean;
}) {
  if (activeTab === 'space') {
    return (
      <Flexbox className={cx(workingSidebarStyles.pane, workingSidebarStyles.resourcesPane)} id="pane-resources">
        <Suspense fallback={null}>
          <TodoProgressCard />
          <ResourcesSection />
        </Suspense>
      </Flexbox>
    );
  }

  if (activeTab === 'params' && paramsAvailable) {
    return (
      <div className={workingSidebarStyles.pane} id="pane-params">
        <div className={workingSidebarStyles.paneScroll} id="paramsPanelMount">
          <Suspense fallback={null}>
            <ParamsSection />
          </Suspense>
        </div>
      </div>
    );
  }

  if (activeTab === 'review' && reviewAvailable) {
    return (
      <div className={workingSidebarStyles.pane} id="pane-review">
        <Suspense fallback={null}>
          <ReviewPanel />
        </Suspense>
      </div>
    );
  }

  if (activeTab === 'files' && filesAvailable) {
    return (
      <div className={workingSidebarStyles.pane} id="pane-files">
        <Suspense fallback={null}>
          <FilesPanel />
        </Suspense>
      </div>
    );
  }

  return null;
}

/** §C.5 / §C.27 WorkingSidebar — only mount the active tab body. */
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

  const showBody = isCompactViewport || !rightCollapsed;

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

      {showBody ? (
        <div className={workingSidebarStyles.body}>
          <ActiveTabBody
            activeTab={activeTab}
            filesAvailable={filesAvailable}
            paramsAvailable={paramsAvailable}
            reviewAvailable={reviewAvailable}
          />
        </div>
      ) : null}
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
