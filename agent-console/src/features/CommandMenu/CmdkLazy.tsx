import { Suspense, lazy, memo, useEffect, useState } from 'react';

import { useCommandMenuStore } from '../../stores';

const CommandMenu = lazy(() =>
  import('./CommandMenuRoot').then((m) => ({ default: m.CommandMenu })),
);

/** Load Cmd+K chunk only after the menu is first opened. */
export const CmdkLazy = memo(function CmdkLazy() {
  const open = useCommandMenuStore((s) => s.showCommandMenu);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  if (!mounted) return null;

  return (
    <Suspense fallback={null}>
      <CommandMenu />
    </Suspense>
  );
});
