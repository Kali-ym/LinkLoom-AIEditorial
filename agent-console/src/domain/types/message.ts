import type { UserLinkCard, UserLinkLine } from './conversation';
import type { GroundingData } from './grounding';
import type { AssistantContentBlock } from './messageBlocks';
import type { ToolPayload } from './tool';
import type { AssistantTurnSegment } from './assistantTurnSegment';
import type { StaticReasoningBlock } from './conversation';
import type {
  MessageFileItem,
  MessageImageItem,
  MessageVideoItem,
  PageSelection,
} from './userMessage';

export type {
  MessageFileItem,
  MessageImageItem,
  MessageVideoItem,
  PageSelection,
} from './userMessage';

export interface StreamImage {
  src: string;
  alt?: string;
}

/** Upstream `UIChatMessage.role` subset — §C.17 */
export type MessageRole =
  | 'user'
  | 'assistant'
  | 'supervisor'
  | 'task'
  | 'tasks'
  | 'groupTasks'
  | 'agentCouncil'
  | 'compressedGroup'
  | 'tool'
  | 'verify';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  text?: string;
  linkLine?: UserLinkLine;
  linkCard?: UserLinkCard;
  grounding?: GroundingData;
  tool?: ToolPayload;
  tools?: ToolPayload[];
  reasoningBeforeTool?: StaticReasoningBlock;
  reasoningAfterTool?: StaticReasoningBlock;
  /** Linear reasoning/tool steps in conversation order */
  turnSegments?: AssistantTurnSegment[];
  images?: StreamImage[];
  stopped?: boolean;
  /** Group DM — assistant 回复的 agent id */
  agentId?: string;
  /** Group DM target agent/user id — renders visibleTo Tag */
  targetId?: string;
  /** Thread 分支 id；null/undefined = 主会话 */
  threadId?: string | null;
  /** Optimistic send placeholder */
  isCreating?: boolean;
  pageSelections?: PageSelection[];
  imageList?: MessageImageItem[];
  videoList?: MessageVideoItem[];
  fileList?: MessageFileItem[];
  editorData?: unknown;
  /** §C.17 task message */
  taskStatus?: string;
  taskTitle?: string;
  taskDescription?: string;
  /** §C.17 verify */
  verifyOperationId?: string;
  verifyTitle?: string;
  verifyAssertion?: string;
  /** §C.17 compressed group */
  compressedSummary?: string;
  compressedMessages?: Message[];
  compressedExpanded?: boolean;
  isGeneratingSummary?: boolean;
  /** §C.37 supervisor / assistantGroup children */
  children?: AssistantContentBlock[];
  metadata?: {
    isSupervisor?: boolean;
    collapsed?: boolean;
    taskTitle?: string;
    instruction?: string;
  };
  /** §C.47 task detail */
  taskDetail?: import('./taskMessage').TaskDetail;
  /** §C.47 batch / group parallel subtasks */
  tasks?: Message[];
  /** §C.47 thread execution messages (mock) */
  taskThreadMessages?: import('./taskMessage').TaskThreadMessage[];
  /** §C.37 agent council members */
  members?: Message[];
  /** §C.17 batch tasks count */
  tasksCount?: number;
  /** §C.17 group tasks */
  groupTasksTitle?: string;
}
