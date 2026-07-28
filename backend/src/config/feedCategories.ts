export const FEED_CATEGORIES = [
  { id: 'model_weights', label: '模型与权重' },
  { id: 'agent_tools', label: 'Agent 与工具' },
  { id: 'train_infra', label: '训推与基建' },
  { id: 'product_biz', label: '产品与商业' },
  { id: 'safety_gov', label: '安全与治理' },
  { id: 'research_eval', label: '研究与评测' }
] as const;

export type FeedCategory = (typeof FEED_CATEGORIES)[number]['id'];

const LEGACY: Record<string, FeedCategory> = {
  model: 'model_weights',
  product: 'product_biz',
  industry: 'product_biz',
  paper: 'research_eval',
  practice: 'agent_tools'
};

export function mapLegacyTopicToCategory(topic: string | undefined): FeedCategory | undefined {
  if (!topic) return undefined;
  if ((FEED_CATEGORIES as readonly { id: string }[]).some((c) => c.id === topic)) {
    return topic as FeedCategory;
  }
  return LEGACY[topic];
}

export function categoryToLegacyTopic(category: FeedCategory): string {
  const map: Record<FeedCategory, string> = {
    model_weights: 'model',
    agent_tools: 'practice',
    train_infra: 'industry',
    product_biz: 'product',
    safety_gov: 'industry',
    research_eval: 'paper'
  };
  return map[category];
}
