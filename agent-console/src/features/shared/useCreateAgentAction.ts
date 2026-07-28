import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import type { CreateAgentInput } from '../../adapters/ports/IAgentPort';
import { agentConsoleChatPath } from '../../constants/agentConsoleRoutes';
import { usePermission } from '../../hooks/usePermission';
import { useAgentListStore } from '../../stores/agentListStore';

interface CreateAgentAndNavigateOptions {
  onClose?: () => void;
}

/** §C.41 — shared create agent flow for CreateAgentButton + CommandMenu. */
export function useCreateAgentAction() {
  const navigate = useNavigate();
  const { allowed: canCreate } = usePermission('create_content');
  const createAgent = useAgentListStore((s) => s.createAgent);

  const createAgentAndNavigate = useCallback(
    async (input?: CreateAgentInput, options?: CreateAgentAndNavigateOptions) => {
      if (!canCreate) return;
      const newId = await createAgent(input);
      if (!newId) return;
      navigate(agentConsoleChatPath(newId));
      options?.onClose?.();
    },
    [canCreate, createAgent, navigate],
  );

  return { canCreate, createAgentAndNavigate };
}
