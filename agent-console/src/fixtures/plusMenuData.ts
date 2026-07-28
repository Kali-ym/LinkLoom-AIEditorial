import type { Agent } from '../domain/types';
import type { AgentPlusState } from '../domain/types/agentChatConfig';
import {
  createDefaultPlusState,
} from '../domain/defaults/agentPlusState';

export { createDefaultPlusState, DEFAULT_AGENT_CHAT_CONFIG, DEFAULT_MODEL_PARAMS } from '../domain/defaults/agentPlusState';

export function buildPlusStateByAgentId(agents: Agent[]): Record<string, AgentPlusState> {
  const map: Record<string, AgentPlusState> = {};
  for (const agent of agents) {
    map[agent.id] = createDefaultPlusState(
      agent.id === 'code' ? { model: 'claude-sonnet-4', provider: 'anthropic' } : undefined,
    );
  }
  return map;
}
