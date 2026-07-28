import { AccordionItem, ContextMenuTrigger, Flexbox, Text } from '@lobehub/ui';
import { memo } from 'react';

import { NeuralNetworkLoading } from '../../../components/NeuralNetworkLoading';
import { useTopicStore } from '../../../stores';
import { useFilteredTopics } from './hooks/useFilteredTopics';
import { TopicActions } from './Actions';
import { TopicFilter } from './Filter';
import { TopicList } from './List';
import { TopicToggleGroups } from './ToggleGroups';
import { useTopicActionsDropdownMenu } from './useDropdownMenu';

interface TopicSectionProps {
  itemKey: string;
}

/** §C.8 Topic Accordion*/
export const TopicSection = memo(function TopicSection({ itemKey }: TopicSectionProps) {
  const topics = useFilteredTopics();
  const isRevalidating = useTopicStore((s) => s.isRevalidating);
  const revalidateTopics = useTopicStore((s) => s.revalidateTopics);
  const headerMenu = useTopicActionsDropdownMenu();

  return (
    <AccordionItem
      data-section="topics"
      itemKey={itemKey}
      paddingBlock={4}
      paddingInline="8px 4px"
      action={
        <Flexbox horizontal align="center" gap={2}>
          <TopicToggleGroups />
          <TopicFilter />
          <TopicActions />
        </Flexbox>
      }
      headerWrapper={(header) => (
        <ContextMenuTrigger items={headerMenu}>
          <span style={{ display: 'block', minWidth: 0 }}>{header}</span>
        </ContextMenuTrigger>
      )}
      title={
        <Flexbox horizontal align="center" gap={4}>
          <Text ellipsis fontSize={12} type="secondary" weight={500}>
            话题
          </Text>
          {topics.length > 0 && (
            <Text
              fontSize={11}
              style={{ cursor: 'pointer' }}
              type="secondary"
              onClick={(e) => {
                e.stopPropagation();
                revalidateTopics();
              }}
            >
              {topics.length}
            </Text>
          )}
          {isRevalidating && <NeuralNetworkLoading size={14} />}
        </Flexbox>
      }
    >
      <div id="topicsAccordion">
        <Flexbox gap={1} id="topicList" paddingBlock={1}>
          <TopicList />
        </Flexbox>
      </div>
    </AccordionItem>
  );
});
