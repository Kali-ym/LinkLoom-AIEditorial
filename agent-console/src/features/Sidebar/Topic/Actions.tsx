import { ActionIcon, DropdownMenu } from '@lobehub/ui';
import { MoreHorizontal } from 'lucide-react';
import { memo } from 'react';

import { NAV_DROPDOWN_MENU_PROPS } from '../../NavPanel/navDropdownMenuProps';
import { useTopicActionsDropdownMenu } from './useDropdownMenu';

export const TopicActions = memo(function TopicActions() {
  const menuItems = useTopicActionsDropdownMenu();
  return (
    <DropdownMenu items={menuItems} {...NAV_DROPDOWN_MENU_PROPS}>
      <ActionIcon icon={MoreHorizontal} size="small" title="更多" />
    </DropdownMenu>
  );
});
