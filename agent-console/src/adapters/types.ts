import type {
  Agent,
  AgentPlusState,
  AuthorInfo,
  ConsoleConfig,
  DocumentNode,
  FileTreeNode,
  InputMenuData,
  Message,
  PortalContentData,
  ReviewFile,
  ShowcaseData,
  SkillCatalog,
  StaticConversation,
  TodoItem,
  Topic,
  TopicShareInfo,
  TopicThread,
  WebPage,
} from '../domain/types';
import type { TaskGroup } from '../domain/types/task';
import type { PendingAuthTool } from '../domain/types/toolAuth';
import type { AgentListLayout, AgentRuntimeStatus } from '../domain/types/agentList';

export interface AgentConsoleSnapshot {
  agents: Agent[];
  plusStateByAgentId: Record<string, AgentPlusState>;
  activeAgentId: string;
  topics: Topic[];
  activeTopicId: string;
  threadsByTopicId: Record<string, TopicThread[]>;
  elapsedByTopicId: Record<string, string>;
  messagesByTopicId: Record<string, Message[]>;
  staticConversation: StaticConversation;
  skillCatalog: SkillCatalog;
  todos: TodoItem[];
  documents: DocumentNode[];
  webPages: WebPage[];
  fileTree: FileTreeNode[];
  reviewFiles: ReviewFile[];
  workingDir: string;
  portalContent: PortalContentData;
  inputMenu: InputMenuData;
  showcase: ShowcaseData;
  taskGroups: TaskGroup[];
  config: ConsoleConfig;
  authorsByUserId: Record<string, AuthorInfo>;
  shareByTopicId: Record<string, TopicShareInfo>;
  agentListLayout: AgentListLayout;
  agentRuntimeById: Record<string, AgentRuntimeStatus>;
  pendingAuthTools: PendingAuthTool[];
}

export type AgentConsoleHydratePayload = AgentConsoleSnapshot;

export type { FetchAgentTopicsViewParams, FetchAgentTopicsViewResult } from './topicsViewApiAdapter';
export type { TopicImportPayload } from './topicImportAdapter';
export type { TaskDetailPatch } from './taskDetailApiAdapter';
