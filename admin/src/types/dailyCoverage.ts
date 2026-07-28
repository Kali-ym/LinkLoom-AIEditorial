export interface PriorCoverageMatch {
  index: number;
  kind: 'url_exact' | 'title_similar' | 'semantic';
  prior_date: string;
  prior_headline: string;
  prior_topic_id?: string;
  score?: number;
  suggestion: 'drop' | 'continuation' | 'new_angle';
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
