import type { Agent, AgentConfigPatch, AgentPlusState } from '../../domain/types';

export interface CreateAgentInput {
  name?: string;
  groupId?: string;
  sessionType?: 'group';
}

export interface IAgentPort {
  listAgents(): Promise<Agent[]>;
  getAgent(agentId: string): Promise<Agent | null>;
  getActiveAgentId(): Promise<string>;
  getPlusState(agentId: string): Promise<AgentPlusState>;
  getPlusStateMap(): Promise<Record<string, AgentPlusState>>;
  updateAgentConfig(agentId: string, patch: AgentConfigPatch): Promise<void>;
  renameAgent(agentId: string, name: string): Promise<void>;
  removeAgent(agentId: string): Promise<void>;
  duplicateAgent(agentId: string): Promise<string | null>;
  createAgent(input?: CreateAgentInput): Promise<string | null>;
  installSkill(agentId: string, skillId: string): Promise<void>;
}
