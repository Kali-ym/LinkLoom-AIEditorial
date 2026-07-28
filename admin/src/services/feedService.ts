import { request } from './api';

export type FeedSourceType = 'official' | 'kol' | 'media' | 'academic' | 'blog';
export type FeedTopic = 'model' | 'product' | 'industry' | 'paper' | 'practice';

export interface FeedTimelineItem {
  id: string;
  title: string;
  url?: string;
  source: string;
  sourceLabel?: string;
  sourceType?: FeedSourceType;
  publishedAt: string;
  ingestionDate?: string;
  category?: string;
  score?: number;
  picked?: boolean;
  topic?: FeedTopic;
  tags?: string[];
  summary?: string;
  summaryShort?: string;
  recommendation?: string;
  relatedIds?: string[];
  scored?: boolean;
  /** 抓取时的原始描述，不含 AI 摘要 */
  description?: string;
  contentHtml?: string;
  fullContent?: string;
}

export interface FeedAdminStats {
  raw: number;
  processed24h: number;
  failed24h: number;
  passRate24h: number;
  lastDigestAt?: string;
}

export const getAdminStats = () => request('/api/feed/admin/stats') as Promise<FeedAdminStats>;

export const getRawTimeline = (
  params: {
    date?: string;
    rangeFrom?: string;
    rangeTo?: string;
    limit?: number;
    offset?: number;
  } = {}
) => {
  const q = new URLSearchParams();
  if (params.date) q.set('date', params.date);
  if (params.rangeFrom) q.set('rangeFrom', params.rangeFrom);
  if (params.rangeTo) q.set('rangeTo', params.rangeTo);
  if (params.limit) q.set('limit', String(params.limit));
  if (params.offset) q.set('offset', String(params.offset));
  const qs = q.toString();
  return request(`/api/feed/admin/raw${qs ? `?${qs}` : ''}`) as Promise<{
    total: number;
    items: FeedTimelineItem[];
  }>;
};

export interface FeedItemDetail {
  id: string;
  title: string;
  url?: string;
  source?: string;
  author?: string;
  category?: string;
  published_date?: string;
  ingestion_date?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export const getFeedItemDetail = (id: string) =>
  request(`/api/feed/admin/items/${id}`) as Promise<FeedItemDetail>;

export const getProcessedTimeline = (
  params: {
    date?: string;
    rangeFrom?: string;
    rangeTo?: string;
    topic?: string;
    sourceType?: string;
    picked?: boolean;
    limit?: number;
    offset?: number;
  } = {}
) => {
  const q = new URLSearchParams();
  if (params.date) q.set('date', params.date);
  if (params.rangeFrom) q.set('rangeFrom', params.rangeFrom);
  if (params.rangeTo) q.set('rangeTo', params.rangeTo);
  if (params.topic) q.set('topic', params.topic);
  if (params.sourceType) q.set('sourceType', params.sourceType);
  if (params.picked) q.set('picked', '1');
  if (params.limit) q.set('limit', String(params.limit));
  if (params.offset) q.set('offset', String(params.offset));
  const qs = q.toString();
  return request(`/api/feed/admin/processed${qs ? `?${qs}` : ''}`) as Promise<{
    items: FeedTimelineItem[];
    nextCursor: string | null;
    total: number;
  }>;
};

const FEED_SCORING_METADATA_KEYS = [
  'ai_score',
  'ai_summary',
  'ai_summary_short',
  'ai_recommendation',
  'ai_source_type',
  'ai_topic',
  'ai_tags',
  'ai_picked'
];

export const resetScoring = (id: string) =>
  request(`/api/feed/admin/scoring/${id}/reset`, {
    method: 'POST',
    body: JSON.stringify({ keys: FEED_SCORING_METADATA_KEYS, stamp: 'ai_scored_at' })
  });

export const patchScoring = (
  id: string,
  patch: Partial<
    Pick<
      FeedTimelineItem,
      | 'score'
      | 'summary'
      | 'summaryShort'
      | 'recommendation'
      | 'sourceType'
      | 'topic'
      | 'tags'
      | 'picked'
    >
  >
) => {
  const metadata: Record<string, any> = {};
  if (patch.score !== undefined) metadata.ai_score = patch.score;
  if (patch.summary !== undefined) metadata.ai_summary = patch.summary;
  if (patch.summaryShort !== undefined) metadata.ai_summary_short = patch.summaryShort;
  if (patch.recommendation !== undefined) metadata.ai_recommendation = patch.recommendation;
  if (patch.sourceType !== undefined) metadata.ai_source_type = patch.sourceType;
  if (patch.topic !== undefined) metadata.ai_topic = patch.topic;
  if (patch.tags !== undefined) metadata.ai_tags = patch.tags;
  if (patch.picked !== undefined) metadata.ai_picked = patch.picked;
  return request(`/api/feed/admin/scoring/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      metadata,
      allowedKeys: FEED_SCORING_METADATA_KEYS,
      stamp: 'ai_scored_at'
    })
  });
};

export const getDailyReportJson = (
  date: string
): Promise<{ date: string; report: unknown } | null> =>
  request(`/api/feed/report-json?date=${encodeURIComponent(date)}`);
