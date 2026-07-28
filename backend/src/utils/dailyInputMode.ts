/**
 * 日报流水线输入模式：区分「已是 AI 摘要」与「原文/抓取描述需再摘要」。
 */

export type DailyInputMode = 'ai_summary' | 'original' | 'mixed';

export interface DailyInputItem {
  index?: number;
  selectedOrder?: number;
  title?: string;
  url?: string;
  description?: string;
  source?: string;
  source_tier?: string;
  published_date?: string;
  category?: string;
  author?: string;
  ingestion_date?: string;
  metadata?: Record<string, unknown>;
}

function pickString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** 是否有足够长的原文正文（非 AI 摘要）可供 material_brief 再压缩。 */
export function hasOriginalBody(item: DailyInputItem): boolean {
  const meta = item.metadata || {};
  const full = pickString(meta.full_content) || pickString(meta.content_html);
  if (full.length >= 200) return true;

  const desc = pickString(item.description);
  const aiSummary = pickString(meta.ai_summary);
  if (!desc) return false;
  if (!aiSummary) return desc.length >= 80;

  // description 与 ai_summary 明显不同且足够长 → 视为原文/抓取描述
  if (desc !== aiSummary && desc.length >= 120) return true;
  if (desc !== aiSummary && !aiSummary.includes(desc) && desc.length >= 60) return true;
  return false;
}

/** 单条是否可视为「只有 AI 摘要、无需再跑 material_brief LLM」。 */
export function isAiSummaryOnlyItem(item: DailyInputItem): boolean {
  const meta = item.metadata || {};
  const aiSummary = pickString(meta.ai_summary);
  if (!aiSummary) return false;
  return !hasOriginalBody(item);
}

export function detectDailyInputMode(items: DailyInputItem[]): DailyInputMode {
  if (!items.length) return 'original';
  let aiOnly = 0;
  let original = 0;
  for (const it of items) {
    if (isAiSummaryOnlyItem(it)) aiOnly += 1;
    else original += 1;
  }
  if (aiOnly === items.length) return 'ai_summary';
  if (original === items.length) return 'original';
  return 'mixed';
}

function eventSignatureFromTitle(title: string): string {
  const core = title
    .replace(/[^\w\u4e00-\u9fff\s-]/g, ' ')
    .trim()
    .slice(0, 48);
  return core.replace(/\s+/g, '-').slice(0, 40) || 'topic';
}

/** 从 AI 摘要条目直接映射为 daily_material_brief 的单条输出（不调 LLM）。 */
export function mapAiSummaryToBriefItem(item: DailyInputItem, fallbackIndex: number) {
  const meta = item.metadata || {};
  const aiSummary = pickString(meta.ai_summary);
  const index =
    typeof item.index === 'number'
      ? item.index
      : typeof item.selectedOrder === 'number'
        ? item.selectedOrder
        : fallbackIndex + 1;

  const existingMeta = meta.source_meta;
  const sourceMeta =
    existingMeta && typeof existingMeta === 'object' ? existingMeta : inferSourceMetaFromItem(item);

  return {
    index,
    title: pickString(item.title),
    url: pickString(item.url),
    source: pickString(item.source),
    source_tier: pickString(item.source_tier) || pickString(meta.source_tier) || 'unknown',
    published_date: item.published_date,
    source_summary: aiSummary,
    key_facts: Array.isArray(meta.key_facts)
      ? (meta.key_facts as unknown[]).filter((v) => typeof v === 'string').slice(0, 5)
      : [],
    entities: Array.isArray(meta.entities)
      ? (meta.entities as unknown[]).filter((v) => typeof v === 'string').slice(0, 8)
      : [],
    numbers: [],
    ai_relevance_hint:
      pickString(meta.ai_relevance_hint) ||
      (typeof meta.ai_score === 'number' && meta.ai_score >= 70 ? 'direct_ai' : 'indirect_tech'),
    event_signature:
      pickString(meta.event_signature) || eventSignatureFromTitle(pickString(item.title)),
    source_meta: sourceMeta
  };
}

function inferSourceMetaFromItem(item: DailyInputItem) {
  const meta = item.metadata || {};
  const sourceType = pickString(meta.ai_source_type);
  const author = pickString(item.author);
  const source = pickString(item.source);
  const handleMatch = author.match(/@([\w.-]+)/);

  let kind = '综合资讯';
  if (sourceType === 'kol') kind = 'X·KOL';
  else if (sourceType === 'official') kind = author.includes('@') ? '官方·X' : '官方';
  else if (sourceType === 'academic') kind = '学术机构';
  else if (sourceType === 'blog') kind = '大咖博客';
  else if (sourceType === 'media') kind = '综合资讯';

  const name = author || source.replace(/[（(].*?[)）]/g, '').trim();
  const handle = handleMatch ? `@${handleMatch[1]}` : '';
  const parts = [`${kind}：${name}`];
  if (handle) parts[0] += ` (${handle})`;

  return {
    kind,
    name,
    handle,
    format: /\bRSS\b/i.test(source) ? 'RSS' : ''
  };
}

/** Admin 预览：描述是否与 AI 总结重复（应隐藏「描述」块）。 */
export function isDescriptionDuplicateOfAiSummary(
  description: unknown,
  aiSummary: unknown
): boolean {
  const d = pickString(description);
  const s = pickString(aiSummary);
  if (!d || !s) return false;
  if (d === s) return true;
  if (s.includes(d) && d.length >= 40) return true;
  if (d.includes(s) && s.length >= 40) return true;
  return false;
}

/** 取应展示的「原始描述」：排除与 AI 总结重复的 description。 */
export function resolveRawDescription(item: {
  description?: unknown;
  metadata?: Record<string, unknown>;
}): string {
  const aiSummary = pickString(item.metadata?.ai_summary);
  const translated = pickString(item.metadata?.translated_description);
  const raw = pickString(item.description);
  if (translated && !isDescriptionDuplicateOfAiSummary(translated, aiSummary)) return translated;
  if (raw && !isDescriptionDuplicateOfAiSummary(raw, aiSummary)) return raw;
  return '';
}
