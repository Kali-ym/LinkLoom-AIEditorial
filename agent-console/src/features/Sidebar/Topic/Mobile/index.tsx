import { Flexbox } from '@lobehub/ui';
import { memo } from 'react';

import { TopicListContent } from '../TopicListContent';
import { TopicSearchBar } from '../TopicSearchBar';
import { TopicModal } from './TopicModal';

/** §C.51*/
export const MobileTopicPanel = memo(function MobileTopicPanel() {
  return (
    <TopicModal>
      <Flexbox gap={8} height="100%" padding="8px 8px 0" style={{ overflow: 'hidden' }}>
        <TopicSearchBar />
        <Flexbox
          height="100%"
          style={{
            marginInline: -8,
            overflowX: 'hidden',
            overflowY: 'auto',
            position: 'relative',
          }}
          width="calc(100% + 16px)"
        >
          <TopicListContent />
        </Flexbox>
      </Flexbox>
    </TopicModal>
  );
});
