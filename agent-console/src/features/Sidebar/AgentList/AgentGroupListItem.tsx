import { ActionIcon, Flexbox, Icon } from '@lobehub/ui';
import { Loader2, PinIcon, Users } from 'lucide-react';
import { type CSSProperties, memo, useCallback, useMemo } from 'react';

import type { SidebarAgentListItem } from '../../../domain/types/agentList';
import { useSwitchAgent } from '../../../hooks/useSwitchAgent';
import { useAgentListStore } from '../../../stores/agentListStore';
import { useAgentStore } from '../../../stores';
import { NavItem } from '../../NavPanel/NavItem';
import { AgentItemActions } from './AgentItem/Actions';
import { useAgentGroupDropdownMenu } from './AgentItem/useAgentGroupDropdownMenu';

interface AgentGroupListItemProps {
  className?: string;
  item: SidebarAgentListItem;
  onNavigate?: () => void;
  style?: CSSProperties;
}

/** §C.19 — group chat row (`type === 'group'`). */
export const AgentGroupListItem = memo(function AgentGroupListItem({
  className,
  item,
  onNavigate,
  style,
}: AgentGroupListItemProps) {
  const { id, backgroundColor, title, pinned } = item;
  const switchAgent = useSwitchAgent();
  const activeAgentId = useAgentStore((s) => s.activeAgentId);
  const groupUpdatingId = useAgentListStore((s) => s.groupUpdatingId);
  const openAgentInNewWindow = useAgentListStore((s) => s.openAgentInNewWindow);
  const dropdownMenu = useAgentGroupDropdownMenu({ agentId: id, pinned });

  const isUpdating = groupUpdatingId === id;
  const pinIcon = pinned ? (
    <ActionIcon icon={PinIcon} size={12} style={{ opacity: 0.5, pointerEvents: 'none' }} />
  ) : undefined;

  const avatarNode = useMemo(() => {
    if (isUpdating) {
      return <Icon spin color="var(--console-vars-color-text-description)" icon={Loader2} size={18} />;
    }
    return (
      <Flexbox
        align="center"
        height={22}
        justify="center"
        style={{
          background: backgroundColor,
          borderRadius: 'var(--console-vars-border-radius)',
          width: 22,
        }}
      >
        <Users size={12} />
      </Flexbox>
    );
  }, [backgroundColor, isUpdating]);

  const handleClick = useCallback(() => {
    switchAgent(id);
    onNavigate?.();
  }, [id, onNavigate, switchAgent]);

  return (
    <div
      className={className}
      style={style}
      onDoubleClick={() => openAgentInNewWindow(id)}
    >
      <NavItem
        actions={<AgentItemActions dropdownMenu={dropdownMenu} />}
        active={activeAgentId === id}
        contextMenuItems={dropdownMenu}
        disabled={isUpdating}
        icon={avatarNode}
        slots={{ iconPostfix: pinIcon }}
        title={title}
        onClick={handleClick}
      />
    </div>
  );
});
