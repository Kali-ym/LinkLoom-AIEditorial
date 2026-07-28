import { lazy, memo, Suspense, type ReactNode } from 'react';

const SharePopoverImpl = lazy(() =>
  import('./index').then((m) => ({ default: m.SharePopover })),
);

/** Upstream `SharePopover/lazy.ts` — 延迟加载 Popover 内容 */
export const SharePopoverLazy = memo(function SharePopoverLazy({
  children,
  topicId,
  onOpenModal,
}: {
  children?: ReactNode;
  topicId?: string;
  onOpenModal?: () => void;
}) {
  return (
    <Suspense fallback={children}>
      <SharePopoverImpl topicId={topicId} onOpenModal={onOpenModal}>
        {children}
      </SharePopoverImpl>
    </Suspense>
  );
});
