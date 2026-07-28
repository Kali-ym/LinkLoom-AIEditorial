import type {
  IAgentPort,
  IAgentListPort,
  ICatalogPort,
  IChatPort,
  IChatStreamPort,
  IPortalPort,
  IRuntimePort,
  ISandboxPort,
  ISharePort,
  ITaskPort,
  ITopicPort,
  IUploadPort,
  IWorkspacePort,
} from './ports';

export interface AgentConsolePorts {
  agent: IAgentPort;
  agentList: IAgentListPort;
  topic: ITopicPort;
  chat: IChatPort;
  chatStream: IChatStreamPort;
  workspace: IWorkspacePort;
  portal: IPortalPort;
  task: ITaskPort;
  share: ISharePort;
  catalog: ICatalogPort;
  runtime: IRuntimePort;
  sandbox: ISandboxPort;
  upload: IUploadPort;
}
