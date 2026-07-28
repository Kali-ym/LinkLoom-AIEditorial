import { Flexbox, Modal } from '@lobehub/ui';
import { createStaticStyles, cssVar, cx } from 'antd-style';
import { Activity, memo, type ReactNode } from 'react';

import { portalStrings } from './portalStrings';

const styles = createStaticStyles(({ css }) => ({
  threadContainer: css`
    background: linear-gradient(${cssVar.colorBgElevated}, ${cssVar.colorBgContainer}) !important;
  `,
  mobileHeader: css`
    flex-shrink: 0;
    border-bottom: 1px solid ${cssVar.colorBorderSecondary};
    background: ${cssVar.colorBgContainer};
  `,
}));

interface PortalMobileLayoutProps {
  open: boolean;
  isThreadView: boolean;
  onClose: () => void;
  header: ReactNode;
  children: ReactNode;
}

/** §C.56*/
export const PortalMobileLayout = memo(function PortalMobileLayout({
  open,
  isThreadView,
  onClose,
  header,
  children,
}: PortalMobileLayoutProps) {
  return (
    <Modal
      allowFullscreen
      destroyOnHidden
      className={cx(isThreadView && styles.threadContainer)}
      data-region="portal"
      footer={null}
      height="95%"
      open={open}
      title={portalStrings.modalTitle}
      styles={{
        body: { padding: 0 },
        header: { display: 'none' },
      }}
      onCancel={onClose}
    >
      <Activity mode={open ? 'visible' : 'hidden'} name="AgentPortalMobile">
        <Flexbox height="100%" width="100%" style={{ minHeight: 0 }}>
          <div className={styles.mobileHeader}>{header}</div>
          <Flexbox
            gap={8}
            height="calc(100% - 52px)"
            padding="0 8px"
            style={{ overflow: 'hidden' }}
          >
            <Flexbox
              height="100%"
              width="calc(100% + 16px)"
              style={{ marginInline: -8, overflow: 'hidden', position: 'relative' }}
            >
              {children}
            </Flexbox>
          </Flexbox>
        </Flexbox>
      </Activity>
    </Modal>
  );
});
