import { Center, Text } from '@lobehub/ui';
import { memo } from 'react';

import { SkeletonList } from '../../../../NavPanel/SkeletonList';
import { useTopicStore } from '../../../../../stores';
import { TopicItem } from '../../List/Item';
import { topicSearchStrings } from '../../topicSearchStrings';

/** §C.51*/
export const SearchResult = memo(function SearchResult() {
  const isSearchingTopic = useTopicStore((s) => s.isSearchingTopic);
  const topics = useTopicStore((s) => s.searchTopics);

  if (isSearchingTopic) return <SkeletonList />;

  if (topics.length === 0) {
    return (
      <Center paddingBlock={12}>
        <Text type="secondary">{topicSearchStrings.searchResultEmpty}</Text>
      </Center>
    );
  }

  return (
    <>
      {topics.map((topic) => (
        <TopicItem key={topic.id} topic={topic} />
      ))}
    </>
  );
});
