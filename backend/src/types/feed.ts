import type { FeedCategory } from '../config/feedCategories.js';

export type { FeedCategory } from '../config/feedCategories.js';

export const FEED_SOURCE_TYPES = ['official', 'kol', 'media', 'academic', 'blog'] as const;
export type FeedSourceType = (typeof FEED_SOURCE_TYPES)[number];

export const FEED_TOPICS = ['model', 'product', 'industry', 'paper', 'practice'] as const;
export type FeedTopic = (typeof FEED_TOPICS)[number];

export interface TimelineFeedItem {
  id: string;
  title: string;
  url?: string;
  source: string;
  sourceLabel?: string;
  /** Author / feed profile image when available (e.g. Folo feeds.image). */
  sourceImage?: string;
  sourceType?: FeedSourceType;
  publishedAt: string;
  ingestionDate?: string;
  category?: string;
  categoryId?: FeedCategory;
  permalink?: string;
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

export interface TimelineContext {
  eventId: string;
  title: string;
}

export interface TimelineResponse {
  items: TimelineFeedItem[];
  nextCursor: string | null;
  total: number;
  context?: TimelineContext | null;
}

export interface HotEventMember {
  itemId: string;
  permalink: string;
  sourceLabel: string;
  role: 'primary' | 'secondary';
  title: string;
  url?: string;
  sourceImage?: string;
  summary?: string;
  publishedAt: string;
}

export interface HotEvent {
  id: string;
  title: string;
  why?: string;
  heat: number;
  sourceCount: number;
  tags?: string[];
  members: HotEventMember[];
}

export type HotBoardPeriod = 'realtime' | 'week' | 'month';

export interface HotBoards {
  realtime: HotEvent[];
  week: HotEvent[];
  month: HotEvent[];
}

/** Public reader item detail (`GET /api/feed/items/:id`). */
export interface ItemDetail {
  id: string;
  title: string;
  sourceLabel: string;
  sourceUrl?: string;
  sourceImage?: string;
  publishedAt: string;
  categoryId?: FeedCategory;
  tags?: string[];
  picked?: boolean;
  score?: number;
  summary?: string;
  recommendation?: string;
  /** Raw pipeline HTML when bodyStatus=full; web strips to plain text paragraphs. */
  bodyHtml?: string | null;
  bodyStatus: 'full' | 'summary_only';
  relatedItemIds?: string[];
  permalink: string;
  sourceType?: FeedSourceType;
}

export interface FeedAdminStats {
  raw: number;
  processed24h: number;
  failed24h: number;
  passRate24h: number;
  lastDigestAt?: string;
}
