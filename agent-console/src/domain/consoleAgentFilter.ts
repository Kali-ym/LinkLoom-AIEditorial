import type { Agent } from './types';
import { isApplicationConsoleAgent } from './applicationConsoleAgents';

/** Console 侧栏仅展示应用智能体；基础/演示智能体不进入切换列表。 */
export function filterAgentsForConsole(agents: Agent[]): Agent[] {
  return agents.filter(
    (agent) => isApplicationConsoleAgent(agent.id) && agent.consoleVisible !== false,
  );
}
