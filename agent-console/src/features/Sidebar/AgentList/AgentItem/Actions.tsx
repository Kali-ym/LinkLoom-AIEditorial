import { ActionIcon, DropdownMenu } from '@lobehub/ui';
import type { GenericItemType } from '@lobehub/ui';
import { MoreHorizontal } from 'lucide-react';
import { memo } from 'react';
import { NAV_DROPDOWN_MENU_PROPS } from '../../../NavPanel/navDropdownMenuProps';
import { NAV_ITEM_ACTION_CLASS_NAME } from '../../../NavPanel/NavItem';

interface AgentItemActionsProps {
  dropdownMenu: GenericItemType[] | (() => GenericItemType[]);
}

/** §C.19*/
export const AgentItemActions = memo(function AgentItemActions({
  dropdownMenu,
}: AgentItemActionsProps) {
  return (
    <DropdownMenu items={dropdownMenu} {...NAV_DROPDOWN_MENU_PROPS}>
      <ActionIcon
        className={NAV_ITEM_ACTION_CLASS_NAME}
        icon={MoreHorizontal}
        size="small"
        title="更多"
      />
    </DropdownMenu>
  );
});
