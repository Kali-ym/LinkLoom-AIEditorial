import { ActionIcon, Block, Text } from '@lobehub/ui';
import { ChevronsUpDown } from 'lucide-react';
import { memo, useState } from 'react';

import { DESKTOP_HEADER_ICON_SMALL_SIZE } from '../../constants/layoutTokens';
import { useFetchAgentList } from '../../hooks/data/useFetchAgentList';
import { useAgentStore } from '../../stores';
import { AgentAvatar } from '../../utils/agentAvatar';
import { SkeletonItem } from '../NavPanel/SkeletonList';
import { sidebarShellStyles } from './sidebarShellStyles';
import { AgentListContent } from './AgentList/AgentListContent';
import { AgentRenameModal } from './AgentList/AgentRenameModal';
import { CreateGroupModal } from './AgentList/CreateGroupModal';
import { GroupRenameModal } from './AgentList/GroupRenameModal';
import { SwitchPanel } from './SwitchPanel';

/** §C.1 / §C.19 Agent 切换器 */
export const AgentSwitcher = memo(function AgentSwitcher() {
  const { isLoading: isAgentListLoading } = useFetchAgentList();
  const agents = useAgentStore((s) => s.agents);
  const getActiveAgent = useAgentStore((s) => s.getActiveAgent);
  const [open, setOpen] = useState(false);

  const active = getActiveAgent();

  const handleNavigate = () => {
    setOpen(false);
  };

  const panelContent = <AgentListContent onNavigate={handleNavigate} />;

  if (isAgentListLoading && agents.length === 0) {
    return (
      <div className={sidebarShellStyles.agentHeader}>
        <SkeletonItem height={32} padding={2} />
      </div>
    );
  }

  return (
    <div className={sidebarShellStyles.agentHeader}>
      <AgentRenameModal />
      <CreateGroupModal />
      <GroupRenameModal />
      <SwitchPanel content={panelContent} open={open} onOpenChange={setOpen}>
        <Block
          clickable
          horizontal
          align="center"
          gap={8}
          padding={2}
          variant="borderless"
          id="agentSwitch"
          style={{ minWidth: 32, overflow: 'hidden', width: '100%' }}
        >
          <AgentAvatar agent={active} background={active.gradient} size={28} />
          <Text ellipsis weight={500} style={{ flex: 1 }}>
            {active.name}
          </Text>
          <ActionIcon
            icon={ChevronsUpDown}
            size={DESKTOP_HEADER_ICON_SMALL_SIZE}
            style={{ width: 24, flexShrink: 0 }}
          />
        </Block>
      </SwitchPanel>
    </div>
  );
});
