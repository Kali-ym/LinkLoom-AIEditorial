import { type MenuProps } from '@lobehub/ui';
import { Center, DropdownMenu, Flexbox, Icon, Tooltip } from '@lobehub/ui';
import { cx } from 'antd-style';
import { Check, ChevronDown, Hand, ListChecks, Zap, type LucideIcon } from 'lucide-react';
import { memo, useCallback, useMemo, useState } from 'react';

import { usePermission } from '../../../hooks/usePermission';
import { useStreamingStore, type ApprovalMode as ApprovalModeValue } from '../../../stores/streamingStore';
import { controlBarStyles } from './controlBarStyles';

const MODE_META: Record<
  ApprovalModeValue,
  { desc: string; icon: LucideIcon; label: string }
> = {
  'auto-run': {
    desc: '自动批准所有工具调用',
    icon: Zap,
    label: '自动运行',
  },
  'allow-list': {
    desc: '仅白名单内的工具自动执行',
    icon: ListChecks,
    label: '允许列表',
  },
  manual: {
    desc: '每次工具调用都需手动批准',
    icon: Hand,
    label: '手动批准',
  },
};

const ModeItemLabel = memo<{ desc: string; icon: LucideIcon; title: string }>(
  function ModeItemLabel({ desc, icon, title }) {
    return (
      <Flexbox horizontal align="flex-start" gap={12}>
        <Center className={controlBarStyles.menuIcon} flex="none" height={32} width={32}>
          <Icon icon={icon} />
        </Center>
        <Flexbox flex={1} style={{ minWidth: 120 }}>
          <div className={controlBarStyles.menuOptionTitle}>{title}</div>
          <div className={controlBarStyles.menuOptionDesc}>{desc}</div>
        </Flexbox>
      </Flexbox>
    );
  },
);

/** §C.30*/
export const ApprovalMode = memo(function ApprovalMode() {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { allowed: canCreateContent, reason } = usePermission('create_content');
  const approvalMode = useStreamingStore((s) => s.approvalMode);
  const setApprovalMode = useStreamingStore((s) => s.setApprovalMode);
  const current = MODE_META[approvalMode];

  const handleModeChange = useCallback(
    (mode: ApprovalModeValue) => {
      if (!canCreateContent) return;
      setApprovalMode(mode);
    },
    [canCreateContent, setApprovalMode],
  );

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!canCreateContent) return;
      setDropdownOpen(nextOpen);
    },
    [canCreateContent],
  );

  const menuItems = useMemo<MenuProps['items']>(
    () =>
      (Object.keys(MODE_META) as ApprovalModeValue[]).map((key) => ({
        extra: approvalMode === key ? <Icon icon={Check} /> : undefined,
        key,
        label: (
          <ModeItemLabel
            desc={MODE_META[key].desc}
            icon={MODE_META[key].icon}
            title={MODE_META[key].label}
          />
        ),
        onClick: () => handleModeChange(key),
      })),
    [approvalMode, handleModeChange],
  );

  const trigger = (
    <span className={cx(controlBarStyles.chip, !canCreateContent && controlBarStyles.chipDisabled)}>
      <Icon className={controlBarStyles.chipIcon} icon={current.icon} size={14} />
      <span className={controlBarStyles.chipLabel}>{current.label}</span>
      <Icon className={controlBarStyles.chipChevron} icon={ChevronDown} size={12} />
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
    <DropdownMenu
      items={menuItems}
      open={canCreateContent && dropdownOpen}
      placement="bottomRight"
      onOpenChange={handleOpenChange}
    >
      <span style={{ display: 'inline-flex' }} title={dropdownOpen ? undefined : '工具审批模式'}>
        {trigger}
      </span>
    </DropdownMenu>
  );
});
