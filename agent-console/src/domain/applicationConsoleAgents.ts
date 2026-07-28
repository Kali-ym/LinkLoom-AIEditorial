/** Agent Console 侧栏应用智能体 — 与 backend `applicationConsoleAgents` 对齐。 */
export const APPLICATION_CONSOLE_AGENT_IDS = ['topic_copilot', 'super_admin'] as const;

export type ApplicationConsoleAgentId = (typeof APPLICATION_CONSOLE_AGENT_IDS)[number];

export function isApplicationConsoleAgent(agentId: string): boolean {
  return (APPLICATION_CONSOLE_AGENT_IDS as readonly string[]).includes(agentId);
}
