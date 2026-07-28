import { type FlexboxProps, Flexbox, TooltipGroup } from '@lobehub/ui';
import { type CSSProperties, type ReactNode } from 'react';
import { memo } from 'react';

import { useLayoutStore } from '../../stores';
import { ToggleLeftPanelButton } from '../NavPanel/ToggleLeftPanelButton';

export interface NavHeaderProps extends Omit<FlexboxProps, 'children'> {
  children?: ReactNode;
  left?: ReactNode;
  right?: ReactNode;
  showTogglePanelButton?: boolean;
  slotClassNames?: {
    center?: string;
    left?: string;
    right?: string;
  };
  styles?: {
    center?: CSSProperties;
    left?: CSSProperties;
    right?: CSSProperties;
  };
}

/** NavHeader layout shell for agent console top bar. */
export const NavHeader = memo<NavHeaderProps>(function NavHeader({
  showTogglePanelButton = true,
  style,
  children,
  left,
  right,
  slotClassNames,
  styles: slotStyles,
  ...rest
}) {
  const sidebarCollapsed = useLayoutStore((s) => s.sidebarCollapsed);
  const expand = !sidebarCollapsed;
  const noContent = !left && !right && !children;

  if (noContent && expand) return null;

  return (
    <Flexbox
      allowShrink
      horizontal
      align="center"
      flex="none"
      gap={4}
      height={44}
      justify="space-between"
      padding={8}
      style={style}
      {...rest}
    >
      <TooltipGroup>
        <Flexbox
          allowShrink
          horizontal
          align="center"
          className={slotClassNames?.left}
          gap={2}
          justify="flex-start"
          style={slotStyles?.left}
        >
          {showTogglePanelButton && !expand && <ToggleLeftPanelButton />}
          {left}
        </Flexbox>
        {children && (
          <Flexbox className={slotClassNames?.center} flex={1} style={slotStyles?.center}>
            {children}
          </Flexbox>
        )}
        <Flexbox
          horizontal
          align="center"
          className={slotClassNames?.right}
          gap={2}
          justify="flex-end"
          style={slotStyles?.right}
        >
          {right}
        </Flexbox>
      </TooltipGroup>
    </Flexbox>
  );
});
