import { Navigate } from 'react-router-dom';

import { agentConsoleChatPath } from '../../constants/agentConsoleRoutes';
import { useRouteAgentId } from '../../hooks/useRouteAgentId';
import { useLayoutStore } from '../../stores';
import { AgentTopicManager } from './index';

/** §C.53*/
export function AgentTopicsRoute() {
  const isMobileViewport = useLayoutStore((s) => s.isMobileViewport);
  const agentId = useRouteAgentId();
  if (isMobileViewport && agentId) {
    return <Navigate replace to={agentConsoleChatPath(agentId)} />;
  }
  return <AgentTopicManager />;
}
