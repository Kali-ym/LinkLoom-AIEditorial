import { memo, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import type { AgentPlusState } from '../../domain/types';
import type { Agent } from '../../domain/types';
import type { AgentListLayout, AgentRuntimeStatus } from '../../domain/types/agentList';
import {
  isAgentConsoleBootstrapComplete,
  useAgentListStore,
  useAgentStore,
  whenAgentConsoleBootstrapComplete,
} from '../../stores';
import { getAgentConsolePorts, isAgentConsoleApiMode } from './ports';
import { agentConsoleQueryKeys } from './queryKeys';

type AgentListBundle = {
  agents: Agent[];
  layout: AgentListLayout;
  plusStateByAgentId: Record<string, AgentPlusState>;
  runtimeByAgentId: Record<string, AgentRuntimeStatus>;
};

/** api 模式：等 bootstrap 完成后再同步；优先使用 seed 的 query cache，避免双打 /api/agents。 */
export const AgentListQueryHydration = memo(function AgentListQueryHydration() {
  const isApi = isAgentConsoleApiMode();
  const queryClient = useQueryClient();
  const [bootstrapReady, setBootstrapReady] = useState(() =>
    isApi ? isAgentConsoleBootstrapComplete() : true,
  );

  useEffect(() => {
    if (!isApi || bootstrapReady) return;
    let cancelled = false;
    void whenAgentConsoleBootstrapComplete().then(() => {
      if (!cancelled) setBootstrapReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [bootstrapReady, isApi]);

  const { data } = useQuery({
    enabled: isApi && bootstrapReady,
    queryKey: agentConsoleQueryKeys.agentListBundle(),
    queryFn: async (): Promise<AgentListBundle> => {
      const seeded = queryClient.getQueryData<AgentListBundle>(
        agentConsoleQueryKeys.agentListBundle(),
      );
      if (seeded?.agents) {
        return seeded;
      }

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
