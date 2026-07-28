import { Flexbox } from '@lobehub/ui';
import { memo, useMemo } from 'react';

import { useFetchAgentList } from '../../../hooks/data/useFetchAgentList';
import { useAgentListStore } from '../../../stores/agentListStore';
import { useAgentStore } from '../../../stores';
import { SkeletonList } from '../../NavPanel/SkeletonList';
import { AgentGroupListItem } from './AgentGroupListItem';
import { AgentItem } from './AgentItem';
import { buildAgentSwitchList } from './useAgentList';

interface AgentListContentProps {
  onNavigate?: () => void;
}

/** §C.19 — built-in agent switcher only (no create / groups / inbox duplicate). */
export const AgentListContent = memo(function AgentListContent({ onNavigate }: AgentListContentProps) {
  const { isLoading: isAgentListLoading } = useFetchAgentList();
  const agents = useAgentStore((s) => s.agents);
  const isInit = useAgentListStore((s) => s.isAgentListInit);

  const switchList = useMemo(() => buildAgentSwitchList(agents), [agents]);
  const listReady = isInit || agents.length > 0;

  if (isAgentListLoading && !listReady) {
    return (
      <Flexbox padding={8}>
        <SkeletonList rows={4} />
      </Flexbox>
    );
  }

  return (
    <Flexbox gap={1} padding={8} style={{ maxHeight: '50vh', overflowY: 'auto' }}>
      {switchList.map((item) =>
        item.type === 'group' ? (
          <AgentGroupListItem key={item.id} item={item} onNavigate={onNavigate} />
        ) : (
          <AgentItem key={item.id} item={item} onNavigate={onNavigate} />
        ),
      )}
    </Flexbox>
  );
});
