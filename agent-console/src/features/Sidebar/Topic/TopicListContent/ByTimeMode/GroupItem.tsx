import { AccordionItem, Flexbox, Text } from '@lobehub/ui';
import { memo, useMemo } from 'react';

import { formatTimeGroupTitle } from '../../topicGroupStrings';
import { TopicItem } from '../../List/Item';
import type { GroupItemComponentProps } from '../GroupedAccordion';

/** §C.44*/
export const ByTimeGroupItem = memo(function ByTimeGroupItem({ group }: GroupItemComponentProps) {
  const timeTitle = useMemo(
    () => formatTimeGroupTitle(group.id, group.label || undefined),
    [group.id, group.label],
  );

  return (
    <AccordionItem
      itemKey={group.id}
      paddingBlock={4}
      paddingInline="8px 4px"
      title={
        <Flexbox horizontal align="center" gap={6} height={24} style={{ overflow: 'hidden' }}>
          <Text ellipsis fontSize={12} style={{ flex: 1 }} type="secondary" weight={500}>
            {timeTitle}
          </Text>
        </Flexbox>
      }
    >
      <Flexbox gap={1} paddingBlock={1}>
        {group.topics.map((topic) => (
          <TopicItem key={topic.id} topic={topic} />
        ))}
      </Flexbox>
    </AccordionItem>
  );
});
