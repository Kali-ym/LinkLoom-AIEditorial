import type { DropdownItem } from '@lobehub/ui';
import { ActionIcon, DropdownMenu } from '@lobehub/ui';
import { MoreHorizontal } from 'lucide-react';
import { memo } from 'react';

import { NAV_DROPDOWN_MENU_PROPS } from '../../../../NavPanel/navDropdownMenuProps';

interface TopicItemActionsProps {
  dropdownMenu: DropdownItem[] | (() => DropdownItem[]);
}

export const TopicItemActions = memo(function TopicItemActions({
  dropdownMenu,
}: TopicItemActionsProps) {
  return (
    <DropdownMenu items={dropdownMenu} {...NAV_DROPDOWN_MENU_PROPS}>
      <ActionIcon icon={MoreHorizontal} size="small" title="更多" />
    </DropdownMenu>
  );
});
