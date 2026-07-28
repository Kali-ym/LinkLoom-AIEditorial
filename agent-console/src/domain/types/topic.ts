export type TopicStatus =
  | 'temp'
  | 'completed'
  | 'running'
  | 'waiting'
  | 'unread'
  | 'failed'
  | 'platform';

export interface Topic {
  id: string;
  title: string;
  status: TopicStatus;
  group?: 'yesterday' | 'earlier';
  elapsed?: string;
  tag?: string;
  active?: boolean;
  fav?: boolean;
  workingDirectory?: string;
  platform?: string;
  userId?: string;
  /** ISO timestamp — §C.44 byTime 分组 */
  createdAt?: string;
  updatedAt?: string;
  /** Owning agent — mock 期用于 MoveTopicsModal */
  agentId?: string;
}

/** Side thread under a topic — `label` matches index.html `data-thread` DOM. */
export interface TopicThread {
  id: string;
  label: string;
  active?: boolean;
}
