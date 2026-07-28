import { memo, useLayoutEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { isAgentConsoleApiMode } from '../../adapters/registry';
import {
  AGENT_CONSOLE_BASE,
  agentConsoleAgentPath,
  agentConsoleTopicPath,
  isAgentChatRoute,
  isAgentSubRoute,
  parseAgentConsolePath,
} from '../../constants/agentConsoleRoutes';
import { startAgentSwitch } from '../../services/agent/switchAgentContext';
import {
  clearPendingUserTopicIfMatched,
  topicRouteSyncState,
} from '../../services/topic/topicRouteSync';
import { isAgentConsoleBootstrapComplete, useAgentStore, useRouteStore, useTopicStore } from '../../stores';

/**
 * URL 路径 ↔ store 双向同步。
 * - `/console/:agentId` — 新话题首页
 * - `/console/:agentId/t/:topicId` — 会话
 * - 子路由（topics/task）仅同步 agent，不写 topic 段
 */
export const AgentConsoleRouteHydration = memo(function AgentConsoleRouteHydration() {
  const { agentId: paramAgentId, topicId: paramTopicId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const parsed = parseAgentConsolePath(location.pathname);

  const activeAgentId = useAgentStore((s) => s.activeAgentId);
  const agents = useAgentStore((s) => s.agents);
  const activeTopicId = useTopicStore((s) => s.activeTopicId);
  const topics = useTopicStore((s) => s.topics);
  const routeView = useRouteStore((s) => s.view);

  const agentIdFromRoute = paramAgentId ?? parsed.agentId;
  const topicIdFromRoute = paramTopicId ?? parsed.topicId;
  const isChatRoute = isAgentChatRoute(location.pathname);
  const isSubRoute = isAgentSubRoute(location.pathname);

  useLayoutEffect(() => {
    if (!agentIdFromRoute) {
      topicRouteSyncState.lastAppliedAgent = null;
      return;
    }
    if (agents.length === 0) return;
    if (isAgentConsoleApiMode() && !isAgentConsoleBootstrapComplete()) return;
    if (!agents.some((agent) => agent.id === agentIdFromRoute)) return;
    if (useAgentStore.getState().activeAgentId === agentIdFromRoute) {
      topicRouteSyncState.lastAppliedAgent = agentIdFromRoute;
      return;
    }
    if (topicRouteSyncState.lastAppliedAgent === agentIdFromRoute) return;

    topicRouteSyncState.lastAppliedAgent = agentIdFromRoute;
    topicRouteSyncState.suppressStoreToUrl = true;
    startAgentSwitch(agentIdFromRoute);
    topicRouteSyncState.suppressStoreToUrl = false;
  }, [agentIdFromRoute, agents]);

  useLayoutEffect(() => {
    if (!isChatRoute || isSubRoute || !agentIdFromRoute) return;

    const urlChanged = topicIdFromRoute !== topicRouteSyncState.lastSeenUrlTopic;
    if (urlChanged) {
      topicRouteSyncState.lastSeenUrlTopic = topicIdFromRoute;
      clearPendingUserTopicIfMatched(topicIdFromRoute);
    }

    if (topics.length === 0 && topicIdFromRoute) return;

    const storeActiveTopicId = useTopicStore.getState().activeTopicId;

    // User clicked a topic: store already updated, URL still on the previous topic — do not revert.
    if (
      topicRouteSyncState.pendingUserTopicId &&
      storeActiveTopicId === topicRouteSyncState.pendingUserTopicId &&
      topicIdFromRoute !== topicRouteSyncState.pendingUserTopicId
    ) {
      return;
    }

    const urlTopicExists =
      Boolean(topicIdFromRoute) && topics.some((topic) => topic.id === topicIdFromRoute);

    if (topicIdFromRoute && urlTopicExists) {
      if (storeActiveTopicId !== topicIdFromRoute) {
        const shouldApplyFromUrl =
          urlChanged || topicRouteSyncState.lastAppliedTopic !== topicIdFromRoute;
        if (shouldApplyFromUrl) {
          topicRouteSyncState.suppressStoreToUrl = true;
          useTopicStore.getState().selectTopic(topicIdFromRoute);
          topicRouteSyncState.lastAppliedTopic = topicIdFromRoute;
          topicRouteSyncState.suppressStoreToUrl = false;
        }
      } else {
        topicRouteSyncState.lastAppliedTopic = topicIdFromRoute;
        useTopicStore.getState().ensureTopicModelLoaded(topicIdFromRoute);
      }
      return;
    }

    if (!topicIdFromRoute && storeActiveTopicId && useRouteStore.getState().view === 'home') {
      topicRouteSyncState.lastAppliedTopic = '';
    }
  }, [agentIdFromRoute, isChatRoute, isSubRoute, topicIdFromRoute, topics]);

  useLayoutEffect(() => {
    if (topicRouteSyncState.suppressStoreToUrl) return;
    if (!activeAgentId || !isChatRoute || isSubRoute) return;

    const activeTopic = topics.find((topic) => topic.id === activeTopicId);
    const showTopicInUrl =
      Boolean(activeTopicId) &&
      activeTopic &&
      activeTopic.status !== 'temp' &&
      routeView !== 'home';

    const targetPath = showTopicInUrl
      ? agentConsoleTopicPath(activeAgentId, activeTopicId)
      : agentConsoleAgentPath(activeAgentId);

    const currentPath = location.pathname.replace(/\/+$/, '') || AGENT_CONSOLE_BASE;
    const normalizedTarget = targetPath.replace(/\/+$/, '');

    if (currentPath === normalizedTarget) {
      topicRouteSyncState.lastAppliedTopic = showTopicInUrl ? activeTopicId : '';
      clearPendingUserTopicIfMatched(showTopicInUrl ? activeTopicId : undefined);
      return;
    }

    if (showTopicInUrl && topicRouteSyncState.lastAppliedTopic === activeTopicId) return;
    if (!showTopicInUrl && topicRouteSyncState.lastAppliedTopic === '') return;

    topicRouteSyncState.lastAppliedTopic = showTopicInUrl ? activeTopicId : '';
    navigate(targetPath, { replace: true });
  }, [
    activeAgentId,
    activeTopicId,
    isChatRoute,
    isSubRoute,
    location.pathname,
    navigate,
    routeView,
    topics,
  ]);

  return null;
});
