import type { EditorialPlan } from './dailyEditorial.js';

export interface DailyCoverageTopic {
  date: string;
  topic_id: string;
  headline: string;
  urls: string[];
  suggested_section?: string;
  importance_rank?: number;
  headline_candidate?: boolean;
  source_titles?: string[];
}

export type PriorCoverageMatchKind = 'url_exact' | 'title_similar' | 'semantic';

export type PriorCoverageSuggestion = 'drop' | 'continuation' | 'new_angle';

export interface PriorCoverageMatch {
  index: number;
  kind: PriorCoverageMatchKind;
  prior_date: string;
  prior_headline: string;
  prior_topic_id?: string;
  history_id?: number;
  score?: number;
  suggestion: PriorCoverageSuggestion;
  url?: string;
}

export interface PriorCoveragePayload {
  lookback_days: number;
  as_of_date: string;
  reported_urls: string[];
  matches: PriorCoverageMatch[];
  summary_markdown: string;
  memory_summary?: string;
  knowledge_summary?: string;
}

export interface DailyCoverageIngestResult {
  memoryId?: string;
  documentId?: string;
  knowledgeCategoryId?: string;
  memoryCategoryId?: string;
  topicCount: number;
  urlCount: number;
}

export interface DailyCoverageIngestInput {
  historyId?: number;
  date: string;
  namespace?: string;
  editorialPlan?: EditorialPlan;
  /** 结构化 JSON 日报；当 editorialPlan 无有效条目时用于构建覆盖索引。 */
  reportJson?: Record<string, unknown>;
  markdown: string;
  platform?: string;
}

export interface DailyCoverageIndexRow {
  date: string;
  topic_id: string;
  url_norm: string;
  headline: string;
  section: string;
  importance_rank: number;
  ingested_at: number;
}

export interface PublicationItem {
  id: number;
  historyId: number;
  date: string;
  topicId: string;
  title: string;
  urlNorm: string;
  section: string;
  importanceRank: number;
  metadata: Record<string, unknown>;
  createdAt: number;
}

export interface PublicationItemInput {
  historyId: number;
  date: string;
  topicId: string;
  title: string;
  urlNorm: string;
  section: string;
  importanceRank: number;
  metadata?: Record<string, unknown>;
  createdAt?: number;
}

export interface PublicationHistoryQueryItem {
  index: number;
  title?: string;
  url?: string;
}

export interface PublicationHistoryQueryInput {
  asOfDate: string;
  namespace?: string;
  lookbackDays?: number;
  items: PublicationHistoryQueryItem[];
  titleThreshold?: number;
}

export interface PublicationHistoryQueryResult {
  lookbackDays: number;
  asOfDate: string;
  summary: string;
  reportedUrls: string[];
  matches: PriorCoverageMatch[];
}
