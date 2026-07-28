import { ActionIcon, DropdownMenu } from '@lobehub/ui';
import { MoreHorizontal } from 'lucide-react';
import { memo } from 'react';

import { useHeaderMenu } from './useMenu';

/** §C.15 HeaderActions*/
export const HeaderActions = memo(function HeaderActions() {
  const { menuHeader, menuItems } = useHeaderMenu();

  if (!menuItems.length) return null;

  return (
    <DropdownMenu header={menuHeader} items={menuItems}>
      <ActionIcon aria-label="更多" icon={MoreHorizontal} id="chatTitleMore" size="small" />
    </DropdownMenu>
  );
});
