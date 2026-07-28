import { useParams } from 'react-router-dom';

import { useAgentStore } from '../stores';

/** Agent id from URL (`:agentId`) with store fallback. */
export function useRouteAgentId(): string {
  const { agentId: paramAgentId } = useParams();
  const activeAgentId = useAgentStore((s) => s.activeAgentId);
  return paramAgentId ?? activeAgentId;
}
