import { Accordion, Flexbox } from '@lobehub/ui';
import { MoreHorizontal } from 'lucide-react';
import { type ComponentType, memo, useCallback, useEffect, useMemo, type Key } from 'react';

import { NavItem } from '../../../NavPanel/NavItem';
import { SkeletonList } from '../../../NavPanel/SkeletonList';
import { useStreamingStore, useTopicStore } from '../../../../stores';
import { topicGroupStrings } from '../topicGroupStrings';
import { groupTopicsByMode, splitTempTopics, collectPinnedSidebarTopics } from '../topicListUtils';
import {
  useFilteredTopics,
  useTopicListPagination,
} from '../hooks/useFilteredTopics';
import { useTopicSidebarLoadMore } from '../hooks/useTopicSidebarLoadMore';
import { TopicItem } from '../List/Item';

export interface GroupItemComponentProps {
  expanded: boolean;
  group: import('../topicListUtils').TopicGroup;
}

interface GroupedAccordionProps {
  GroupItem: ComponentType<GroupItemComponentProps>;
}

function keysEqual(a: string[], b: string[]) {
  return a.length === b.length && a.every((key, index) => key === b[index]);
}

/** §C.44*/
export const GroupedAccordion = memo(function GroupedAccordion({
  GroupItem,
}: GroupedAccordionProps) {
  const topics = useFilteredTopics();
  const groupMode = useTopicStore((s) => s.groupMode);
  const expandTopicGroupKeys = useTopicStore((s) => s.expandTopicGroupKeys);
  const setExpandTopicGroupKeys = useTopicStore((s) => s.setExpandTopicGroupKeys);
  const topicSortBy = useTopicStore((s) => s.topicSortBy);
  const topicLoadingIds = useTopicStore((s) => s.topicLoadingIds);
  const streamsByTopicId = useStreamingStore((s) => s.streamsByTopicId);

  const pinnedTopics = useMemo(() => collectPinnedSidebarTopics(topics), [topics]);

  const groups = useMemo(() => {
    const streamingTopicIds = Object.entries(streamsByTopicId)
      .filter(([, runtime]) => runtime.isStreaming)
      .map(([topicId]) => topicId);
    return groupTopicsByMode(topics, groupMode, {
      loadingTopicIds: new Set([...topicLoadingIds, ...streamingTopicIds]),
      sortBy: topicSortBy,
      unreadTopicIds: new Set(topics.filter((t) => t.status === 'unread').map((t) => t.id)),
    });
  }, [groupMode, streamsByTopicId, topicLoadingIds, topicSortBy, topics]);

  const { hasMore, isExpandingPageSize } = useTopicListPagination();
  const onLoadMore = useTopicSidebarLoadMore();

  useEffect(() => {
    setExpandTopicGroupKeys(undefined);
  }, [topicSortBy, groupMode, setExpandTopicGroupKeys]);

  const defaultExpandedKeys = useMemo(() => groups.map((g) => g.id), [groups]);
  const expandedKeys = useMemo(
    () => expandTopicGroupKeys ?? defaultExpandedKeys,
    [defaultExpandedKeys, expandTopicGroupKeys],
  );

  const handleExpandedChange = useCallback(
    (keys: Key[]) => {
      const nextKeys = keys.map(String);
      const current = useTopicStore.getState().expandTopicGroupKeys ?? defaultExpandedKeys;
      if (keysEqual(nextKeys, current)) return;
      setExpandTopicGroupKeys(nextKeys);
    },
    [defaultExpandedKeys, setExpandTopicGroupKeys],
  );

  return (
    <Flexbox gap={2}>
      {pinnedTopics.length > 0 ? (
        <Flexbox gap={1}>
          {pinnedTopics.map((topic) => (
            <TopicItem key={topic.id} topic={topic} />
          ))}
        </Flexbox>
      ) : null}
      <Accordion expandedKeys={expandedKeys} gap={2} onExpandedChange={handleExpandedChange}>
        {groups.map((group) => (
          <GroupItem
            expanded={expandedKeys.includes(group.id)}
            group={group}
            key={group.id}
          />
        ))}
      </Accordion>
      {isExpandingPageSize ? <SkeletonList rows={3} /> : null}
      {hasMore && !isExpandingPageSize ? (
        <NavItem icon={MoreHorizontal} title={topicGroupStrings.loadMore} onClick={onLoadMore} />
      ) : null}
    </Flexbox>
  );
});

/** §C.44 FlatMode — 平铺 + loadMore */
export const FlatTopicList = memo(function FlatTopicList() {
  const topics = useFilteredTopics();
  const { tempTopics, rest } = useMemo(() => splitTempTopics(topics), [topics]);
  const { hasMore, isExpandingPageSize } = useTopicListPagination();
  const onLoadMore = useTopicSidebarLoadMore();

  return (
    <Flexbox gap={1}>
      {tempTopics.map((topic) => (
        <TopicItem key={topic.id} topic={topic} />
      ))}
      {rest.map((topic) => (
        <TopicItem key={topic.id} topic={topic} />
      ))}
      {isExpandingPageSize ? <SkeletonList rows={3} /> : null}
      {hasMore && !isExpandingPageSize ? (
        <NavItem icon={MoreHorizontal} title={topicGroupStrings.loadMore} onClick={onLoadMore} />
      ) : null}
    </Flexbox>
  );
});
