import { ActionIcon, Flexbox } from '@lobehub/ui';
import { ArrowLeft, X } from 'lucide-react';
import { memo, type ReactNode } from 'react';

import { DESKTOP_HEADER_ICON_SMALL_SIZE } from '../../../constants/layoutTokens';
import { usePortalStore } from '../../../stores';
import { NavHeader } from '../../NavHeader';
import { portalChromeStyles } from '../portalChromeStyles';

/** §C.21 默认 Portal Header*/
export const DefaultPortalHeader = memo(function DefaultPortalHeader({
  title,
  rightExtra,
}: {
  title: ReactNode;
  rightExtra?: ReactNode;
}) {
  const stack = usePortalStore((s) => s.stack);
  const goBack = usePortalStore((s) => s.goBackPortal);
  const clear = usePortalStore((s) => s.clearPortalStack);
  const canGoBack = stack.length > 1;

  return (
    <NavHeader
      showTogglePanelButton={false}
      className={portalChromeStyles.headerShell}
      style={{ paddingBlock: 8, paddingInline: 8 }}
      left={
        <Flexbox horizontal align="center" gap={4} style={{ minWidth: 0, flex: 1 }}>
          {canGoBack && (
            <ActionIcon
              icon={ArrowLeft}
              id="portalBack"
              size={DESKTOP_HEADER_ICON_SMALL_SIZE}
              title="返回"
              onClick={goBack}
            />
          )}
          <Flexbox flex={1} style={{ minWidth: 0, overflow: 'hidden' }}>
            {title}
          </Flexbox>
        </Flexbox>
      }
      right={
        <>
          {rightExtra}
          <ActionIcon
            icon={X}
            id="portalClose"
            size={DESKTOP_HEADER_ICON_SMALL_SIZE}
            title="关闭"
            onClick={clear}
          />
        </>
      }
      styles={{
        left: {
          marginLeft: canGoBack ? 0 : 6,
        },
      }}
    />
  );
});
