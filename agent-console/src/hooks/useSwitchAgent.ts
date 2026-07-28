import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import {
  agentConsoleAgentPath,
  agentConsoleTaskPath,
  agentConsoleTopicsPath,
  parseAgentConsolePath,
} from '../constants/agentConsoleRoutes';
import { startAgentSwitch } from '../services/agent/switchAgentContext';

/** 切换智能体：先乐观更新 store，再导航（避免等 useEffect + 网络才刷新 UI）。 */
export function useSwitchAgent() {
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(
    (agentId: string) => {
      if (!agentId) return;

      startAgentSwitch(agentId);

      const parsed = parseAgentConsolePath(location.pathname);
      let target = agentConsoleAgentPath(agentId);

      if (parsed.section === 'topics') {
        target = agentConsoleTopicsPath(agentId);
      } else if (parsed.section === 'task' && parsed.taskId) {
        target = agentConsoleTaskPath(agentId, parsed.taskId);
      }

      const normalizedCurrent = location.pathname.replace(/\/+$/, '');
      const normalizedTarget = target.replace(/\/+$/, '');

      if (normalizedCurrent !== normalizedTarget) {
        navigate(target);
      }
    },
    [location.pathname, navigate],
  );
}
