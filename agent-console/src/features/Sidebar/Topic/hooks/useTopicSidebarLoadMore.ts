import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { agentConsoleTopicsPath } from '../../../../constants/agentConsoleRoutes';
import { useRouteAgentId } from '../../../../hooks/useRouteAgentId';
import { useIsGroupSession } from '../../../../hooks/useSession';
import { useTopicStore } from '../../../../stores';

/** §C.50 / §C.53 — Group「更多」开 Drawer；Agent navigate topics 页 */
export function useTopicSidebarLoadMore() {
  const navigate = useNavigate();
  const agentId = useRouteAgentId();
  const isGroupSession = useIsGroupSession();
  const openAllTopicsDrawer = useTopicStore((s) => s.openAllTopicsDrawer);

  return useCallback(() => {
    if (isGroupSession) {
      openAllTopicsDrawer();
      return;
    }
    if (!agentId) return;
    navigate(agentConsoleTopicsPath(agentId));
  }, [agentId, isGroupSession, navigate, openAllTopicsDrawer]);
}
