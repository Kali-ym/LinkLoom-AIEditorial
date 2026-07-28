import { Flexbox } from '@lobehub/ui';
import type { ReactNode } from 'react';
import { memo } from 'react';

/** §C.50*/
export const SideBarHeaderLayout = memo(function SideBarHeaderLayout({
  left,
  right,
}: {
  left?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <Flexbox
      horizontal
      align="center"
      flex="none"
      justify="space-between"
      padding="8px 6px"
      style={{ overflow: 'hidden' }}
    >
      <Flexbox horizontal align="center" flex={1} gap={2} style={{ overflow: 'hidden', minWidth: 0 }}>
        {left}
      </Flexbox>
      <Flexbox horizontal align="center" gap={2} justify="flex-end">
        {right}
      </Flexbox>
    </Flexbox>
  );
});
