import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { agentConsoleChatPath } from '../../../constants/agentConsoleRoutes';
import { useRouteAgentId } from '../../../hooks/useRouteAgentId';
import { useTopicStore } from '../../../stores';

/** §C.53 — navigate from topics page back to chat with topic selected */
export function useAgentTopicManagerNavigation() {
  const navigate = useNavigate();
  const agentId = useRouteAgentId();
  const selectTopic = useTopicStore((s) => s.selectTopic);

  return useCallback(
    (topicId: string) => {
      if (!agentId) return;
      selectTopic(topicId);
      navigate(agentConsoleChatPath(agentId, topicId));
    },
    [agentId, navigate, selectTopic],
  );
}

export function useAgentTopicManagerChatHome() {
  const navigate = useNavigate();
  const agentId = useRouteAgentId();
  return useCallback(() => {
    if (!agentId) return;
    navigate(agentConsoleChatPath(agentId));
  }, [agentId, navigate]);
}
