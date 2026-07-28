import type { AgentListLayout, AgentRuntimeStatus } from '../../domain/types';

export interface IAgentListPort {
  getLayout(): Promise<AgentListLayout>;
  getRuntimeByAgentId(): Promise<Record<string, AgentRuntimeStatus>>;
  finishAgentListInit(): Promise<void>;
}
