import type { AgentSandboxStatusDto } from '../../domain/types/sandbox';
import type { ISandboxPort } from '../ports/ISandboxPort';

const mockStatusByAgentId = new Map<string, AgentSandboxStatusDto>();

export const mockSandboxPort: ISandboxPort = {
  async getSandboxStatus(agentId) {
    return (
      mockStatusByAgentId.get(agentId) ?? {
        agentId,
        status: 'not_provisioned',
      }
    );
  },

  async startSandbox(agentId) {
    const next: AgentSandboxStatusDto = {
      agentId,
      status: 'running',
      containerId: `mock_${agentId}`,
      workspaceId: `agent_sandbox_${agentId}`,
    };
    mockStatusByAgentId.set(agentId, next);
    return next;
  },

  async stopSandbox(agentId) {
    const next: AgentSandboxStatusDto = {
      agentId,
      status: 'stopped',
      containerId: mockStatusByAgentId.get(agentId)?.containerId,
      workspaceId: mockStatusByAgentId.get(agentId)?.workspaceId,
    };
    mockStatusByAgentId.set(agentId, next);
    return next;
  },
};
