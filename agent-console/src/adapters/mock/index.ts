import type { AgentConsolePorts } from '../AgentConsolePorts';
import { mockAgentPort } from './agentPort';
import { mockAgentListPort } from './agentListPort';
import { mockCatalogPort } from './catalogPort';
import { mockChatPort } from './chatPort';
import { mockChatStreamPort } from './chatStreamPort';
import { mockPortalPort } from './portalPort';
import { mockRuntimePort } from './runtimePort';
import { mockSandboxPort } from './sandboxPort';
import { mockSharePort } from './sharePort';
import { mockTaskPort } from './taskPort';
import { mockTopicPort } from './topicPort';
import { mockUploadPort } from './uploadPort';
import { mockWorkspacePort } from './workspacePort';

export const mockPorts: AgentConsolePorts = {
  agent: mockAgentPort,
  agentList: mockAgentListPort,
  topic: mockTopicPort,
  chat: mockChatPort,
  chatStream: mockChatStreamPort,
  workspace: mockWorkspacePort,
  portal: mockPortalPort,
  task: mockTaskPort,
  share: mockSharePort,
  catalog: mockCatalogPort,
  runtime: mockRuntimePort,
  sandbox: mockSandboxPort,
  upload: mockUploadPort,
};
