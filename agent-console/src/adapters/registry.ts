import { mockPorts } from './mock';
import {
  apiAgentPort,
  apiAgentListPort,
  apiCatalogPort,
  apiChatPort,
  apiChatStreamPort,
  apiPortalPort,
  apiRuntimePort,
  apiSharePort,
  apiTaskPort,
  apiTopicPort,
  apiUploadPort,
  apiWorkspacePort,
  apiSandboxPort,
} from './api/ports';
import type { AgentConsolePorts } from './AgentConsolePorts';

export type { AgentConsolePorts } from './AgentConsolePorts';

export const apiPorts: AgentConsolePorts = {
  agent: apiAgentPort,
  agentList: apiAgentListPort,
  topic: apiTopicPort,
  chat: apiChatPort,
  chatStream: apiChatStreamPort,
  workspace: apiWorkspacePort,
  portal: apiPortalPort,
  task: apiTaskPort,
  share: apiSharePort,
  catalog: apiCatalogPort,
  runtime: apiRuntimePort,
  sandbox: apiSandboxPort,
  upload: apiUploadPort,
};

export { mockPorts };

export function getAgentConsolePorts(): AgentConsolePorts {
  return isAgentConsoleApiMode() ? apiPorts : mockPorts;
}

/** 默认 api；仅显式设为 mock 时走 mock 端口 */
export function isAgentConsoleApiMode(): boolean {
  return import.meta.env.VITE_AGENT_CONSOLE_DATA !== 'mock';
}
