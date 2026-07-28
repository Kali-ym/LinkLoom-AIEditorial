export const FEED_CATEGORIES = [
  { id: 'model_weights', label: '模型与权重' },
  { id: 'agent_tools', label: 'Agent 与工具' },
  { id: 'train_infra', label: '训推与基建' },
  { id: 'product_biz', label: '产品与商业' },
  { id: 'safety_gov', label: '安全与治理' },
  { id: 'research_eval', label: '研究与评测' }
] as const;

export type FeedCategory = (typeof FEED_CATEGORIES)[number]['id'];
