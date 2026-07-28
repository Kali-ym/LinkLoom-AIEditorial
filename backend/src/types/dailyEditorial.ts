/** 来源可信度分级 */
export type SourceTier = 'official' | 'mainstream' | 'community' | 'aggregator' | 'unknown';

/** AI 相关性：5=直接 AI，3=间接科技，1=基本无关 */
export type AiRelevanceTier = 1 | 3 | 5;

export type EditorialAction = 'keep' | 'merge' | 'drop';

export interface EditorialSourceItem {
  index: number;
  title: string;
  url: string;
  source?: string;
  source_tier?: SourceTier;
}

export interface EditorialTopic {
  topic_id: string;
  action: EditorialAction;
  headline: string;
  ai_relevance_tier: AiRelevanceTier;
  importance_rank: number;
  importance_reason: string;
  suggested_section: string;
  source_items: EditorialSourceItem[];
  cluster_reason?: string;
  drop_reason?: string;
  editorial_note?: string;
  /** 是否进入今日要闻（程序层会按 rank 截断至 headlineMaxTopics） */
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
  /** 进入 topics 的素材条数（merge 主题按 source_items 计） */
  items_in_topics?: number;
  /** 进入 dropped 的素材条数 */
  items_dropped?: number;
  /** 因 merge 少计的主题数 = Σ(source_items.length - 1) */
  items_merged_away?: number;
  /** 策划 JSON 漏条、程序按 keep 补回 */
  items_auto_recovered?: number;
  /** 跨日重复丢弃主题/条数 */
  cross_day_dropped?: number;
  /** 跨日续报标记数 */
  cross_day_continuation?: number;
}

export interface EditorialPlan {
  input_count: number;
  output_topic_count: number;
  editorial_log: EditorialLog;
  topics: EditorialTopic[];
  dropped: EditorialTopic[];
}

export type EditorialMode = 'standard' | 'conservative';
