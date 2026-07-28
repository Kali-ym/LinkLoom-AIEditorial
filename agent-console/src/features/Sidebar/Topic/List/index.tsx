import { memo } from 'react';

import { AllTopicsDrawer } from '../AllTopicsDrawer';
import { TopicListContent } from '../TopicListContent';

/** §C.8 / §C.50 Topic list router — flat / byStatus / byTime + AllTopicsDrawer */
export const TopicList = memo(function TopicList() {
  return (
    <>
      <TopicListContent />
      <AllTopicsDrawer />
    </>
  );
});
