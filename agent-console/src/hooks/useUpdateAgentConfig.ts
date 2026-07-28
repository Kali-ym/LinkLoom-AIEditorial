import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import type { AgentConfigPatch } from '../domain/types';
import { agentConsoleQueryKeys } from './data/queryKeys';
import { useAgentStore } from '../stores';

/** Upstream `useUpdateAgentConfig` — writes active agent config via store + port. */
export function useUpdateAgentConfig() {
  const queryClient = useQueryClient();
  const activeAgentId = useAgentStore((s) => s.activeAgentId);
  const updateAgentConfig = useAgentStore((s) => s.updateAgentConfig);

  const mutation = useMutation({
    mutationFn: (patch: AgentConfigPatch) => updateAgentConfig(patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: agentConsoleQueryKeys.agent(activeAgentId),
      });
      void queryClient.invalidateQueries({
        queryKey: ['agent', activeAgentId, 'plusState'],
      });
      void queryClient.invalidateQueries({ queryKey: ['agent', 'plusState'] });
      void queryClient.invalidateQueries({
        queryKey: agentConsoleQueryKeys.catalogModels(),
      });
    },
  });

  const update = useCallback(
    (patch: AgentConfigPatch) => mutation.mutate(patch),
    [mutation],
  );

  const updateAgentChatConfig = useCallback(
    (patch: AgentConfigPatch['chatConfig']) => update({ chatConfig: patch }),
    [update],
  );

  return {
    activeAgentId,
    updateAgentChatConfig,
    updateAgentConfig: update,
    isUpdating: mutation.isPending,
  };
}
