import { ActionIcon, type DropdownItem, DropdownMenu, Flexbox, Icon, Segmented, Text } from '@lobehub/ui';
import { confirmModal } from '@lobehub/ui/base-ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { Archive, ChevronDown, MoreHorizontal } from 'lucide-react';
import { memo, useCallback, useMemo } from 'react';

import { showToast } from '../../services/ui/toast';
import { useTopicStore } from '../../stores';
import { useTopicsViewDataStore } from '../../stores/topicsViewDataStore';
import { agentTopicManagerStrings } from './agentTopicManagerStrings';
import { useTopicsViewStore } from './store';
import type { GroupBy, SortBy, StatusFilter, TimeRangeFilter } from './types';

const THREE_MONTHS_MS = 90 * 24 * 60 * 60 * 1000;

const styles = createStaticStyles(({ css }) => ({
  divider: css`
    width: 1px;
    height: 16px;
    margin-inline: 4px;
    background: ${cssVar.colorBorderSecondary};
  `,
  filterBtn: css`
    font-size: 12px;
  `,
}));

const CheckMark = ({ visible }: { visible: boolean }) => (
  <span style={{ display: 'inline-block', width: 12 }}>{visible ? '✓' : ''}</span>
);

interface ToolbarProps {
  statusCounts: Record<'all' | 'pending' | 'running' | 'completed', number>;
}

/** §C.53*/
const ToolbarActions = memo(function ToolbarActions() {
  const topics = useTopicsViewDataStore((s) => s.items);
  const markTopicCompleted = useTopicStore((s) => s.markTopicCompleted);

  const handleArchiveStale = useCallback(() => {
    const cutoff = Date.now() - THREE_MONTHS_MS;
    const stale = topics.filter((t) => {
      if (t.status === 'completed') return false;
      const updated = t.updatedAt ? new Date(t.updatedAt).getTime() : 0;
      return updated > 0 && updated < cutoff;
    });
    if (stale.length === 0) {
      showToast(agentTopicManagerStrings.archiveStaleNone);
      return;
    }
    confirmModal({
      content: agentTopicManagerStrings.archiveStaleConfirm(stale.length),
      okText: agentTopicManagerStrings.archiveStaleConfirmOk,
      onOk: () => {
        stale.forEach((t) => markTopicCompleted(t.id));
        showToast(agentTopicManagerStrings.archiveStaleDone(stale.length));
      },
      title: agentTopicManagerStrings.archiveStaleTitle,
    });
  }, [markTopicCompleted, topics]);

  const items: DropdownItem[] = useMemo(
    () => [
      {
        icon: <Archive size={14} />,
        key: 'archive-stale',
        label: agentTopicManagerStrings.archiveStaleLabel,
        onClick: handleArchiveStale,
      },
    ],
    [handleArchiveStale],
  );

  return (
    <DropdownMenu items={items}>
      <ActionIcon icon={MoreHorizontal} title="更多操作" />
    </DropdownMenu>
  );
});

/** §C.53*/
export const AgentTopicManagerToolbar = memo(function AgentTopicManagerToolbar({
  statusCounts,
}: ToolbarProps) {
  const status = useTopicsViewStore((s) => s.status);
  const setStatus = useTopicsViewStore((s) => s.setStatus);
  const timeRange = useTopicsViewStore((s) => s.timeRange);
  const setTimeRange = useTopicsViewStore((s) => s.setTimeRange);
  const sortBy = useTopicsViewStore((s) => s.sortBy);
  const setSortBy = useTopicsViewStore((s) => s.setSortBy);
  const groupBy = useTopicsViewStore((s) => s.groupBy);
  const setGroupBy = useTopicsViewStore((s) => s.setGroupBy);

  const statusOptions = useMemo(
    () =>
      (
        [
          ['all', agentTopicManagerStrings.statusAll],
          ['pending', agentTopicManagerStrings.statusPending],
          ['running', agentTopicManagerStrings.statusRunning],
          ['completed', agentTopicManagerStrings.statusCompleted],
        ] as const
      ).map(([value, label]) => ({
        label: (
          <Flexbox horizontal align="center" gap={6}>
            <span>{label}</span>
            <Text fontSize={11} type="secondary">
              {statusCounts[value]}
            </Text>
          </Flexbox>
        ),
        value,
      })),
    [statusCounts],
  );

  const timeMenu: DropdownItem[] = (['all', 'today', 'week', 'month'] as TimeRangeFilter[]).map((key) => ({
    icon: <CheckMark visible={timeRange === key} />,
    key,
    label: {
      all: agentTopicManagerStrings.timeAll,
      today: agentTopicManagerStrings.timeToday,
      week: agentTopicManagerStrings.timeWeek,
      month: agentTopicManagerStrings.timeMonth,
    }[key],
    onClick: () => setTimeRange(key),
  }));

  const sortMenu: DropdownItem[] = (['updatedAt', 'createdAt', 'title'] as SortBy[]).map((key) => ({
    icon: <CheckMark visible={sortBy === key} />,
    key,
    label: {
      updatedAt: agentTopicManagerStrings.sortUpdated,
      createdAt: agentTopicManagerStrings.sortCreated,
      title: agentTopicManagerStrings.sortTitle,
    }[key],
    onClick: () => setSortBy(key),
  }));

  const groupMenu: DropdownItem[] = (['byTime', 'byProject', 'none'] as GroupBy[]).map((key) => ({
    icon: <CheckMark visible={groupBy === key} />,
    key,
    label: {
      byTime: agentTopicManagerStrings.groupByTime,
      byProject: agentTopicManagerStrings.groupByProject,
      none: agentTopicManagerStrings.groupNone,
    }[key],
    onClick: () => setGroupBy(key),
  }));

  const dropdownBtn = (label: string, items: DropdownItem[]) => (
    <DropdownMenu items={items}>
      <button className={styles.filterBtn} type="button">
        {label} <Icon icon={ChevronDown} size={12} />
      </button>
    </DropdownMenu>
  );

  return (
    <Flexbox gap={12}>
      <Flexbox horizontal align="center" gap={8} style={{ flexWrap: 'wrap' }}>
        <Segmented options={statusOptions} size="small" value={status} onChange={(v) => setStatus(v as StatusFilter)} />
        <span className={styles.divider} />
        {dropdownBtn('时间', timeMenu)}
        <Flexbox horizontal align="center" gap={8} style={{ marginInlineStart: 'auto' }}>
          {dropdownBtn('分组', groupMenu)}
          {dropdownBtn('排序', sortMenu)}
          <ToolbarActions />
        </Flexbox>
      </Flexbox>
    </Flexbox>
  );
});
