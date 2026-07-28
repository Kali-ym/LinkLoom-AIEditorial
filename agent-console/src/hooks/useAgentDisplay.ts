import { useMemo } from 'react';

import { useAgentStore } from '../stores/agentStore';

export function useAgentDisplay(agentId?: string): { id: string; name: string; gradient: string } {
  const agents = useAgentStore((s) => s.agents);
  const activeAgentId = useAgentStore((s) => s.activeAgentId);
  const getActiveAgent = useAgentStore((s) => s.getActiveAgent);

  return useMemo(() => {
    const resolved =
      (agentId ? agents.find((agent) => agent.id === agentId) : undefined) ??
      agents.find((agent) => agent.id === activeAgentId) ??
      getActiveAgent();
    return { id: resolved.id, name: resolved.name, gradient: resolved.gradient };
  }, [activeAgentId, agentId, agents, getActiveAgent]);
}
