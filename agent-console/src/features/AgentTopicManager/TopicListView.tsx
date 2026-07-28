import { ActionIcon, Checkbox, DropdownMenu, Flexbox, Icon, Tag, Text } from '@lobehub/ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { Folder, MoreHorizontal, Star } from 'lucide-react';
import { Fragment, memo, type MouseEvent, useCallback, useMemo } from 'react';
import { VList } from 'virtua';

import type { TopicViewGroup } from '../../domain/types/topicView';
import { NAV_DROPDOWN_MENU_PROPS } from '../NavPanel/navDropdownMenuProps';
import { StatusDot } from './StatusDot';
import { agentTopicManagerStrings } from './agentTopicManagerStrings';
import { useAgentTopicManagerNavigation } from './hooks/useAgentTopicManagerNavigation';
import { useTopicsViewStore } from './store';
import type { GroupBy } from './types';
import { getProjectGroupTitle, getProjectLabel, getTimeGroupTitle } from './utils';
import { useTopicListViewDropdownMenu } from './useTopicListViewDropdownMenu';

const styles = createStaticStyles(({ css }) => ({
  groupBar: css`
    display: flex;
    gap: 6px;
    align-items: baseline;
    padding-block: 8px;
    padding-inline: 16px;
    border-block-end: 1px solid ${cssVar.colorSplit};
    font-size: 12px;
    font-weight: 500;
    color: ${cssVar.colorTextSecondary};
    background: ${cssVar.colorFillQuaternary};
  `,
  header: css`
    position: sticky;
    z-index: 2;
    inset-block-start: 0;
    display: grid;
    grid-template-columns: 24px minmax(0, 1fr) 120px 100px 80px 100px 32px;
    gap: 12px;
    align-items: center;
    padding-block: 10px;
    padding-inline: 16px;
    border-block-end: 1px solid ${cssVar.colorSplit};
    font-size: 12px;
    font-weight: 500;
    color: ${cssVar.colorTextSecondary};
    background: ${cssVar.colorBgElevated};
  `,
  list: css`
    overflow: hidden;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 12px;
    background: ${cssVar.colorBgContainer};
  `,
  row: css`
    cursor: pointer;
    display: grid;
    grid-template-columns: 24px minmax(0, 1fr) 120px 100px 80px 100px 32px;
    gap: 12px;
    align-items: center;
    padding-block: 10px;
    padding-inline: 16px;
    border-block-end: 1px solid ${cssVar.colorSplit};
    transition: background 0.12s;
    &:hover {
      background: ${cssVar.colorFillTertiary};
    }
  `,
  rowSelected: css`
    background: ${cssVar.colorPrimaryBg};
  `,
}));

const TopicRow = memo(function TopicRow({
  topic,
}: {
  topic: TopicViewGroup['children'][number];
}) {
  const navigateTopic = useAgentTopicManagerNavigation();
  const selectedIds = useTopicsViewStore((s) => s.selectedIds);
  const selectMode = useTopicsViewStore((s) => s.selectMode);
  const toggleSelected = useTopicsViewStore((s) => s.toggleSelected);
  const toggleSelectMode = useTopicsViewStore((s) => s.toggleSelectMode);
  const { dropdownMenu } = useTopicListViewDropdownMenu(topic);

  const selected = selectedIds.includes(topic.id);

  const handleClick = useCallback(
    (e: MouseEvent) => {
      if (selectMode || e.metaKey || e.ctrlKey) {
        e.preventDefault();
        if (!selectMode) toggleSelectMode();
        toggleSelected(topic.id);
        return;
      }
      navigateTopic(topic.id);
    },
    [navigateTopic, selectMode, toggleSelectMode, toggleSelected, topic.id],
  );

  return (
    <div className={`${styles.row} ${selected ? styles.rowSelected : ''}`} onClick={handleClick}>
      <Checkbox checked={selected} onChange={() => toggleSelected(topic.id)} onClick={(e) => e.stopPropagation()} />
      <Flexbox gap={2} style={{ minWidth: 0 }}>
        <Flexbox horizontal align="center" gap={6}>
          <Text ellipsis weight={500}>
            {topic.title}
          </Text>
          {topic.fav ? <Icon color={cssVar.colorWarning} icon={Star} size="small" /> : null}
        </Flexbox>
        {topic.description ? (
          <Text ellipsis fontSize={11} type="secondary">
            {topic.description}
          </Text>
        ) : null}
      </Flexbox>
      <Flexbox horizontal align="center" gap={4} style={{ minWidth: 0 }}>
        {topic.workingDirectory ? (
          <>
            <Icon color={cssVar.colorTextDescription} icon={Folder} size={12} />
            <Text ellipsis fontSize={11} type="secondary">
              {getProjectLabel(topic)}
            </Text>
          </>
        ) : (
          <Text fontSize={11} type="secondary">
            —
          </Text>
        )}
      </Flexbox>
      <Flexbox horizontal align="center" gap={6}>
        <StatusDot topic={topic} />
      </Flexbox>
      <Tag size="small">{topic.trigger ?? 'chat'}</Tag>
      <Text fontSize={11} type="secondary">
        {topic.updatedAt ? new Date(topic.updatedAt).toLocaleDateString() : '—'}
      </Text>
      <DropdownMenu items={dropdownMenu} {...NAV_DROPDOWN_MENU_PROPS}>
        <ActionIcon
          icon={MoreHorizontal}
          size="small"
          onClick={(e) => {
            e.stopPropagation();
          }}
        />
      </DropdownMenu>
    </div>
  );
});

interface TopicListViewProps {
  groupBy: GroupBy;
  groups: TopicViewGroup[];
  showGroupTitles: boolean;
}

/** §C.53*/
export const TopicListView = memo(function TopicListView({
  groupBy,
  groups,
  showGroupTitles,
}: TopicListViewProps) {
  const allIds = groups.flatMap((g) => g.children.map((t) => t.id));
  const selectedIds = useTopicsViewStore((s) => s.selectedIds);
  const selectAll = useTopicsViewStore((s) => s.selectAll);
  const clearSelected = useTopicsViewStore((s) => s.clearSelected);

  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.includes(id));
  const indeterminate = selectedIds.length > 0 && !allSelected;
  const flatTopics = useMemo(() => groups.flatMap((group) => group.children), [groups]);

  const header = (
    <div className={styles.header}>
      <Checkbox
        checked={allSelected}
        indeterminate={indeterminate}
        onChange={(checked) => {
          if (checked) selectAll(allIds);
          else clearSelected();
        }}
      />
      <span>{agentTopicManagerStrings.colTitle}</span>
      <span>{agentTopicManagerStrings.colProject}</span>
      <span>{agentTopicManagerStrings.colStatus}</span>
      <span>{agentTopicManagerStrings.colSource}</span>
      <span style={{ textAlign: 'end' }}>{agentTopicManagerStrings.colUpdated}</span>
      <span />
    </div>
  );

  if (!showGroupTitles && flatTopics.length > 0) {
    return (
      <div className={styles.list}>
        {header}
        <VList style={{ maxHeight: 560 }}>
          {flatTopics.map((topic) => (
            <TopicRow key={topic.id} topic={topic} />
          ))}
        </VList>
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {header}
      {groups.map((group) => (
        <Fragment key={group.id}>
          {showGroupTitles ? (
            <div className={styles.groupBar}>
              {group.title ??
                (groupBy === 'byProject'
                  ? getProjectGroupTitle(group.id, group.children[0])
                  : getTimeGroupTitle(group.id))}
              <Text fontSize={11} type="secondary">
                {group.children.length}
              </Text>
            </div>
          ) : null}
          {group.children.map((topic) => (
            <TopicRow key={topic.id} topic={topic} />
          ))}
        </Fragment>
      ))}
    </div>
  );
});
