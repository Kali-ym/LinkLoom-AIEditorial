import { ActionIcon, lobeStaticStylish } from '@lobehub/ui';
import { createStaticStyles, cssVar, cx } from 'antd-style';
import { ArrowDown } from 'lucide-react';
import { memo } from 'react';

import { useLayoutStore } from '../../../stores';

const styles = createStaticStyles(({ css }) => ({
  container: cx(
    lobeStaticStylish.blur,
    css`
      pointer-events: none;

      position: absolute;
      z-index: 50;
      inset-block-end: 16px;
      inset-inline-end: 16px;
      transform: translateY(16px);

      opacity: 0;
      background: color-mix(in srgb, ${cssVar.colorBgElevated} 50%, transparent) !important;
    `,
  ),
  visible: css`
    pointer-events: all;
    transform: translateY(0);
    opacity: 1;
  `,
  mobileSize: css`
    @media (max-width: 767px) {
      inset-block-end: calc(16px + env(safe-area-inset-bottom, 0px));
    }
  `,
}));

/** §C.59 BackBottom*/
export const BackBottom = memo(function BackBottom({
  visible,
  bottomOffset = 0,
  onScrollToBottom,
}: {
  visible: boolean;
  bottomOffset?: number;
  onScrollToBottom: () => void;
}) {
  const isMobileViewport = useLayoutStore((s) => s.isMobileViewport);
  const blockSize = isMobileViewport ? 44 : 36;
  const iconSize = isMobileViewport ? 20 : 18;

  return (
    <ActionIcon
      glass
      className={cx(styles.container, visible && styles.visible, styles.mobileSize)}
      icon={ArrowDown}
      id="scrollBottom"
      size={{ blockSize, borderRadius: blockSize, size: iconSize }}
      style={
        bottomOffset
          ? {
              insetBlockEnd: isMobileViewport
                ? `calc(${16 + bottomOffset}px + env(safe-area-inset-bottom, 0px))`
                : 16 + bottomOffset,
            }
          : undefined
      }
      title="跳转到最新"
      variant="outlined"
      onClick={onScrollToBottom}
    />
  );
});
