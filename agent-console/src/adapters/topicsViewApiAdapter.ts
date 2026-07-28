import type { TopicViewItem } from '../domain/types/topicView';

export const TOPICS_VIEW_API_PAGE_SIZE = 30;

export interface FetchAgentTopicsViewParams {
  agentId: string;
  page: number;
  pageSize?: number;
  /** Mock passes enriched list; REST would omit and fetch server-side */
  sourceItems: TopicViewItem[];
}

export interface FetchAgentTopicsViewResult {
  items: TopicViewItem[];
  hasMore: boolean;
  total: number;
}

/** §C.53 — mock paginated REST; swap for fetch() when API ready */
export async function fetchAgentTopicsView({
  agentId,
  page,
  pageSize = TOPICS_VIEW_API_PAGE_SIZE,
  sourceItems,
}: FetchAgentTopicsViewParams): Promise<FetchAgentTopicsViewResult> {
  await new Promise((r) => window.setTimeout(r, page === 1 ? 280 : 320));
  void agentId;
  const end = page * pageSize;
  return {
    items: sourceItems.slice(0, end),
    hasMore: sourceItems.length > end,
    total: sourceItems.length,
  };
}
