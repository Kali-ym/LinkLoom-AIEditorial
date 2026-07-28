import { Flexbox, Skeleton, Text } from '@lobehub/ui';
import { memo, useEffect, useMemo, useRef, useState } from 'react';

import { searchTopicsByKeyword } from '../../hooks/data/useTopics';
import type { TopicViewGroup, TopicViewItem } from '../../domain/types/topicView';
import { useFetchAgentTopicsView } from '../../hooks/useFetchAgentTopicsView';
import { useAgentStore } from '../../stores';
import { BulkActionBar } from './BulkActionBar';
import { EmptyState } from './EmptyState';
import { AgentTopicManagerHeader } from './Header';
import { AgentTopicManagerToolbar } from './Toolbar';
import { TopicGrid } from './TopicGrid';
import { TopicListView } from './TopicListView';
import { agentTopicManagerStrings } from './agentTopicManagerStrings';
import { useTopicsViewStore } from './store';
import {
  groupTopicsByProject,
  groupTopicsByUpdatedTime,
  matchesGroup,
  matchesStatus,
  matchesTimeRange,
  sortTopicsView,
} from './utils';

/** §C.53*/
export const AgentTopicManager = memo(function AgentTopicManager() {
  const activeAgentId = useAgentStore((s) => s.activeAgentId);
  const {
    items: allTopics,
    hasMore,
    isLoading,
    isLoadingMore,
    loadMore,
  } = useFetchAgentTopicsView({ agentId: activeAgentId });

  const reset = useTopicsViewStore((s) => s.reset);
  const search = useTopicsViewStore((s) => s.search);
  const status = useTopicsViewStore((s) => s.status);
  const groupIds = useTopicsViewStore((s) => s.groupIds);
  const timeRange = useTopicsViewStore((s) => s.timeRange);
  const sortBy = useTopicsViewStore((s) => s.sortBy);
  const groupBy = useTopicsViewStore((s) => s.groupBy);
  const viewMode = useTopicsViewStore((s) => s.viewMode);
  const setStatus = useTopicsViewStore((s) => s.setStatus);
  const setGroupIds = useTopicsViewStore((s) => s.setGroupIds);
  const setTimeRange = useTopicsViewStore((s) => s.setTimeRange);
  const setSearch = useTopicsViewStore((s) => s.setSearch);

  const [searchResults, setSearchResults] = useState<TopicViewItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    reset();
  }, [activeAgentId, reset]);

  const trimmedSearch = search.trim();

  useEffect(() => {
    if (!trimmedSearch) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const timer = window.setTimeout(() => {
      void searchTopicsByKeyword(trimmedSearch, allTopics).then((results) => {
        setSearchResults(results as TopicViewItem[]);
        setIsSearching(false);
      });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [allTopics, trimmedSearch]);

  const baseTopics = trimmedSearch.length > 0 ? searchResults : allTopics;

  const preStatusPool = useMemo(
    () => baseTopics.filter((t) => matchesGroup(t, groupIds) && matchesTimeRange(t, timeRange)),
    [baseTopics, groupIds, timeRange],
  );

  const filtered = useMemo(() => {
    const out = preStatusPool.filter((t) => matchesStatus(t, status));
    return sortTopicsView(out, sortBy);
  }, [preStatusPool, sortBy, status]);

  const statusCounts = useMemo(
    () => ({
      all: preStatusPool.length,
      pending: preStatusPool.filter((t) => matchesStatus(t, 'pending')).length,
      completed: preStatusPool.filter((t) => matchesStatus(t, 'completed')).length,
      running: preStatusPool.filter((t) => matchesStatus(t, 'running')).length,
    }),
    [preStatusPool],
  );

  const isSearchMode = trimmedSearch.length > 0;
  const useGroups = groupBy !== 'none' && !isSearchMode;

  const renderGroups: TopicViewGroup[] = useMemo(() => {
    if (!useGroups) return [{ children: filtered, id: 'all' }];
    if (groupBy === 'byProject') return groupTopicsByProject(filtered);
    return groupTopicsByUpdatedTime(filtered);
  }, [filtered, groupBy, useGroups]);

  const hasActiveFilters =
    status !== 'all' ||
    groupIds.length > 0 ||
    timeRange !== 'all' ||
    trimmedSearch.length > 0;

  const clearFilters = () => {
    setStatus('all');
    setGroupIds([]);
    setTimeRange('all');
    setSearch('');
  };

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isSearchMode) return;
    const root = scrollContainerRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !isLoadingMore) void loadMore();
      },
      { root, rootMargin: '300px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, isSearchMode, loadMore]);

  if (!activeAgentId) {
    return (
      <Flexbox align="center" flex={1} justify="center">
        <Skeleton active paragraph={{ rows: 4 }} />
      </Flexbox>
    );
  }

  const showInitialLoading = (isLoading || isSearching) && baseTopics.length === 0;

  return (
    <Flexbox flex={1} height="100%" style={{ overflow: 'hidden' }}>
      <AgentTopicManagerHeader />
      <div
        ref={scrollContainerRef}
        style={{
          display: 'flex',
          flex: 1,
          flexDirection: 'column',
          minWidth: 0,
          overflowY: 'auto',
          padding: '20px 24px',
        }}
      >
        <Flexbox gap={16} style={{ marginInline: 'auto', maxWidth: 1440, width: '100%' }}>
          <AgentTopicManagerToolbar statusCounts={statusCounts} />
          <BulkActionBar />
          {showInitialLoading ? (
            <Skeleton active paragraph={{ rows: 6 }} title={false} />
          ) : filtered.length === 0 ? (
            <EmptyState hasFilters={hasActiveFilters} onClearFilters={clearFilters} />
          ) : (
            <>
              {viewMode === 'card' ? (
                <TopicGrid groupBy={groupBy} groups={renderGroups} showGroupTitles={useGroups} />
              ) : (
                <TopicListView groupBy={groupBy} groups={renderGroups} showGroupTitles={useGroups} />
              )}
              {!isSearchMode && hasMore ? <div aria-hidden ref={sentinelRef} style={{ height: 1 }} /> : null}
              {!isSearchMode && isLoadingMore ? (
                <Flexbox align="center" paddingBlock={12}>
                  <Text fontSize={12} type="secondary">
                    {agentTopicManagerStrings.loadingMore}
                  </Text>
                </Flexbox>
              ) : null}
            </>
          )}
        </Flexbox>
      </div>
    </Flexbox>
  );
});
