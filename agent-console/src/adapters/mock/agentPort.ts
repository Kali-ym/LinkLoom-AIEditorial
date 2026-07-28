import type { IAgentPort } from '../ports/IAgentPort';
import { applyAdminExclusiveBindings } from '../../domain/utils/adminExclusiveBindings';
import {
  getMockActiveAgentId,
  getMockAgents,
  getMockPlusStateByAgentId,
} from './seeds/agentSeed';

export const mockAgentPort: IAgentPort = {
  async listAgents() {
    return getMockAgents();
  },

  async getAgent(agentId) {
    return getMockAgents().find((a) => a.id === agentId) ?? null;
  },

  async getActiveAgentId() {
    return getMockActiveAgentId();
  },

  async getPlusState(agentId) {
    const state = getMockPlusStateByAgentId()[agentId];
    if (!state) {
      throw new Error(`Plus state not found for agent: ${agentId}`);
    }
    return applyAdminExclusiveBindings(agentId, state);
  },

  async getPlusStateMap() {
    const map = getMockPlusStateByAgentId();
    return Object.fromEntries(
      Object.entries(map).map(([agentId, state]) => [
        agentId,
        applyAdminExclusiveBindings(agentId, state),
      ]),
    );
  },

  async updateAgentConfig(agentId, patch) {
    await new Promise((r) => window.setTimeout(r, 120));
    void agentId;
    void patch;
  },

  async renameAgent(agentId, name) {
    await new Promise((r) => window.setTimeout(r, 80));
    void agentId;
    void name;
  },

  async removeAgent(agentId) {
    await new Promise((r) => window.setTimeout(r, 80));
    void agentId;
  },

  async duplicateAgent(agentId) {
    await new Promise((r) => window.setTimeout(r, 120));
    void agentId;
    return `copy-${agentId}`;
  },

  async createAgent(input) {
    await new Promise((r) => window.setTimeout(r, 120));
    void input;
    return `agent_${Date.now()}`;
  },

  async installSkill(agentId, skillId) {
    await new Promise((r) => window.setTimeout(r, 80));
    void agentId;
    void skillId;
  },
};
