import { ActionIcon, type ActionIconProps } from '@lobehub/ui';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import { memo, type ReactNode } from 'react';

import { DESKTOP_HEADER_ICON_SMALL_SIZE } from '../constants/layoutTokens';
import { useHotkeySettingsStore } from '../stores/hotkeySettingsStore';

export const TOGGLE_RIGHT_PANEL_BUTTON_ID = 'toggle_right_panel_button';

interface ToggleRightPanelButtonProps {
  expand: boolean;
  hideWhenExpanded?: boolean;
  icon?: ActionIconProps['icon'];
  onToggle: () => void;
  size?: ActionIconProps['size'];
  title?: ReactNode;
}

/** §C.54 / §C.55*/
export const ToggleRightPanelButton = memo(function ToggleRightPanelButton({
  expand,
  hideWhenExpanded,
  icon,
  onToggle,
  size = DESKTOP_HEADER_ICON_SMALL_SIZE,
  title,
}: ToggleRightPanelButtonProps) {
  const hotkey = useHotkeySettingsStore((s) => s.getKeys('toggleRightPanel'));

  if (hideWhenExpanded && expand) return null;

  const resolvedTitle = title ?? (expand ? '收起右侧面板' : '展开右侧面板');
  const resolvedIcon = icon ?? (expand ? PanelRightClose : PanelRightOpen);

  return (
    <ActionIcon
      active={expand}
      icon={resolvedIcon}
      id={TOGGLE_RIGHT_PANEL_BUTTON_ID}
      size={size}
      title={
        hotkey ? (
          <>
            {resolvedTitle}
            {' · '}
            {hotkey}
          </>
        ) : (
          resolvedTitle
        )
      }
      onClick={onToggle}
    />
  );
});
