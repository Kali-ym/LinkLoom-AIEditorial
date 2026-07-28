import { AGENT_CONSOLE_BASE } from '../../constants/agentConsoleRoutes';

/** §C.55 — admin path equivalents of `globalScope` route helpers */
export function isTaskPanelRoute(pathname: string): boolean {
  return pathname.includes(`${AGENT_CONSOLE_BASE}/task/`);
}
