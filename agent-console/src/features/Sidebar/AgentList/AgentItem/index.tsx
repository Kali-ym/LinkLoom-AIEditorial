import { ActionIcon, Icon } from '@lobehub/ui';
import { Loader2, PinIcon } from 'lucide-react';
import { type CSSProperties, type DragEvent, memo, useCallback, useMemo } from 'react';

import { NavItem } from '../../../NavPanel/NavItem';
import type { SidebarAgentListItem } from '../../../../domain/types/agentList';
import { useSwitchAgent } from '../../../../hooks/useSwitchAgent';
import { useAgentListStore } from '../../../../stores/agentListStore';
import { useAgentStore } from '../../../../stores';
import { agentListStyles } from '../agentListStyles';
import { AgentItemActions } from './Actions';
import { AgentItemAvatar, AgentItemAvatarLoading } from './Avatar';
import { useAgentDropdownMenu } from './useDropdownMenu';

interface AgentItemProps {
  className?: string;
  item: SidebarAgentListItem;
  onNavigate?: () => void;
  style?: CSSProperties;
}

/** §C.19 AgentItem*/
export const AgentItem = memo(function AgentItem({
  className,
  item,
  onNavigate,
  style,
}: AgentItemProps) {
  const { id, backgroundColor, title, pinned } = item;
  const switchAgent = useSwitchAgent();
  const activeAgentId = useAgentStore((s) => s.activeAgentId);
  const runtime = useAgentListStore((s) => s.runtimeByAgentId[id]);
  const agentUpdatingId = useAgentListStore((s) => s.agentUpdatingId);
  const openAgentInNewWindow = useAgentListStore((s) => s.openAgentInNewWindow);
  const dropdownMenu = useAgentDropdownMenu({ agentId: id, pinned });
  const isUpdating = agentUpdatingId === id;
  const isRunning = Boolean(runtime?.isRunning);
  const unreadCount = runtime?.unreadCount ?? 0;

  const pinIcon = pinned ? (
    <ActionIcon icon={PinIcon} size={12} style={{ opacity: 0.5, pointerEvents: 'none' }} />
  ) : undefined;

  const avatarNode = useMemo(() => {
    if (isUpdating) return <AgentItemAvatarLoading />;
    const base = <AgentItemAvatar agentId={id} background={backgroundColor} name={title} />;
    if (isRunning) {
      return (
        <span className={agentListStyles.avatarWrap}>
          {base}
          <span className={agentListStyles.runningBadge}>
            <Icon spin icon={Loader2} size={9} />
          </span>
        </span>
      );
    }
    if (unreadCount > 0) {
      return (
        <span className={agentListStyles.avatarWrap}>
          {base}
          <span className={agentListStyles.unreadBadge}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        </span>
      );
    }
    return base;
  }, [backgroundColor, id, isRunning, isUpdating, title, unreadCount]);

  const handleClick = useCallback(() => {
    switchAgent(id);
    onNavigate?.();
  }, [id, onNavigate, switchAgent]);

  const handleDoubleClick = useCallback(() => {
    openAgentInNewWindow(id);
  }, [id, openAgentInNewWindow]);

  const handleDragStart = useCallback((e: DragEvent) => {
    e.dataTransfer.setData('text/plain', id);
  }, [id]);

  const handleDragEnd = useCallback(
    (e: DragEvent) => {
      if (e.dataTransfer.dropEffect === 'none') {
        openAgentInNewWindow(id);
      }
    },
    [id, openAgentInNewWindow],
  );

  return (
    <div
      className={className}
      draggable={!isUpdating}
      style={style}
      onDoubleClick={handleDoubleClick}
      onDragEnd={handleDragEnd}
      onDragStart={handleDragStart}
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
