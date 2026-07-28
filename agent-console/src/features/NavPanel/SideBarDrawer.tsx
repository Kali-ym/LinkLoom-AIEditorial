import { ActionIcon, Flexbox, Text } from '@lobehub/ui';
import { cssVar } from 'antd-style';
import { createStaticStyles } from 'antd-style';
import { X } from 'lucide-react';
import { memo, Suspense, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { DESKTOP_HEADER_ICON_SMALL_SIZE } from '../../constants/layoutTokens';
import { NAV_PANEL_RIGHT_DRAWER_ID } from './constants';
import { SkeletonList } from './SkeletonList';
import { OverlayContainerContext } from './OverlayContainer';
import { SideBarHeaderLayout } from './SideBarHeaderLayout';

const DRAWER_WIDTH = 280;

const styles = createStaticStyles(({ css }) => ({
  drawer: css`
    position: absolute;
    z-index: 10;
    inset-block: 0;
    inset-inline-start: 0;

    display: flex;
    flex-direction: column;

    width: ${DRAWER_WIDTH}px;
    overflow: hidden;

    background: ${cssVar.colorBgContainer};
    border-inline-end: 1px solid ${cssVar.colorBorderSecondary};
    box-shadow: ${cssVar.boxShadowSecondary};
  `,
  body: css`
    overflow: hidden;
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
  `,
}));

/** §C.50*/
export const SideBarDrawer = memo(function SideBarDrawer({
  action,
  children,
  onClose,
  open,
  subHeader,
  title,
}: {
  action?: ReactNode;
  children?: ReactNode;
  onClose: () => void;
  open: boolean;
  subHeader?: ReactNode;
  title?: ReactNode;
  }) {
  const [overlayContainer, setOverlayContainer] = useState<HTMLDivElement | null>(null);
  const [mountEl, setMountEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setMountEl(document.getElementById(NAV_PANEL_RIGHT_DRAWER_ID));
  }, []);

  if (!open || !mountEl) return null;

  const drawer = (
    <OverlayContainerContext value={overlayContainer}>
      <div className={styles.drawer} role="dialog" aria-label={typeof title === 'string' ? title : '话题'}>
        <header>
          <SideBarHeaderLayout
            left={
              typeof title === 'string' ? (
                <Text ellipsis fontSize={14} style={{ fontWeight: 600, paddingLeft: 8 }}>
                  {title}
                </Text>
              ) : (
                title
              )
            }
            right={
              <>
                {action}
                <ActionIcon
                  icon={X}
                  size={DESKTOP_HEADER_ICON_SMALL_SIZE}
                  style={{ marginInlineEnd: -2 }}
                  title="关闭"
                  onClick={onClose}
                />
              </>
            }
          />
          {subHeader}
        </header>
        <div ref={setOverlayContainer} className={styles.body}>
          <Suspense
            fallback={
              <Flexbox gap={1} paddingBlock={1} paddingInline={4}>
                <SkeletonList rows={3} />
              </Flexbox>
            }
          >
            {children}
          </Suspense>
        </div>
      </div>
    </OverlayContainerContext>
  );

  return createPortal(drawer, mountEl);
});
