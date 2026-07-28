export type AiRelevanceTier = 1 | 3 | 5;
export type EditorialMode = 'standard' | 'conservative';

export interface EditorialSourceItem {
  index: number;
  title: string;
  url: string;
  source?: string;
  source_tier?: string;
}

export interface EditorialTopic {
  topic_id: string;
  action: 'keep' | 'merge' | 'drop';
  headline: string;
  ai_relevance_tier: AiRelevanceTier;
  importance_rank: number;
  importance_reason?: string;
  suggested_section?: string;
  source_items: EditorialSourceItem[];
  cluster_reason?: string;
  drop_reason?: string;
  editorial_note?: string;
  headline_candidate?: boolean;
}

export interface EditorialLog {
  received: number;
  dedup_removed: number;
  tier1_dropped: number;
  tier3_kept: number;
  tier5_kept: number;
  clusters_formed: number;
  topics_kept: number;
  items_in_topics?: number;
  items_dropped?: number;
  items_merged_away?: number;
  items_auto_recovered?: number;
  cross_day_dropped?: number;
  cross_day_continuation?: number;
}

export interface EditorialPlan {
  input_count: number;
  output_topic_count: number;
  editorial_log: EditorialLog;
  topics: EditorialTopic[];
  dropped: EditorialTopic[];
}
