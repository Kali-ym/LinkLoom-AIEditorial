import type { LocalStore } from '../../LocalStore.js';
import { AgentSandboxInstanceRepository } from '../../repositories/AgentSandboxInstanceRepository.js';
import { AgentSandboxPool } from '../engine/AgentSandboxPool.js';
import type { AgentSandboxInstanceStore } from '../engine/AgentSandboxTypes.js';
import { WorkspaceManager } from '../engine/WorkspaceManager.js';

export interface AgentSandboxRuntime {
  pool: AgentSandboxPool;
  store: AgentSandboxInstanceStore;
  workspaceManager: WorkspaceManager;
}

export function createAgentSandboxRuntime(store: LocalStore): AgentSandboxRuntime | null {
  const repo = (store as { repositories?: { agentSandboxInstances?: AgentSandboxInstanceRepository } })
    .repositories?.agentSandboxInstances;
  if (!repo) return null;
  const pool = new AgentSandboxPool({ store: repo });
  return {
    pool,
    store: repo,
    workspaceManager: new WorkspaceManager({ sandboxPool: pool })
  };
}

export function createWorkspaceManagerForStore(store: LocalStore): WorkspaceManager {
  return createAgentSandboxRuntime(store)?.workspaceManager ?? new WorkspaceManager();
}
