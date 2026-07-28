import { memo } from 'react';

import { EmptyNavItem } from '../../../NavPanel/EmptyNavItem';
import { SkeletonList } from '../../../NavPanel/SkeletonList';
import { useTopicStore } from '../../../../stores';
import { useAllFilteredTopics } from '../hooks/useFilteredTopics';
import { topicSearchStrings } from '../topicSearchStrings';
import { ByProjectMode } from './ByProjectMode';
import { ByStatusMode } from './ByStatusMode';
import { ByTimeMode } from './ByTimeMode';
import { FlatTopicList } from './GroupedAccordion';
import { SearchResult } from './SearchResult';

/** §C.51*/
export const TopicListContent = memo(function TopicListContent() {
  const groupMode = useTopicStore((s) => s.groupMode);
  const inSearchingMode = useTopicStore((s) => s.inSearchingMode);
  const isRevalidating = useTopicStore((s) => s.isRevalidating);
  const newTopic = useTopicStore((s) => s.newTopic);
  const allTopics = useAllFilteredTopics();

  if (inSearchingMode) return <SearchResult />;

  if (isRevalidating && allTopics.length === 0) {
    return <SkeletonList rows={5} />;
  }

  return (
    <>
      {allTopics.length === 0 && (
        <EmptyNavItem title={topicSearchStrings.addNewTopic} onClick={newTopic} />
      )}
      {groupMode === 'flat' && <FlatTopicList />}
      {groupMode === 'byStatus' && <ByStatusMode />}
      {groupMode === 'byProject' && <ByProjectMode />}
      {groupMode === 'byTime' && <ByTimeMode />}
    </>
  );
});
