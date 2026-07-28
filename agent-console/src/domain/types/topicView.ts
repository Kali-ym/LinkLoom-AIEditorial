import type { Topic, TopicStatus } from './topic';

export type TopicViewTrigger = 'chat' | 'api' | 'task' | 'eval';

/** §C.53 — management page topic row/card (withDetails) */
export interface TopicViewItem extends Topic {
  trigger?: TopicViewTrigger;
  messageCount?: number;
  description?: string;
  historySummary?: string;
  firstUserMessage?: string;
  cost?: number;
  /** Normalized status for management filters */
  viewStatus?: TopicStatus | 'active' | 'archived';
}

export interface TopicViewGroup {
  children: TopicViewItem[];
  id: string;
  title?: string;
}
