import {
  AccordionItem,
  ActionIcon,
  Center,
  Flexbox,
  Icon,
  Text,
  Tooltip,
} from '@lobehub/ui';
import { createStaticStyles, cssVar, cx } from 'antd-style';
import {
  FolderClosed,
  FolderOpen,
  Hand,
  Plus,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import { memo, useCallback, useMemo } from 'react';

import { RingLoadingIcon } from '../../../../../components/RingLoadingIcon';
import { useWorkingSidebarAvailability } from '../../../../../hooks/useWorkingSidebarAvailability';
import { useTopicStore } from '../../../../../stores';
import { topicGroupStrings } from '../../topicGroupStrings';
import { TopicItem } from '../../List/Item';
import { NO_PROJECT_GROUP_ID, PROJECT_GROUP_PREFIX } from '../../topicListUtils';
import type { GroupItemComponentProps } from '../GroupedAccordion';
import {
  getProjectTopicStatusCounts,
  hasProjectTopicStatusCounts,
  type ProjectTopicStatusCounts,
} from './statusCounts';

const styles = createStaticStyles(({ css }) => ({
  statusBadge: css`
    display: inline-flex;
    gap: 2px;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 18px;
    padding-inline: 4px;
    border-radius: 9px;
    font-size: 11px;
    font-weight: 500;
    line-height: 1;
  `,
  statusBadgeError: css`
    color: ${cssVar.colorError};
    background: color-mix(in srgb, ${cssVar.colorError} 14%, transparent);
  `,
  statusBadgeLoading: css`
    color: ${cssVar.colorWarning};
    background: color-mix(in srgb, ${cssVar.colorWarning} 14%, transparent);
  `,
  statusBadgeWaiting: css`
    color: ${cssVar.colorInfo};
    background: color-mix(in srgb, ${cssVar.colorInfo} 14%, transparent);
  `,
  addTopicAction: css`
    pointer-events: none;
    overflow: hidden;
    display: inline-flex;
    width: 0;
    opacity: 0;
    transition:
      width 150ms ${cssVar.motionEaseOut},
      opacity 150ms ${cssVar.motionEaseOut};
  `,
  actionRow: css`
    &:hover .add-topic-action,
    &:focus-within .add-topic-action {
      pointer-events: auto;
      width: 24px;
      opacity: 1;
    }
  `,
}));

interface StatusBadgeConfig {
  className: string;
  count: number;
  icon?: LucideIcon;
  label: string;
  loading?: boolean;
}

const CollapsedStatusBadges = memo(function CollapsedStatusBadges({
  counts,
}: {
  counts: ProjectTopicStatusCounts;
}) {
  const items: StatusBadgeConfig[] = [
    {
      className: styles.statusBadgeLoading,
      count: counts.loading,
      label: topicGroupStrings.projectStatus.loading(counts.loading),
      loading: true,
    },
    {
      className: styles.statusBadgeWaiting,
      count: counts.waitingForHuman,
      icon: Hand,
      label: topicGroupStrings.projectStatus.waitingForHuman(counts.waitingForHuman),
    },
    {
      className: styles.statusBadgeError,
      count: counts.failed,
      icon: TriangleAlert,
      label: topicGroupStrings.projectStatus.failed(counts.failed),
    },
  ].filter((item) => item.count > 0);

  if (!items.length) return null;

  return (
    <Flexbox horizontal align="center" gap={3}>
      {items.map(({ className, count, icon, label, loading }) => (
        <Tooltip key={label} title={label}>
          <span aria-label={label} className={cx(styles.statusBadge, className)} role="status">
            {loading ? (
              <RingLoadingIcon
                ringColor={`color-mix(in srgb, ${cssVar.colorWarning} 28%, transparent)`}
                size={11}
                style={{ color: cssVar.colorWarning }}
              />
            ) : (
              icon && <Icon icon={icon} size={{ size: 11, strokeWidth: 2 }} />
            )}
            {count}
          </span>
        </Tooltip>
      ))}
    </Flexbox>
  );
});

/** §C.44*/
export const ByProjectGroupItem = memo(function ByProjectGroupItem({
  group,
  expanded,
}: GroupItemComponentProps) {
  const loadingTopicIds = useTopicStore((s) => s.topicLoadingIds);
  const newTopic = useTopicStore((s) => s.newTopic);
  const setTopicWorkingDirectory = useTopicStore((s) => s.setTopicWorkingDirectory);
  const { isDeviceMode, isLocalSystemEnabled } = useWorkingSidebarAvailability();

  const workingDirectory = useMemo(() => {
    if (group.workingDirectory) return group.workingDirectory;
    if (group.id.startsWith(PROJECT_GROUP_PREFIX)) {
      return group.id.slice(PROJECT_GROUP_PREFIX.length);
    }
    return undefined;
  }, [group.id, group.workingDirectory]);

  const statusCounts = useMemo(
    () => getProjectTopicStatusCounts(group.topics, new Set(loadingTopicIds)),
    [group.topics, loadingTopicIds],
  );
  const hasCollapsedStatus = !expanded && hasProjectTopicStatusCounts(statusCounts);
  const canAddTopic = Boolean(workingDirectory) && (isDeviceMode || isLocalSystemEnabled);
  const ProjectFolderIcon = expanded ? FolderOpen : FolderClosed;

  const handleAddTopic = useCallback(() => {
    if (!workingDirectory) return;
    newTopic();
    const tempId = useTopicStore.getState().activeTopicId;
    if (tempId) setTopicWorkingDirectory(tempId, workingDirectory);
  }, [newTopic, setTopicWorkingDirectory, workingDirectory]);

  const action =
    canAddTopic || hasCollapsedStatus ? (
      <Flexbox horizontal align="center" className={styles.actionRow} gap={4}>
        {hasCollapsedStatus ? <CollapsedStatusBadges counts={statusCounts} /> : null}
        {canAddTopic ? (
          <span className={hasCollapsedStatus ? cx(styles.addTopicAction, 'add-topic-action') : undefined}>
            <ActionIcon
              icon={Plus}
              size="small"
              title={topicGroupStrings.addNewTopicInProject(group.label)}
              tooltipProps={{ placement: 'right' }}
              onClick={(e) => {
                e.stopPropagation();
                handleAddTopic();
              }}
            />
          </span>
        ) : null}
      </Flexbox>
    ) : undefined;

  return (
    <AccordionItem
      action={action}
      alwaysShowAction={hasCollapsedStatus}
      itemKey={group.id}
      paddingBlock={4}
      paddingInline={4}
      title={
        <Flexbox horizontal align="center" gap={8} height={24} style={{ overflow: 'hidden' }}>
          <Center flex="none" height={24} width={28}>
            <Icon
              color={cssVar.colorTextTertiary}
              icon={ProjectFolderIcon}
              size={{ size: 15, strokeWidth: 1.5 }}
            />
          </Center>
          <Text ellipsis fontSize={14} style={{ color: cssVar.colorTextSecondary, flex: 1 }}>
            {group.id === NO_PROJECT_GROUP_ID ? topicGroupStrings.noProject : group.label}
          </Text>
        </Flexbox>
      }
    >
      <Flexbox gap={1} paddingBlock={1}>
        {group.topics.map((topic) => (
          <TopicItem key={topic.id} topic={topic} />
        ))}
      </Flexbox>
    </AccordionItem>
  );
});
