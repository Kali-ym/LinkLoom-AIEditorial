import { memo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

import { isAgentConsoleApiMode } from './ports';
import { getAgentConsolePorts } from './ports';
import { agentConsoleQueryKeys } from './queryKeys';
import { useAgentListStore, useAgentStore } from '../../stores';

/** api 模式：拉取 agent 列表 bundle 并同步 zustand（mock 由 bootstrap seed）。 */
export const AgentListQueryHydration = memo(function AgentListQueryHydration() {
  const isApi = isAgentConsoleApiMode();

  const { data } = useQuery({
    enabled: isApi,
    queryKey: agentConsoleQueryKeys.agentListBundle(),
    queryFn: async () => {
      const ports = getAgentConsolePorts();
      const [agents, layout, runtimeByAgentId, plusStateByAgentId] = await Promise.all([
        ports.agent.listAgents(),
        ports.agentList.getLayout(),
        ports.agentList.getRuntimeByAgentId(),
        ports.agent.getPlusStateMap(),
      ]);
      return { agents, layout, plusStateByAgentId, runtimeByAgentId };
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!isApi || !data?.plusStateByAgentId) return;
    const activeAgentId = useAgentStore.getState().activeAgentId;
    useAgentStore.getState().hydrate({
      activeAgentId,
      agents: data.agents,
      plusStateByAgentId: data.plusStateByAgentId,
    });
    useAgentStore.getState().finishConfigLoad();
    useAgentListStore.getState().hydrate({
      agents: data.agents,
      agentListLayout: data.layout,
      agentRuntimeById: data.runtimeByAgentId,
    });
  }, [data, isApi]);

  return null;
});
