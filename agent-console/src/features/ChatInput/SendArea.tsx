import { SendButton } from '@lobehub/editor/react';
import { Flexbox, Tooltip } from '@lobehub/ui';
import { cx } from 'antd-style';
import { memo, useMemo, type ComponentProps } from 'react';

import { usePermission } from '../../hooks/usePermission';
import { useConfigStore } from '../../stores';
import type { ChatInputActionKey } from './ActionBar/config';
import { actionMap } from './ActionBar/config';
import { ExpandButton } from './ExpandButton';
import { chatInputStyles } from './chatInputStyles';
import { useSendMenuItems } from './useSendMenuItems';

/** §C.38 / §C.4 SendArea — Expand + rightActions（除 contextWindow）+ Send */
export const SendArea = memo(function SendArea({
  generating,
  hasContent,
  rightActions,
  sendDisabled = false,
  shape,
  showSendMenu,
  onSend,
  onStop,
}: {
  generating: boolean;
  hasContent: boolean;
  rightActions: ChatInputActionKey[];
  sendDisabled?: boolean;
  shape?: 'round' | 'default';
  showSendMenu?: boolean;
  onSend: () => void;
  onStop: () => void;
}) {
  const isDevMode = useConfigStore((s) => s.isDevMode);
  const sendMenuItems = useSendMenuItems();
  const { allowed: canCreate, reason } = usePermission('create_content');

  const useMenu = showSendMenu ?? isDevMode;
  const sendMenu = useMenu
    ? ({ items: sendMenuItems } as ComponentProps<typeof SendButton>['menu'])
    : undefined;

  const sendShape = shape ?? (useMenu ? undefined : 'round');

  const actionItems = useMemo(
    () =>
      rightActions
        .filter((key) => key !== 'contextWindow')
        .filter((key): key is keyof typeof actionMap => key in actionMap)
        .map((key) => {
          const Component = actionMap[key];
          return <Component key={key} />;
        }),
    [rightActions],
  );

  const sendButton = (
    <SendButton
      className={cx(
        chatInputStyles.sendButton,
        hasContent && !generating && chatInputStyles.sendButtonReady,
      )}
      disabled={sendDisabled || ((!hasContent && !generating) || !canCreate)}
      generating={generating}
      menu={canCreate ? sendMenu : undefined}
      placement="topRight"
      shape={sendShape}
      size={32}
      trigger={useMenu ? ['hover'] : undefined}
      type={hasContent || generating ? 'primary' : 'default'}
      onSend={onSend}
      onStop={onStop}
    />
  );

  return (
    <Flexbox horizontal align="center" flex="none" gap={12}>
      <ExpandButton />
      {actionItems}
      {canCreate ? sendButton : (
        <Tooltip title={reason}>
          <span style={{ display: 'inline-flex' }}>{sendButton}</span>
        </Tooltip>
      )}
    </Flexbox>
  );
});
