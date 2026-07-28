import { Suspense, lazy, memo } from 'react';

const CommandMenu = lazy(() =>
  import('./CommandMenuRoot').then((m) => ({ default: m.CommandMenu })),
);

/** §C.28*/
export const CmdkLazy = memo(function CmdkLazy() {
  return (
    <Suspense fallback={null}>
      <CommandMenu />
    </Suspense>
  );
});
