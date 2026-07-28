import type { AgentSandboxStatusDto } from '../../domain/types/sandbox';
import { agentConsoleGetJson, agentConsolePostJson } from './http';

export interface ISandboxPort {
  getSandboxStatus(agentId: string): Promise<AgentSandboxStatusDto>;
  startSandbox(agentId: string): Promise<AgentSandboxStatusDto>;
  stopSandbox(agentId: string): Promise<AgentSandboxStatusDto>;
}

export const apiSandboxPort: ISandboxPort = {
  async getSandboxStatus(agentId) {
    return agentConsoleGetJson<AgentSandboxStatusDto>(
      `/api/agents/${encodeURIComponent(agentId)}/sandbox`,
    );
  },

  async startSandbox(agentId) {
    return agentConsolePostJson<AgentSandboxStatusDto>(
      `/api/agents/${encodeURIComponent(agentId)}/sandbox/start`,
      {},
    );
  },

  async stopSandbox(agentId) {
    return agentConsolePostJson<AgentSandboxStatusDto>(
      `/api/agents/${encodeURIComponent(agentId)}/sandbox/stop`,
      {},
    );
  },
};
