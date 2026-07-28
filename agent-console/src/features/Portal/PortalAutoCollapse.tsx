import { memo, useEffect, useRef } from 'react';

import { useLayoutStore, usePortalStore } from '../../stores';

/** §C.6 / §C.56 — Portal 打开时折起左 NavPanel；Mobile 无此行为 */
export const PortalAutoCollapse = memo(function PortalAutoCollapse() {
  const open = usePortalStore((s) => s.stack.length > 0);
  const isPortalMobile = useLayoutStore((s) => s.isPortalMobile);
  const savedExpandedRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (isPortalMobile) return;

    const layout = useLayoutStore.getState();

    if (open) {
      if (savedExpandedRef.current === null) {
        savedExpandedRef.current = !layout.sidebarCollapsed;
        if (!layout.sidebarCollapsed) {
          layout.setSidebarCollapsed(true);
        }
      }
    } else if (savedExpandedRef.current !== null) {
      if (savedExpandedRef.current) {
        layout.setSidebarCollapsed(false);
      }
      savedExpandedRef.current = null;
    }
  }, [isPortalMobile, open]);

  return null;
});
