import type { IAgentListPort } from '../ports/IAgentListPort';
import { getMockAgentListLayout, getMockAgentRuntimeById } from './seeds/agentListSeed';

export const mockAgentListPort: IAgentListPort = {
  async getLayout() {
    return getMockAgentListLayout();
  },

  async getRuntimeByAgentId() {
    return getMockAgentRuntimeById();
  },

  async finishAgentListInit() {
    await new Promise((r) => window.setTimeout(r, 0));
  },
};
