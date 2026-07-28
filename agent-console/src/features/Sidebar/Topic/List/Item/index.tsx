import { Flexbox, Icon, Tag, Text, Tooltip } from '@lobehub/ui';
import { cssVar, useTheme } from 'antd-style';
import {
  CheckCircle2,
  Folder,
  Hand,
  Hash,
  MessageSquareDashed,
  Send,
  TriangleAlert,
} from 'lucide-react';
import { memo, useCallback, useMemo } from 'react';

import { RingLoadingIcon } from '../../../../../components/RingLoadingIcon';
import type { Topic } from '../../../../../domain/types';
import { agentConsoleTopicPath } from '../../../../../constants/agentConsoleRoutes';
import { useRouteAgentId } from '../../../../../hooks/useRouteAgentId';
import { NavItem } from '../../../../NavPanel/NavItem';
import { useTopicStore } from '../../../../../stores';
import { getDirName } from '../../topicListUtils';
import { useTopicNavigation } from '../../hooks/useTopicNavigation';
import { TopicItemActions } from './Actions';
import { TopicEditing } from './Editing';
import { RunningElapsedTime } from './RunningElapsedTime';
import { topicItemStyles } from './topicItemStyles';
import { useTopicItemDropdownMenu } from './useDropdownMenu';

function PlatformIcon({ platform }: { platform?: string }) {
  if (platform === 'telegram') {
    return <Icon color={cssVar.colorTextDescription} icon={Send} size={16} />;
  }
  return <Icon color={cssVar.colorTextDescription} icon={Hash} size={16} />;
}

export interface TopicItemProps {
  topic: Topic;
  showWorkingDirectory?: boolean;
}

export const TopicItem = memo(function TopicItem({
  topic,
  showWorkingDirectory,
}: TopicItemProps) {
  const { id, title, status, platform, workingDirectory, tag } = topic;
  const { isDarkMode } = useTheme();
  const activeTopicId = useTopicStore((s) => s.activeTopicId);
  const topicRenamingId = useTopicStore((s) => s.topicRenamingId);
  const topicLoadingIds = useTopicStore((s) => s.topicLoadingIds);
  const setTopicRenamingId = useTopicStore((s) => s.setTopicRenamingId);

  const agentId = useRouteAgentId();
  const { handleTopicClick, handleTopicDoubleClick } = useTopicNavigation();
  const { dropdownMenu } = useTopicItemDropdownMenu(topic);

  const editing = Boolean(id && topicRenamingId === id);
  const isLoading = Boolean(id && topicLoadingIds.includes(id));
  const isActive = id === activeTopicId;

  const loadingRingColor = isDarkMode
    ? cssVar.colorWarningBorder
    : `color-mix(in srgb, ${cssVar.colorWarning} 45%, transparent)`;

  const toggleEditing = useCallback(
    (visible?: boolean) => setTopicRenamingId(visible && id ? id : ''),
    [id, setTopicRenamingId],
  );

  const href = id && agentId ? agentConsoleTopicPath(agentId, id) : undefined;

  const workingDirectoryNode =
    showWorkingDirectory && workingDirectory ? (
      <Flexbox horizontal align="center" gap={4} style={{ overflow: 'hidden' }}>
        <Icon color={cssVar.colorTextDescription} icon={Folder} size={12} />
        <Text ellipsis fontSize={11} style={{ color: cssVar.colorTextDescription }}>
          {getDirName(workingDirectory)}
        </Text>
      </Flexbox>
    ) : undefined;

  const unreadIcon = (
    <span className={topicItemStyles.unreadWrapper}>
      <span className={topicItemStyles.unreadRipple} />
      <span className={topicItemStyles.unreadDot} />
    </span>
  );

  const statusIcon = useMemo(() => {
    if (status === 'waiting') {
      return <Icon color={cssVar.colorInfo} icon={Hand} size="small" />;
    }
    if (isLoading || status === 'running') {
      return (
        <RingLoadingIcon
          ringColor={loadingRingColor}
          size={14}
          style={{ color: cssVar.colorWarning }}
        />
      );
    }
    if (status === 'failed') {
      return (
        <Tooltip title="话题执行失败">
          <Icon color={cssVar.colorError} icon={TriangleAlert} size="small" />
        </Tooltip>
      );
    }
    if (status === 'completed') {
      return <Icon color={cssVar.colorTextDescription} icon={CheckCircle2} size="small" />;
    }
    if (status === 'unread') return unreadIcon;
    if (status === 'platform') return <PlatformIcon platform={platform} />;
    if (status === 'temp') {
      return <Icon color={cssVar.colorTextDescription} icon={MessageSquareDashed} size="small" />;
    }
    return <Icon color={cssVar.colorTextDescription} icon={Hash} size="small" />;
  }, [isLoading, loadingRingColor, platform, status, unreadIcon]);

  if (status === 'temp' || !id) {
    const tempMenu = dropdownMenu.filter((item) => item != null && item.key === 'delete');
    return (
      <NavItem
        actions={tempMenu.length > 0 ? <TopicItemActions dropdownMenu={tempMenu} /> : undefined}
        active={isActive}
        contextMenuItems={tempMenu}
        titleColor={cssVar.colorText}
        icon={statusIcon}
        title={
          <Flexbox horizontal align="center" flex={1} gap={6}>
            {title}
            <Tag size="small" style={{ color: cssVar.colorTextDescription, fontSize: 10 }}>
              {tag ?? '临时'}
            </Tag>
          </Flexbox>
        }
        onClick={() => handleTopicClick(id, editing)}
        onDoubleClick={() => handleTopicDoubleClick(id)}
      />
    );
  }

  return (
    <Flexbox style={{ position: 'relative' }}>
      <NavItem
        actions={<TopicItemActions dropdownMenu={dropdownMenu} />}
        active={isActive}
        contextMenuItems={dropdownMenu}
        description={workingDirectoryNode}
        disabled={editing}
        extra={status === 'running' ? <RunningElapsedTime topicId={id} /> : undefined}
        href={href}
        icon={statusIcon}
        title={title}
        titleColor={cssVar.colorText}
        onClick={() => handleTopicClick(id, editing)}
        onDoubleClick={() => handleTopicDoubleClick(id)}
      />
      <TopicEditing id={id} title={title} toggleEditing={toggleEditing} />
    </Flexbox>
  );
});
