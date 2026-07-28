import { Navigate, useParams, useSearchParams } from 'react-router-dom';

import {
  agentConsoleAgentPath,
  agentConsolePopupPath,
  agentConsoleTaskPath,
  agentConsoleTopicPath,
  agentConsoleTopicsPath,
  AGENT_CONSOLE_BASE,
} from '../constants/agentConsoleRoutes';
import { usePrimaryAgentId } from '../hooks/usePrimaryAgentId';
import { useAgentStore } from '../stores';

/** `/console` → 当前/主智能体会话页 */
export function AgentConsoleIndexRedirect() {
  const [searchParams] = useSearchParams();
  const storeAgentId = useAgentStore((s) => s.activeAgentId);
  const primaryAgentId = usePrimaryAgentId();
  const legacyAgent = searchParams.get('agent');
  const legacyTopic = searchParams.get('topic');
  const agentId = legacyAgent || storeAgentId || primaryAgentId;

  if (!agentId) {
    return <Navigate replace to={AGENT_CONSOLE_BASE} />;
  }

  const target = legacyTopic
    ? agentConsoleTopicPath(agentId, legacyTopic)
    : agentConsoleAgentPath(agentId);

  return <Navigate replace to={target} />;
}

type LegacySection = 'topics';

/** 旧版扁平子路由 `/console/topics` */
export function AgentConsoleLegacySubRouteRedirect({ section }: { section: LegacySection }) {
  const [searchParams] = useSearchParams();
  const storeAgentId = useAgentStore((s) => s.activeAgentId);
  const primaryAgentId = usePrimaryAgentId();
  const agentId = searchParams.get('agent') || storeAgentId || primaryAgentId;

  if (!agentId) {
    return <Navigate replace to={AGENT_CONSOLE_BASE} />;
  }

  const legacyTopic = searchParams.get('topic');
  if (legacyTopic && section === 'topics') {
    return <Navigate replace to={agentConsoleTopicPath(agentId, legacyTopic)} />;
  }

  return <Navigate replace to={agentConsoleTopicsPath(agentId)} />;
}

/** 已移除的 profile/channel 子路由 → 回退到智能体会话页 */
export function AgentConsoleObsoleteSubRouteRedirect() {
  const { agentId: routeAgentId } = useParams();
  const storeAgentId = useAgentStore((s) => s.activeAgentId);
  const primaryAgentId = usePrimaryAgentId();
  const agentId = routeAgentId || storeAgentId || primaryAgentId;

  if (!agentId) {
    return <Navigate replace to={AGENT_CONSOLE_BASE} />;
  }

  return <Navigate replace to={agentConsoleAgentPath(agentId)} />;
}

/** 旧版 `/console/popup?agent=` */
export function AgentConsoleLegacyPopupRedirect() {
  const [searchParams] = useSearchParams();
  const storeAgentId = useAgentStore((s) => s.activeAgentId);
  const primaryAgentId = usePrimaryAgentId();
  const agentId = searchParams.get('agent') || storeAgentId || primaryAgentId;
  const topicId = searchParams.get('topic') ?? undefined;

  if (!agentId) {
    return <Navigate replace to={AGENT_CONSOLE_BASE} />;
  }

  return <Navigate replace to={agentConsolePopupPath(agentId, topicId)} />;
}

/** 旧版 `/console/task/:taskId` */
export function AgentConsoleLegacyTaskRedirect() {
  const { taskId } = useParams();
  const storeAgentId = useAgentStore((s) => s.activeAgentId);
  const primaryAgentId = usePrimaryAgentId();
  const agentId = storeAgentId || primaryAgentId;

  if (!agentId || !taskId) {
    return <Navigate replace to={AGENT_CONSOLE_BASE} />;
  }

  return <Navigate replace to={agentConsoleTaskPath(agentId, taskId)} />;
}
