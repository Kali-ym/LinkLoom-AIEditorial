import { useMemo } from 'react';

import { useAgentStore } from '../stores/agentStore';

/** Whether the active agent is a group collaboration session. */
export function useIsGroupSession(): boolean {
  const activeAgentId = useAgentStore((s) => s.activeAgentId);
  const agents = useAgentStore((s) => s.agents);

  return useMemo(
    () => agents.find((a) => a.id === activeAgentId)?.sessionType === 'group',
    [activeAgentId, agents],
  );
}

export function useGroupMemberCount(): number {
  const activeAgentId = useAgentStore((s) => s.activeAgentId);
  const agents = useAgentStore((s) => s.agents);

  return useMemo(() => {
    const agent = agents.find((a) => a.id === activeAgentId);
    if (agent?.sessionType !== 'group') return 0;
    const members = agent.groupMembers?.length ?? 0;
    return members > 0 ? members : 1;
  }, [activeAgentId, agents]);
}
