import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  agentConsoleChatPath,
  agentConsoleTopicsPath,
} from '../../../constants/agentConsoleRoutes';
import { useRouteAgentId } from '../../../hooks/useRouteAgentId';
import { useTopicStore } from '../../../stores';

/** §C.54*/
export function useAgentSubRouteNavigation() {
  const navigate = useNavigate();
  const agentId = useRouteAgentId();

  const goToChatHome = useCallback(() => {
    if (!agentId) return;
    navigate(agentConsoleChatPath(agentId));
  }, [agentId, navigate]);

  const goToSubRoute = useCallback((path: string) => {
    useTopicStore.getState().suspendTopicSelection();
    navigate(path);
  }, [navigate]);

  const goToTopics = useCallback(() => {
    if (!agentId) return;
    goToSubRoute(agentConsoleTopicsPath(agentId));
  }, [agentId, goToSubRoute]);

  return { goToChatHome, goToTopics, goToSubRoute };
}
