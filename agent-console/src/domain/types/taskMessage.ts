import type { AssistantContentBlock } from './messageBlocks';

/** Upstream `ThreadStatus` subset — §C.47 */
export type TaskThreadStatus =
  | 'Processing'
  | 'InReview'
  | 'Pending'
  | 'Active'
  | 'Todo'
  | 'Completed'
  | 'Failed'
  | 'Cancel';

export interface TaskDetail {
  status?: TaskThreadStatus;
  threadId?: string;
  clientMode?: boolean;
  title?: string;
  instruction?: string;
  duration?: number;
  startedAt?: string;
  startTime?: number;
  totalToolCalls?: number;
  totalSteps?: number;
  totalMessages?: number;
  totalCost?: number;
  error?: Record<string, unknown>;
}

/** Thread 内执行块（mock / adapter 注入） */
export interface TaskThreadMessage {
  id: string;
  role: 'assistant' | 'user';
  content?: string;
  children?: AssistantContentBlock[];
}
