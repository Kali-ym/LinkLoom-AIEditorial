import { Suspense, lazy, memo } from 'react';

const EditorProvider = lazy(() =>
  import('@lobehub/editor/react').then((m) => ({ default: m.EditorProvider })),
);
const DesktopChatInput = lazy(() =>
  import('./index').then((m) => ({ default: m.DesktopChatInput })),
);

/** Editor + chat input load together, after shell/layout first paint. */
export const DesktopChatInputLazy = memo(function DesktopChatInputLazy() {
  return (
    <Suspense fallback={null}>
      <EditorProvider>
        <DesktopChatInput />
      </EditorProvider>
    </Suspense>
  );
});
