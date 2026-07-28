import type { AgentSandboxStatusDto } from '../../domain/types/sandbox';

export interface ISandboxPort {
  getSandboxStatus(agentId: string): Promise<AgentSandboxStatusDto>;
  startSandbox(agentId: string): Promise<AgentSandboxStatusDto>;
  stopSandbox(agentId: string): Promise<AgentSandboxStatusDto>;
}
