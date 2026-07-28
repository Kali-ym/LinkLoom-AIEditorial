import { DraggablePanel, Flexbox } from '@lobehub/ui';
import { useResponsive } from 'antd-style';
import { Activity, memo, useCallback, useEffect, useState } from 'react';

import type { PortalViewPayload } from '../../domain/types/portalView';
import { CHAT_PORTAL_MAX_WIDTH } from '../../constants/layoutTokens';
import { PORTAL_WIDTH_MAX } from '../../stores/types';
import { useLayoutStore, usePortalStore } from '../../stores';
import { resolvePortalMinWidth } from '../../utils/portalLayout';
import { panelStyles } from '../../layout/panelStyles';
import { PortalAutoCollapse } from './PortalAutoCollapse';
import { PortalChrome } from './components/PortalChrome';
import { PortalMobileLayout } from './PortalMobileLayout';
import { PortalViewRouter } from './PortalViewRouter';

export {
  goHomePortal,
  openGroupThreadPortal,
  openMessageDetailPortal,
  openPortalView,
  openThreadPortal,
  replacePortalView,
  resetPortalView,
} from './portalActions';

/** §C.6 / §C.56 Portal*/
export const PortalDrawer = memo(function PortalDrawer() {
  const stack = usePortalStore((s) => s.stack);
  const clear = usePortalStore((s) => s.clearPortalStack);
  const isPortalMobile = useLayoutStore((s) => s.isPortalMobile);
  const portalWidth = useLayoutStore((s) => s.portalWidth);
  const setPortalWidth = useLayoutStore((s) => s.setPortalWidth);
  const clampPortalWidthForView = useLayoutStore((s) => s.clampPortalWidthForView);
  const syncLayoutBackdrops = useLayoutStore((s) => s.syncLayoutBackdrops);

  const current = stack[stack.length - 1];
  const open = stack.length > 0;
  const minWidth = resolvePortalMinWidth(current?.type);
  const isThreadView = current?.type === 'Thread';

  const [tmpWidth, setTmpWidth] = useState(portalWidth);
  if (tmpWidth !== portalWidth) setTmpWidth(portalWidth);

  const { lg } = useResponsive();

  useEffect(() => {
    if (open) {
      usePortalStore.getState().setMobileOpen(true);
      clampPortalWidthForView();
    }
    syncLayoutBackdrops();
  }, [open, isPortalMobile, syncLayoutBackdrops, clampPortalWidthForView, current?.type]);

  const handleSizeChange = useCallback(
    (_delta: unknown, size?: { width?: number | string }) => {
      if (!size?.width) return;
      const nextWidth =
        typeof size.width === 'string' ? Number.parseInt(size.width, 10) : size.width;
      if (!nextWidth || nextWidth === portalWidth) return;
      setTmpWidth(nextWidth);
      setPortalWidth(nextWidth);
    },
    [portalWidth, setPortalWidth],
  );

  const viewBody = current ? (
    <div className={panelStyles.portalBody} id="portalPanelBody">
      <PortalViewRouter type={current.type} payload={current.payload as PortalViewPayload} />
    </div>
  ) : null;

  const desktopPanelBody = (
    <Flexbox height="100%" width="100%" style={{ minHeight: 0 }}>
      <PortalChrome />
      {viewBody}
    </Flexbox>
  );

  return (
    <>
      <PortalAutoCollapse />
      {isPortalMobile ? (
        <PortalMobileLayout
          header={<PortalChrome />}
          isThreadView={isThreadView}
          open={open}
          onClose={clear}
        >
          {viewBody}
        </PortalMobileLayout>
      ) : (
        <DraggablePanel
          className={panelStyles.portalDrawer}
          classNames={{ content: panelStyles.portalContent }}
          data-region="portal"
          defaultSize={{ width: tmpWidth }}
          expand={open}
          expandable={false}
          id="portalPanel"
          maxWidth={CHAT_PORTAL_MAX_WIDTH ?? PORTAL_WIDTH_MAX}
          minWidth={minWidth}
          mode={lg ? 'fixed' : 'float'}
          placement="right"
          showHandleWhenCollapsed={false}
          showHandleWideArea={false}
          size={{ height: '100%', width: portalWidth }}
          onSizeChange={handleSizeChange}
        >
          <Activity mode={open ? 'visible' : 'hidden'} name="AgentPortal">
            {desktopPanelBody}
          </Activity>
        </DraggablePanel>
      )}
    </>
  );
});
