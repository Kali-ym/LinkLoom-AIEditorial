import { ActionIcon, DropdownMenu } from '@lobehub/ui';
import { ListFilter } from 'lucide-react';
import { memo } from 'react';

import { topicFilterStrings } from './topicFilterStrings';
import { useTopicFilterDropdownMenu } from './useFilterMenu';

export const TopicFilter = memo(function TopicFilter() {
  const menuItems = useTopicFilterDropdownMenu();
  return (
    <DropdownMenu items={menuItems}>
      <span style={{ display: 'inline-flex' }}>
        <ActionIcon
          aria-label={topicFilterStrings.filterAria}
          icon={ListFilter}
          size="small"
        />
      </span>
    </DropdownMenu>
  );
});
