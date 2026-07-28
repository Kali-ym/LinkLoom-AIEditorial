import { useMemo } from 'react';

import { filterTopics, useTopicStore } from '../../../../stores';
import { useAgentStore } from '../../../../stores/agentStore';
import { sortTopics } from '../topicListUtils';

/** All filtered + sorted topics (before page slice). */
export function useAllFilteredTopics() {
  const topics = useTopicStore((s) => s.topics);
  const showCompleted = useTopicStore((s) => s.showCompleted);
  const topicSortBy = useTopicStore((s) => s.topicSortBy);
  const activeAgentId = useAgentStore((s) => s.activeAgentId);

  return useMemo(() => {
    const filtered = filterTopics(topics, showCompleted, activeAgentId);
    return sortTopics(filtered, topicSortBy);
  }, [activeAgentId, showCompleted, topicSortBy, topics]);
}

export function useFilteredTopics() {
  const all = useAllFilteredTopics();
  const topicPageSize = useTopicStore((s) => s.topicPageSize);

  return useMemo(() => all.slice(0, topicPageSize), [all, topicPageSize]);
}

export function useTopicListPagination() {
  const all = useAllFilteredTopics();
  const topicPageSize = useTopicStore((s) => s.topicPageSize);
  const isExpandingPageSize = useTopicStore((s) => s.isExpandingPageSize);
  const loadMoreTopics = useTopicStore((s) => s.loadMoreTopics);

  const hasMore = all.length > topicPageSize;

  return { hasMore, isExpandingPageSize, loadMoreTopics };
}
