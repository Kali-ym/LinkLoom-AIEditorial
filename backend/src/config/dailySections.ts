/**
 * AI 资讯日报正文六栏 —— 与评分侧 `ai_category` / FEED_CATEGORIES 对齐。
 *
 * 命名规则保持「中文标题/英文短称」一一对应，便于 prompt、Tool 组装与前端渲染
 * 用同一份数据源驱动。
 */
export interface DailyBodySectionMeta {
  /** 中文标题，同时作为 section.id（与 prompt 中的 `###` 栏目名严格一致） */
  id: string;
  /** 英文副标题，用于栏目副标题 */
  subtitle: string;
  /** 路由用代码（小写、英文短名），与 ai_category 车道对应 */
  code: 'model' | 'agent' | 'infra' | 'product' | 'safety' | 'research';
  /** 对应 feed 评分字段 ai_category */
  aiCategory: string;
}

export const DAILY_BODY_SECTION_META: readonly DailyBodySectionMeta[] = [
  { id: '模型与权重', subtitle: 'Model & Weights', code: 'model', aiCategory: 'model_weights' },
  { id: 'Agent 与工具', subtitle: 'Agent & Tools', code: 'agent', aiCategory: 'agent_tools' },
  { id: '训推与基建', subtitle: 'Train & Infra', code: 'infra', aiCategory: 'train_infra' },
  { id: '产品与商业', subtitle: 'Product & Biz', code: 'product', aiCategory: 'product_biz' },
  { id: '安全与治理', subtitle: 'Safety & Gov', code: 'safety', aiCategory: 'safety_gov' },
  { id: '研究与评测', subtitle: 'Research & Eval', code: 'research', aiCategory: 'research_eval' }
] as const;

/** 仅栏目名数组，保持原有导出名以兼容旧代码。 */
export const DAILY_BODY_SECTIONS = [
  '模型与权重',
  'Agent 与工具',
  '训推与基建',
  '产品与商业',
  '安全与治理',
  '研究与评测'
] as const;

export type DailyBodySection = (typeof DAILY_BODY_SECTIONS)[number];

/** 默认兜底栏目（无法识别时） */
export const DAILY_SECTION_FALLBACK: DailyBodySection = '产品与商业';

/** 路由/策划/正文分组使用的全部栏目名 */
export const DAILY_SECTIONS: readonly string[] = [...DAILY_BODY_SECTIONS];

/**
 * 旧版栏目 → 新版六栏兜底映射。
 *
 * - 上一版杂志体五栏（模型发布/更新 … 技巧与观点）
 * - 更早五栏 / 六栏遗留名
 *
 * 任何无法识别的栏目最终都会兜底到「产品与商业」，避免渲染时丢条目。
 */
export const LEGACY_SECTION_MAP: Record<string, DailyBodySection> = {
  // ── 上一版杂志体 5 栏 ────────────────────────────────────────
  '模型发布/更新': '模型与权重',
  '产品发布/更新': '产品与商业',
  行业动态: '产品与商业',
  论文研究: '研究与评测',
  技巧与观点: 'Agent 与工具',
  // ── 再上一版 5 栏 ────────────────────────────────────────────
  '模型、产品与应用': '产品与商业',
  'Agent 与开发者工具': 'Agent 与工具',
  '研究、评测与安全': '研究与评测',
  '算力、公司与政策': '训推与基建',
  开源项目与资源: 'Agent 与工具',
  // ── 更早 6 栏 ────────────────────────────────────────────────
  产品与功能更新: '产品与商业',
  前沿研究: '研究与评测',
  行业展望与社会影响: '产品与商业',
  开源TOP项目: 'Agent 与工具',
  社媒分享: '产品与商业',
  软件资源分享: 'Agent 与工具'
};

/** ai_category → 日报栏目（摘要版弱先验） */
export const AI_CATEGORY_TO_SECTION: Record<string, DailyBodySection> = {
  model_weights: '模型与权重',
  agent_tools: 'Agent 与工具',
  train_infra: '训推与基建',
  product_biz: '产品与商业',
  safety_gov: '安全与治理',
  research_eval: '研究与评测'
};

const SECTION_SET = new Set<string>(DAILY_BODY_SECTIONS);

export function normalizeDailySection(section: string | undefined): DailyBodySection {
  const s = (section || '').trim();
  if (SECTION_SET.has(s)) return s as DailyBodySection;
  if (LEGACY_SECTION_MAP[s]) return LEGACY_SECTION_MAP[s];
  return DAILY_SECTION_FALLBACK;
}

/** 由评分 ai_category 映射到日报栏目；未知则返回 undefined */
export function sectionFromAiCategory(aiCategory: string | undefined): DailyBodySection | undefined {
  if (!aiCategory) return undefined;
  return AI_CATEGORY_TO_SECTION[aiCategory.trim()];
}

/** 查找栏目元信息（带兜底） */
export function getDailyBodySectionMeta(section: string | undefined): DailyBodySectionMeta {
  const id = normalizeDailySection(section);
  return DAILY_BODY_SECTION_META.find((s) => s.id === id) || DAILY_BODY_SECTION_META[3];
}
