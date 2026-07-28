import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { agentConsoleChatPath } from '../../../../constants/agentConsoleRoutes';
import { useRouteAgentId } from '../../../../hooks/useRouteAgentId';
import { useTopicStore } from '../../../../stores';

let pendingSingleClickTimer: ReturnType<typeof setTimeout> | null = null;

const cancelPendingSingleClick = () => {
  if (pendingSingleClickTimer) {
    clearTimeout(pendingSingleClickTimer);
    pendingSingleClickTimer = null;
  }
};

/** §C.8 / §C.54 — 250ms debounce；sub-route 时先回 chat URL */
export function useTopicNavigation() {
  const navigate = useNavigate();
  const agentId = useRouteAgentId();
  const selectTopic = useTopicStore((s) => s.selectTopic);
  const activeTopicId = useTopicStore((s) => s.activeTopicId);

  const navigateToTopic = useCallback(
    (id?: string) => {
      if (!id || !agentId) return;
      const topic = useTopicStore.getState().topics.find((t) => t.id === id);
      if (topic && topic.status !== 'temp') {
        navigate(agentConsoleChatPath(agentId, id), { replace: true });
      }
      selectTopic(id);
    },
    [agentId, navigate, selectTopic],
  );

  const handleTopicClick = useCallback(
    (id: string | undefined, editing: boolean) => {
      if (editing || !id) return;
      cancelPendingSingleClick();
      pendingSingleClickTimer = setTimeout(() => {
        pendingSingleClickTimer = null;
        navigateToTopic(id);
      }, 250);
    },
    [navigateToTopic],
  );

  const handleTopicDoubleClick = useCallback(
    (id: string | undefined) => {
      if (!id) return;
      cancelPendingSingleClick();
      navigateToTopic(id);
    },
    [navigateToTopic],
  );

  return {
    activeTopicId,
    urlTopicId: activeTopicId,
    handleTopicClick,
    handleTopicDoubleClick,
    navigateToTopic,
  };
}
