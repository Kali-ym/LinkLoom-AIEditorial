import { Button, Flexbox, Icon, Text } from '@lobehub/ui';
import { cssVar } from 'antd-style';
import { MessagesSquare } from 'lucide-react';
import { memo } from 'react';

import { agentTopicManagerStrings } from './agentTopicManagerStrings';
import { useAgentTopicManagerChatHome } from './hooks/useAgentTopicManagerNavigation';

interface EmptyStateProps {
  hasFilters: boolean;
  onClearFilters: () => void;
}

/** §C.53*/
export const EmptyState = memo(function EmptyState({
  hasFilters,
  onClearFilters,
}: EmptyStateProps) {
  const goChat = useAgentTopicManagerChatHome();

  return (
    <Flexbox align="center" flex={1} gap={16} justify="center" paddingBlock={64}>
      <Icon icon={MessagesSquare} size={48} style={{ color: cssVar.colorTextQuaternary }} />
      <Flexbox align="center" gap={4}>
        <Text fontSize={16} weight={600}>
          {hasFilters
            ? agentTopicManagerStrings.emptyFilteredTitle
            : agentTopicManagerStrings.emptyNoTopicsTitle}
        </Text>
        <Text fontSize={13} type="secondary">
          {hasFilters
            ? agentTopicManagerStrings.emptyFilteredDesc
            : agentTopicManagerStrings.emptyNoTopicsDesc}
        </Text>
      </Flexbox>
      {hasFilters ? (
        <Button onClick={onClearFilters}>{agentTopicManagerStrings.emptyFilteredAction}</Button>
      ) : (
        <Button type="primary" onClick={goChat}>
          {agentTopicManagerStrings.emptyNoTopicsAction}
        </Button>
      )}
    </Flexbox>
  );
});
