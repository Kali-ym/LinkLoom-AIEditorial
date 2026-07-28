import type { DropdownMenuProps } from '@lobehub/ui';

/** 侧栏 NavItem 等长菜单：避让视口边缘，超出时内部滚动（依赖 base-ui `--available-height`） */
export const NAV_DROPDOWN_MENU_PROPS = {
  popupProps: {
    style: {
      maxHeight: 'var(--available-height)',
      overflowY: 'auto',
      overscrollBehavior: 'contain',
    },
  },
  positionerProps: {
    collisionAvoidance: { align: 'shift', side: 'flip' },
    collisionPadding: 8,
  },
} satisfies Pick<DropdownMenuProps, 'popupProps' | 'positionerProps'>;
