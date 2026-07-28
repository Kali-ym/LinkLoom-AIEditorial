import { Flexbox, Icon, Popover, Tooltip } from '@lobehub/ui';
import { cssVar, cx } from 'antd-style';
import { ChevronDownIcon, InfinityIcon, MessageCircleIcon } from 'lucide-react';
import { memo, useCallback, useState } from 'react';

import { usePermission } from '../../../hooks/usePermission';
import { useToggleAgentMode } from '../../../hooks/useToggleAgentMode';
import { useAgentStore } from '../../../stores';
import { controlBarStyles } from './controlBarStyles';

const MODE_LABELS = {
  agent: '智能',
  chat: '聊天',
} as const;

/** §C.30*/
export const ModeSelector = memo(function ModeSelector() {
  const toggleAgentMode = useToggleAgentMode();
  const [open, setOpen] = useState(false);
  const { allowed: canCreateContent, reason } = usePermission('create_content');
  const enableAgentMode = useAgentStore((s) => s.getEnableAgentMode());

  const currentMode = enableAgentMode ? 'agent' : 'chat';
  const CurrentIcon = enableAgentMode ? InfinityIcon : MessageCircleIcon;

  const handleSelect = useCallback(
    async (mode: 'agent' | 'chat') => {
      if (!canCreateContent) return;
      setOpen(false);
      await toggleAgentMode(mode === 'agent');
    },
    [canCreateContent, toggleAgentMode],
  );

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!canCreateContent) return;
      setOpen(nextOpen);
    },
    [canCreateContent],
  );

  const popoverContent = (
    <Flexbox gap={4} style={{ maxWidth: 320, minWidth: 280 }}>
      <Flexbox
        horizontal
        align="center"
        className={cx(
          controlBarStyles.menuOption,
          currentMode === 'agent' && controlBarStyles.menuOptionActive,
        )}
        gap={12}
        onClick={() => handleSelect('agent')}
      >
        <Flexbox align="center" className={controlBarStyles.menuIcon} justify="center">
          <Icon icon={InfinityIcon} size={16} />
        </Flexbox>
        <Flexbox flex={1}>
          <div className={controlBarStyles.menuOptionTitle}>{MODE_LABELS.agent}</div>
          <div className={controlBarStyles.menuOptionDesc}>可调用工具、读写文件与终端</div>
        </Flexbox>
      </Flexbox>

      <Flexbox
        horizontal
        align="center"
        className={cx(
          controlBarStyles.menuOption,
          currentMode === 'chat' && controlBarStyles.menuOptionActive,
        )}
        gap={12}
        onClick={() => handleSelect('chat')}
      >
        <Flexbox align="center" className={controlBarStyles.menuIcon} justify="center">
          <Icon icon={MessageCircleIcon} size={16} />
        </Flexbox>
        <Flexbox flex={1}>
          <div className={controlBarStyles.menuOptionTitle}>{MODE_LABELS.chat}</div>
          <div className={controlBarStyles.menuOptionDesc}>纯对话，不调用工具</div>
        </Flexbox>
      </Flexbox>
    </Flexbox>
  );

  const trigger = (
    <span className={cx(controlBarStyles.chip, !canCreateContent && controlBarStyles.chipDisabled)}>
      <Icon className={controlBarStyles.chipIcon} icon={CurrentIcon} size={14} />
      <span className={controlBarStyles.chipLabel}>{MODE_LABELS[currentMode]}</span>
      <Icon className={controlBarStyles.chipChevron} icon={ChevronDownIcon} size={12} />
    </span>
  );

  if (!canCreateContent) {
    return (
      <Tooltip title={reason}>
        <span style={{ display: 'inline-flex' }}>{trigger}</span>
      </Tooltip>
    );
  }

  return (
    <Popover
      content={popoverContent}
      nativeButton={false}
      open={canCreateContent && open}
      placement="topLeft"
      trigger="click"
      styles={{
        content: { border: `1px solid ${cssVar.colorBorderSecondary}`, padding: 4 },
      }}
      onOpenChange={handleOpenChange}
    >
      <span
        style={{ display: 'inline-flex' }}
        title={open ? undefined : enableAgentMode ? undefined : '纯对话，不调用工具'}
      >
        {trigger}
      </span>
    </Popover>
  );
});
