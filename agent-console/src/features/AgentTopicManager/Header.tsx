import { Flexbox, Icon, Input, Segmented, Text } from '@lobehub/ui';
import { cssVar } from 'antd-style';
import { ChevronRight, LayoutGrid, List as ListIcon, Search } from 'lucide-react';
import { memo } from 'react';

import { NavHeader } from '../NavHeader';
import { useAgentStore } from '../../stores';
import { agentTopicManagerStrings } from './agentTopicManagerStrings';
import { useAgentTopicManagerChatHome } from './hooks/useAgentTopicManagerNavigation';
import { useTopicsViewStore } from './store';

/** §C.53*/
export const AgentTopicManagerHeader = memo(function AgentTopicManagerHeader() {
  const agent = useAgentStore((s) => s.getActiveAgent());
  const goChat = useAgentTopicManagerChatHome();
  const viewMode = useTopicsViewStore((s) => s.viewMode);
  const setViewMode = useTopicsViewStore((s) => s.setViewMode);
  const search = useTopicsViewStore((s) => s.search);
  const setSearch = useTopicsViewStore((s) => s.setSearch);

  return (
    <NavHeader
      styles={{ center: { maxWidth: 560, paddingInline: 16 } }}
      left={
        <Flexbox horizontal align="center" gap={4}>
          <button
            type="button"
            style={{
              background: 'none',
              border: 'none',
              color: cssVar.colorText,
              cursor: 'pointer',
              fontWeight: 500,
              maxWidth: 200,
              overflow: 'hidden',
              padding: 0,
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            onClick={goChat}
          >
            {agent.name}
          </button>
          <Icon color={cssVar.colorTextQuaternary} icon={ChevronRight} size={14} />
          <Text weight={500}>{agentTopicManagerStrings.title}</Text>
        </Flexbox>
      }
      right={
        <Segmented
          size="small"
          value={viewMode}
          variant="borderless"
          options={[
            { icon: <Icon icon={LayoutGrid} />, title: agentTopicManagerStrings.viewCard, value: 'card' },
            { icon: <Icon icon={ListIcon} />, title: agentTopicManagerStrings.viewList, value: 'list' },
          ]}
          onChange={(v) => setViewMode(v as 'card' | 'list')}
        />
      }
    >
      <Input
        placeholder={agentTopicManagerStrings.searchPlaceholder}
        prefix={<Icon icon={Search} size="small" />}
        size="middle"
        value={search}
        variant="filled"
        onChange={(e) => setSearch(e.target.value)}
      />
    </NavHeader>
  );
});
