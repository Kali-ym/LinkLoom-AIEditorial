import { normalizeDailySection } from '../../config/dailySections.js';
import { pickHigherSourceTier, resolveSourceTier } from '../../config/sourceTierMap.js';
import type { SourceTierSetting } from '../../types/config.js';
import type {
  EditorialSourceItem,
  EditorialPlan,
  EditorialTopic,
  SourceTier
} from '../../types/dailyEditorial.js';

type EnrichedEditorialSourceItem = EditorialSourceItem & Record<string, unknown>;

export function normalizeUrlForDedup(url: string): string {
  const raw = (url || '').trim();
  if (!raw) return '';
  try {
    const u = new URL(raw);
    u.hash = '';
    u.search = '';
    const path = u.pathname.replace(/\/+$/, '') || '/';
    return `${u.protocol}//${u.hostname.replace(/^www\./, '')}${path}`.toLowerCase();
  } catch {
    return raw.toLowerCase();
  }
}

/** 已知的跟踪类查询参数前缀（按需扩充） */
const TRACKING_PARAM_PREFIXES = ['utm_'];

/** 已知的跟踪类查询参数完整名（按需扩充） */
const TRACKING_PARAM_EXACT = new Set([
  'fbclid',
  'gclid',
  'msclkid',
  'mc_cid',
  'mc_eid',
  'spm',
  'ref_src',
  'share_token'
]);

/**
 * 入库去重用的 URL 归一化：保留区分文章身份的 query 参数（如微信 mp 的 mid/idx/sn），
 * 仅剥离 fragment 与已知跟踪参数，对 host 去 www 并统一小写。
 * 与 `normalizeUrlForDedup` 不同，本函数**不会**整段丢弃 search，因此适合作为
 * 「同一篇文章只入库一行」的稳定 key。
 */
export function normalizeUrlForStorage(url: string): string {
  const raw = (url || '').trim();
  if (!raw) return '';
  try {
    const u = new URL(raw);
    u.hash = '';
    const kept = [...u.searchParams.entries()].filter(([key]) => {
      const k = key.toLowerCase();
      if (TRACKING_PARAM_EXACT.has(k)) return false;
      if (TRACKING_PARAM_PREFIXES.some((p) => k.startsWith(p))) return false;
      return true;
    });
    kept.sort(([a], [b]) => a.localeCompare(b));
    const search = kept.length
      ? '?' + kept.map(([k, v]) => (v === '' ? k : `${k}=${v}`)).join('&')
      : '';
    const path = u.pathname.replace(/\/+$/, '') || '/';
    return `${u.protocol}//${u.hostname.replace(/^www\./, '')}${path}${search}`.toLowerCase();
  } catch {
    return raw.toLowerCase();
  }
}

export function normalizeTitleForDedup(title: string): string {
  return (title || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 字符 bigram Jaccard，用于标题近似去重 */
export function titleSimilarity(a: string, b: string): number {
  const na = normalizeTitleForDedup(a);
  const nb = normalizeTitleForDedup(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const grams = (s: string) => {
    const set = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
    return set;
  };
  const ga = grams(na);
  const gb = grams(nb);
  let inter = 0;
  for (const g of ga) {
    if (gb.has(g)) inter++;
  }
  const union = ga.size + gb.size - inter;
  return union === 0 ? 0 : inter / union;
}

export interface DedupRemovedEntry {
  index: number;
  title: string;
  url: string;
  reason: 'duplicate_url' | 'duplicate_title';
  kept_index: number;
}

export function deduplicatePipelineItems(
  items: Record<string, unknown>[],
  titleThreshold = 0.92,
  sourceTierOverrides?: Record<string, SourceTierSetting>
): {
  items: Record<string, unknown>[];
  removed: DedupRemovedEntry[];
} {
  const kept: Record<string, unknown>[] = [];
  const removed: DedupRemovedEntry[] = [];

  for (const item of items) {
    const url = String(item.url ?? '');
    const normUrl = normalizeUrlForDedup(url);
    const title = String(item.title ?? '');
    const tier = resolveSourceTier(
      url,
      String(item.source ?? ''),
      String(item.adapterId ?? item.category ?? ''),
      sourceTierOverrides
    );
    item.source_tier = tier;

    let dupIndex = -1;
    let reason: DedupRemovedEntry['reason'] | null = null;

    if (normUrl) {
      dupIndex = kept.findIndex((k) => normalizeUrlForDedup(String(k.url ?? '')) === normUrl);
      if (dupIndex >= 0) reason = 'duplicate_url';
    }
    if (dupIndex < 0 && title) {
      dupIndex = kept.findIndex(
        (k) => titleSimilarity(String(k.title ?? ''), title) >= titleThreshold
      );
      if (dupIndex >= 0) reason = 'duplicate_title';
    }

    if (dupIndex >= 0 && reason) {
      const existing = kept[dupIndex];
      const existingTier = (existing.source_tier as SourceTier) || 'unknown';
      const newTier = tier;
      if (
        reason === 'duplicate_title' ||
        (reason === 'duplicate_url' &&
          pickHigherSourceTier(newTier, existingTier) === newTier &&
          newTier !== existingTier)
      ) {
        removed.push({
          index: Number(existing.index ?? dupIndex + 1),
          title: String(existing.title ?? ''),
          url: String(existing.url ?? ''),
          reason,
          kept_index: Number(item.index ?? kept.length + 1)
        });
        kept[dupIndex] = { ...item, source_tier: pickHigherSourceTier(newTier, existingTier) };
      } else {
        removed.push({
          index: Number(item.index ?? kept.length + 1),
          title,
          url,
          reason,
          kept_index: Number(existing.index ?? dupIndex + 1)
        });
      }
      continue;
    }

    kept.push(item);
  }

  kept.forEach((item, idx) => {
    item.index = idx + 1;
  });

  return { items: kept, removed };
}

function countTopicSourceItems(topics: EditorialTopic[]): number {
  return topics.reduce((sum, t) => sum + (t.source_items?.length || 0), 0);
}

function collectCoveredIndexCounts(plan: EditorialPlan): Map<number, number> {
  const covered = new Map<number, number>();
  const add = (topics: EditorialTopic[]) => {
    for (const t of topics) {
      for (const s of (t.source_items || []) as unknown[]) {
        const idx = typeof s === 'number' ? s : Number((s as { index?: unknown })?.index);
        if (Number.isFinite(idx) && idx > 0) covered.set(idx, (covered.get(idx) || 0) + 1);
      }
    }
  };
  add(plan.topics || []);
  add(plan.dropped || []);
  return covered;
}

function copyOptionalSourceFields(
  target: Record<string, unknown>,
  source: Record<string, unknown>
) {
  for (const field of [
    'source_summary',
    'key_facts',
    'entities',
    'numbers',
    'ai_relevance_hint',
    'event_signature'
  ]) {
    if (target[field] === undefined && source[field] !== undefined) target[field] = source[field];
  }
}

function asSourceTier(value: unknown): SourceTier | undefined {
  return value === 'official' ||
    value === 'mainstream' ||
    value === 'community' ||
    value === 'aggregator' ||
    value === 'unknown'
    ? value
    : undefined;
}

/**
 * 策划 JSON 必须覆盖全部输入 index；模型漏条/重复条直接失败，不再按默认 keep 补回。
 * 可选 routeItems/materialItems 用于按 index 回填栏目与素材摘要字段。
 */
export function reconcileEditorialPlanCoverage(
  plan: EditorialPlan,
  inputItems: Record<string, unknown>[],
  opts?: {
    routeItems?: Record<string, unknown>[];
    materialItems?: Record<string, unknown>[];
  }
): EditorialPlan {
  const inputByIndex = new Map<number, Record<string, unknown>>();
  for (const item of inputItems) {
    const idx = Number(item.index);
    if (Number.isFinite(idx) && idx > 0) inputByIndex.set(idx, item);
  }

  const covered = collectCoveredIndexCounts(plan);
  const missing = [...inputByIndex.keys()].filter((idx) => !covered.has(idx));
  const duplicate = [...covered.entries()].filter(([, count]) => count > 1).map(([idx]) => idx);
  const unknown = [...covered.keys()].filter((idx) => !inputByIndex.has(idx));
  const coverageErrors: string[] = [];
  if (missing.length) coverageErrors.push(`missing indices: ${missing.join(',')}`);
  if (duplicate.length) coverageErrors.push(`duplicate indices: ${duplicate.join(',')}`);
  if (unknown.length) coverageErrors.push(`unknown indices: ${unknown.join(',')}`);
  if (coverageErrors.length > 0) {
    throw new Error(`editorial plan coverage mismatch (${coverageErrors.join('; ')})`);
  }

  const routeByIndex = new Map<number, Record<string, unknown>>();
  for (const item of opts?.routeItems || []) {
    const idx = Number(item.index);
    if (Number.isFinite(idx) && idx > 0) routeByIndex.set(idx, item);
  }
  const materialByIndex = new Map<number, Record<string, unknown>>();
  for (const item of opts?.materialItems || []) {
    const idx = Number(item.index);
    if (Number.isFinite(idx) && idx > 0) materialByIndex.set(idx, item);
  }

  const resolveSection = (topic: EditorialTopic) => {
    const counts = new Map<string, number>();
    for (const source of (topic.source_items || []) as unknown[]) {
      const idx =
        typeof source === 'number' ? source : Number((source as { index?: unknown })?.index);
      const routed = routeByIndex.get(idx);
      const sourceRecord = source as EnrichedEditorialSourceItem;
      const section = normalizeDailySection(
        String(
          routed?.suggested_section ??
            sourceRecord.suggested_section ??
            topic.suggested_section ??
            ''
        )
      );
      counts.set(section, (counts.get(section) || 0) + 1);
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0) return sorted[0][0];
    return normalizeDailySection(topic.suggested_section);
  };

  const enrichSource = (source: EditorialSourceItem | number): EnrichedEditorialSourceItem => {
    const idx = typeof source === 'number' ? source : Number(source.index);
    const base = inputByIndex.get(idx) || {};
    const material = materialByIndex.get(idx) || {};
    const routed = routeByIndex.get(idx) || {};
    const sourceRecord = (
      typeof source === 'object' && source ? source : { index: idx }
    ) as EnrichedEditorialSourceItem;
    const enriched: EnrichedEditorialSourceItem = {
      ...sourceRecord,
      index: idx,
      title: sourceRecord.title || String(material.title ?? base.title ?? ''),
      url: sourceRecord.url || String(material.url ?? base.url ?? ''),
      source: sourceRecord.source || String(material.source ?? base.source ?? ''),
      source_tier:
        sourceRecord.source_tier ||
        asSourceTier(material.source_tier) ||
        asSourceTier(base.source_tier),
      suggested_section: routed.suggested_section ?? sourceRecord.suggested_section
    };
    copyOptionalSourceFields(enriched, material);
    copyOptionalSourceFields(enriched, base);
    return enriched;
  };

  const topics = (plan.topics || []).map((topic) => ({
    ...topic,
    suggested_section: resolveSection(topic),
    source_items: ((topic.source_items || []) as unknown[]).map((source) =>
      enrichSource(source as EditorialSourceItem | number)
    )
  }));
  const dropped = (plan.dropped || []).map((topic) => ({
    ...topic,
    suggested_section: resolveSection(topic),
    source_items: ((topic.source_items || []) as unknown[]).map((source) =>
      enrichSource(source as EditorialSourceItem | number)
    )
  }));

  const active = topics.filter((t) => t.action === 'keep' || t.action === 'merge');
  const effectiveDropped = dropped.filter((t) => t.action === 'drop');
  const itemStats = computeEditorialItemStats(plan, active, effectiveDropped);
  const { tier3, tier5 } = countTiers(active);
  const log = {
    ...(plan.editorial_log || {}),
    received: inputByIndex.size,
    topics_kept: active.length,
    tier3_kept: tier3,
    tier5_kept: tier5,
    tier1_dropped: effectiveDropped.filter((d) => d.ai_relevance_tier === 1).length,
    clusters_formed: active.filter((t) => t.action === 'merge').length,
    items_in_topics: itemStats.itemsInTopics,
    items_dropped: itemStats.itemsDropped,
    items_merged_away: itemStats.itemsMergedAway,
    items_auto_recovered: 0
  };

  return {
    ...plan,
    topics,
    dropped,
    input_count: inputByIndex.size,
    output_topic_count: active.length,
    editorial_log: log
  };
}

function computeEditorialItemStats(
  plan: EditorialPlan,
  active: EditorialTopic[],
  dropped: EditorialTopic[]
) {
  const itemsInTopics = countTopicSourceItems(active);
  const itemsDropped = countTopicSourceItems(dropped);
  const itemsMergedAway = active
    .filter((t) => t.action === 'merge')
    .reduce((sum, t) => sum + Math.max(0, (t.source_items?.length || 1) - 1), 0);

  return { itemsInTopics, itemsDropped, itemsMergedAway };
}

function countTiers(topics: EditorialTopic[]) {
  let tier3 = 0;
  let tier5 = 0;
  for (const t of topics) {
    if (t.ai_relevance_tier === 3) tier3++;
    if (t.ai_relevance_tier === 5) tier5++;
  }
  return { tier3, tier5 };
}
