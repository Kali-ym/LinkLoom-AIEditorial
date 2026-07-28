import type { Agent } from './types';
import { filterAgentsForConsole } from './consoleAgentFilter';

/** 主智能体 id — 来自 agent.isPrimary，否则取第一个 Console 可见智能体。 */
export function resolvePrimaryAgentId(agents: Agent[]): string {
  const visible = filterAgentsForConsole(agents);
  return visible.find((agent) => agent.isPrimary)?.id ?? visible[0]?.id ?? '';
}
