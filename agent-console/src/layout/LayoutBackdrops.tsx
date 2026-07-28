import { cx } from 'antd-style';
import { memo } from 'react';

import { useLayoutStore } from '../stores';
import { mobileStyles } from '../styles/mobileStyles';

/**
 * index.html 中 `.layout-backdrop` 为 `agent-page` 的兄弟节点。
 * 移动 Portal 遮罩由 `@lobehub/ui Modal` 内置 mask 承担（§B GAPS 已补）。
 */
export const LayoutBackdrops = memo(function LayoutBackdrops() {
  const backdropVisible = useLayoutStore((s) => s.backdropVisible);
  const setBackdropVisible = useLayoutStore((s) => s.setBackdropVisible);
  const sidebarCollapsed = useLayoutStore((s) => s.sidebarCollapsed);
  const rightCollapsed = useLayoutStore((s) => s.rightCollapsed);
  const isCompactViewport = useLayoutStore((s) => s.isCompactViewport);
  const toggleSidebar = useLayoutStore((s) => s.toggleSidebar);
  const toggleRightPanel = useLayoutStore((s) => s.toggleRightPanel);

  return (
    <div
      className={cx('layout-backdrop', backdropVisible && 'open', mobileStyles.backdropMobile)}
      id="layoutBackdrop"
      aria-hidden={backdropVisible ? 'false' : 'true'}
      onClick={() => {
        if (!isCompactViewport) return;
        setBackdropVisible(false);
        if (!sidebarCollapsed) toggleSidebar();
        if (!rightCollapsed) toggleRightPanel();
      }}
    />
  );
});
