import { SearchBar } from '@lobehub/ui';
import { memo, useEffect, useState } from 'react';

import { useLayoutStore, useTopicStore } from '../../../../stores';
import { topicSearchStrings } from '../topicSearchStrings';

/** §C.51*/
export const TopicSearchBar = memo(function TopicSearchBar({
  onClear,
}: {
  onClear?: () => void;
}) {
  const [tempValue, setTempValue] = useState('');
  const [searchKeyword, setSearchKeywords] = useState('');
  const isMobileViewport = useLayoutStore((s) => s.isMobileViewport);
  const startTopicSearch = useTopicStore((s) => s.startTopicSearch);
  const resetTopicSearchMode = useTopicStore((s) => s.resetTopicSearchMode);

  useEffect(
    () => () => {
      resetTopicSearchMode();
    },
    [resetTopicSearchMode],
  );

  const startSearchTopic = () => {
    if (tempValue === searchKeyword) return;
    setSearchKeywords(tempValue);
    startTopicSearch(tempValue);
  };

  return (
    <SearchBar
      autoFocus
      placeholder={topicSearchStrings.searchPlaceholder}
      spotlight={!isMobileViewport}
      value={tempValue}
      variant="filled"
      onPressEnter={startSearchTopic}
      onBlur={() => {
        if (tempValue === '') {
          onClear?.();
          return;
        }
        startSearchTopic();
      }}
      onChange={(e) => {
        setTempValue(e.target.value);
      }}
    />
  );
});
