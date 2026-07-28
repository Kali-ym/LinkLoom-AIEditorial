import { memo } from 'react';
import { Route, Routes } from 'react-router-dom';

import { AgentTopicsRoute } from '../features/AgentTopicManager/AgentTopicsRoute';
import { ChatWorkspace } from '../features/Conversation';
import { TaskDetailPage } from '../features/TaskDetailPage';
import {
  AgentConsoleIndexRedirect,
  AgentConsoleLegacyPopupRedirect,
  AgentConsoleLegacySubRouteRedirect,
  AgentConsoleObsoleteSubRouteRedirect,
  AgentConsoleLegacyTaskRedirect,
} from './AgentConsoleLegacyRedirects';

/** Agent Console 嵌套路由 — 智能体在路径中，话题在 `/t/:topicId` */
export const AgentConsoleRoutes = memo(function AgentConsoleRoutes() {
  return (
    <Routes>
      <Route index element={<AgentConsoleIndexRedirect />} />

      <Route path="popup" element={<AgentConsoleLegacyPopupRedirect />} />
      <Route path="popup/:agentId" element={<ChatWorkspace />} />
      <Route path="popup/:agentId/t/:topicId" element={<ChatWorkspace />} />

      <Route path="topics" element={<AgentConsoleLegacySubRouteRedirect section="topics" />} />
      <Route path="profile" element={<AgentConsoleObsoleteSubRouteRedirect />} />
      <Route path="channel" element={<AgentConsoleObsoleteSubRouteRedirect />} />
      <Route path="task/:taskId" element={<AgentConsoleLegacyTaskRedirect />} />

      <Route path=":agentId" element={<ChatWorkspace />} />
      <Route path=":agentId/t/:topicId" element={<ChatWorkspace />} />
      <Route path=":agentId/topics" element={<AgentTopicsRoute />} />
      <Route path=":agentId/profile" element={<AgentConsoleObsoleteSubRouteRedirect />} />
      <Route path=":agentId/channel" element={<AgentConsoleObsoleteSubRouteRedirect />} />
      <Route path=":agentId/task/:taskId" element={<TaskDetailPage />} />
    </Routes>
  );
});
