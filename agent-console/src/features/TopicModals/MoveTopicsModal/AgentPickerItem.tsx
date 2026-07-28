import { Avatar, Block, Text } from '@lobehub/ui';
import { memo } from 'react';

import type { Agent } from '../../../domain/types';

interface AgentPickerItemProps {
  agent: Agent;
  onSelect: () => void;
}

/** §C.52*/
export const AgentPickerItem = memo(function AgentPickerItem({
  agent,
  onSelect,
}: AgentPickerItemProps) {
  return (
    <Block
      clickable
      horizontal
      align="center"
      gap={8}
      paddingBlock={6}
      paddingInline={8}
      variant="borderless"
      onClick={onSelect}
    >
      <Avatar avatar={agent.gradient} shape="square" size={28} title={agent.name} />
      <Text ellipsis style={{ flex: 1, minWidth: 0 }}>
        {agent.name}
      </Text>
    </Block>
  );
});
