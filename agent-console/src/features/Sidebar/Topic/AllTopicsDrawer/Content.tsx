import { Flexbox } from '@lobehub/ui';
import { memo, useCallback, useEffect, useRef } from 'react';
import { VList, type VListHandle } from 'virtua';

import { TopicEmpty } from '../../../TopicEmpty';
import { SkeletonList } from '../../../NavPanel/SkeletonList';
import { useTopicStore } from '../../../../stores';
import { useAllFilteredTopics } from '../hooks/useFilteredTopics';
import { TopicItem } from '../List/Item';

const ITEM_HEIGHT = 36;

/** §C.50*/
export default memo(function AllTopicsDrawerContent({
  open,
  searchKeyword,
}: {
  open: boolean;
  searchKeyword: string;
}) {
  const virtuaRef = useRef<VListHandle>(null);
  const fetchedCountRef = useRef(-1);
  const initializedRef = useRef(false);

  const topicPageSize = useTopicStore((s) => s.topicPageSize);
  const isExpandingPageSize = useTopicStore((s) => s.isExpandingPageSize);
  const isLoadingMoreTopics = useTopicStore((s) => s.isLoadingMoreTopics);
  const isSearchingTopic = useTopicStore((s) => s.isSearchingTopic);
  const searchTopics = useTopicStore((s) => s.searchTopics);
  const loadMoreTopics = useTopicStore((s) => s.loadMoreTopics);
  const searchTopicsForKeyword = useTopicStore((s) => s.searchTopicsForKeyword);
  const clearTopicSearch = useTopicStore((s) => s.clearTopicSearch);

  const allTopics = useAllFilteredTopics();
  const trimmedKeyword = searchKeyword.trim();
  const isSearching = trimmedKeyword.length > 0;

  useEffect(() => {
    if (!isSearching) {
      clearTopicSearch();
      return;
    }
    void searchTopicsForKeyword(trimmedKeyword);
  }, [clearTopicSearch, isSearching, searchTopicsForKeyword, trimmedKeyword]);

  const displayList = isSearching ? searchTopics : allTopics.slice(0, topicPageSize);
  const count = displayList.length;
  const hasMore = !isSearching && allTopics.length > topicPageSize;

  useEffect(() => {
    if (fetchedCountRef.current > count) {
      fetchedCountRef.current = count - 1;
    }
  }, [count]);

  useEffect(() => {
    if (!open || initializedRef.current || isLoadingMoreTopics || isSearching) return;

    const timer = window.setTimeout(() => {
      const ref = virtuaRef.current;
      if (!ref) return;

      const viewportSize = ref.viewportSize;
      const itemsNeeded = Math.ceil(viewportSize / ITEM_HEIGHT) + 3;
      initializedRef.current = true;

      if (count < itemsNeeded && hasMore) {
        fetchedCountRef.current = count;
        const itemsToLoad = itemsNeeded - count;
        const pagesNeeded = Math.ceil(itemsToLoad / 20);

        const loadPages = async () => {
          for (let i = 0; i < pagesNeeded && hasMore; i++) {
            await loadMoreTopics();
          }
        };
        void loadPages();
      }
    }, 100);

    return () => window.clearTimeout(timer);
  }, [count, hasMore, isLoadingMoreTopics, isSearching, loadMoreTopics, open]);

  useEffect(() => {
    if (!open) {
      initializedRef.current = false;
    }
  }, [open]);

  const handleScroll = useCallback(async () => {
    if (isSearching) return;

    const ref = virtuaRef.current;
    if (!ref || !hasMore) return;

    const bottomVisibleIndex = ref.findItemIndex(ref.scrollOffset + ref.viewportSize);
    if (fetchedCountRef.current < count && bottomVisibleIndex + 5 > count) {
      fetchedCountRef.current = count;
      await loadMoreTopics();
    }
  }, [count, hasMore, isSearching, loadMoreTopics]);

  const showLoading = (isLoadingMoreTopics || isExpandingPageSize) && !isSearching;
  const showSearchLoading = isSearching && isSearchingTopic;

  if (count === 0 && !showLoading && !showSearchLoading) {
    return <TopicEmpty search={isSearching} />;
  }

  if (showSearchLoading) {
    return (
      <Flexbox gap={1} paddingBlock={1} paddingInline={4}>
        <SkeletonList rows={5} />
      </Flexbox>
    );
  }

  return (
    <VList
      ref={virtuaRef}
      bufferSize={typeof window !== 'undefined' ? window.innerHeight : 0}
      style={{ height: '100%' }}
      onScroll={handleScroll}
    >
      {displayList.map((topic) => (
        <Flexbox key={topic.id} gap={1} paddingInline={4}>
          <TopicItem topic={topic} />
        </Flexbox>
      ))}
      {showLoading ? (
        <Flexbox padding="4px 8px">
          <SkeletonList rows={3} />
        </Flexbox>
      ) : null}
    </VList>
  );
});
