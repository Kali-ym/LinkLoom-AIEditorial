import type { EditorialConfig } from '../types/config.js';
import type {
  DailyCoverageIndexRow,
  DailyCoverageTopic,
  PublicationItem,
  PublicationItemInput,
  PublicationHistoryQueryResult,
  PriorCoverageMatch,
  PriorCoveragePayload
} from '../types/dailyCoverage.js';
import type { EditorialPlan, EditorialTopic } from '../types/dailyEditorial.js';
import { normalizeUrlForDedup, titleSimilarity } from './editorialUtils.js';

export const DAILY_MEMORY_CATEGORY_ID = 'cat_daily_cross_day';
export const DAILY_MEMORY_CATEGORY_NAME = '日报跨日索引';

export function addDaysIso(dateStr: string, deltaDays: number): string {
  const d = new Date(`${dateStr}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

/** 从历史 Markdown 弱解析 URL，供 backfill 写入索引 */
export function buildCoverageRowsFromMarkdown(
  date: string,
  markdown: string,
  ingestedAt = Date.now()
): DailyCoverageIndexRow[] {
  const seen = new Set<string>();
  const rows: DailyCoverageIndexRow[] = [];
  const re = /https?:\/\/[^\s)\]"'<>]+/gi;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = re.exec(markdown)) !== null) {
    const urlNorm = normalizeUrlForDedup(match[0]);
    if (!urlNorm || seen.has(urlNorm)) continue;
    seen.add(urlNorm);
    rows.push({
      date,
      topic_id: `backfill_${i++}`,
      url_norm: urlNorm,
      headline: '',
      section: '',
      importance_rank: 999,
      ingested_at: ingestedAt
    });
  }
  return rows;
}

/** 从 JSON 版日报的 sections/headlines 构建覆盖行（含标题与栏目）。 */
export function buildCoverageRowsFromDailyReportJson(
  date: string,
  report: Record<string, unknown>,
  ingestedAt = Date.now()
): DailyCoverageIndexRow[] {
  const seen = new Set<string>();
  const rows: DailyCoverageIndexRow[] = [];

  const pushRow = (params: {
    topicId: string;
    title: string;
    url?: string;
    section?: string;
    importanceRank?: number;
  }) => {
    const urlNorm = normalizeUrlForDedup(String(params.url ?? ''));
    const dedupeKey = urlNorm || `${params.topicId}:${params.title}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    rows.push({
      date,
      topic_id: params.topicId,
      url_norm: urlNorm,
      headline: params.title,
      section: params.section || '',
      importance_rank: params.importanceRank ?? 999,
      ingested_at: ingestedAt
    });
  };

  const headlines = Array.isArray(report.headlines) ? report.headlines : [];
  for (const raw of headlines) {
    const h = raw as Record<string, unknown>;
    const title = String(h.title ?? '').trim();
    if (!title) continue;
    pushRow({
      topicId: String(h.topicId ?? h.topic_id ?? `headline_${h.rank ?? rows.length}`),
      title,
      url: String(h.url ?? ''),
      section: '今日要闻',
      importanceRank: typeof h.rank === 'number' ? h.rank : 1
    });
  }

  const sections = Array.isArray(report.sections) ? report.sections : [];
  for (const rawSection of sections) {
    const section = rawSection as Record<string, unknown>;
    const sectionTitle = String(section.title ?? section.id ?? '').trim();
    const items = Array.isArray(section.items) ? section.items : [];
    for (const rawItem of items) {
      const item = rawItem as Record<string, unknown>;
      const title = String(item.title ?? '').trim();
      if (!title) continue;
      pushRow({
        topicId: String(item.topicId ?? item.topic_id ?? `item_${rows.length}`),
        title,
        url: String(item.url ?? ''),
        section: sectionTitle || String(item.section ?? ''),
        importanceRank: typeof item.rank === 'number' ? item.rank : 999
      });
    }
  }

  return rows;
}

export function buildCoverageRowsFromPlan(
  date: string,
  plan: EditorialPlan | undefined,
  ingestedAt = Date.now()
): DailyCoverageIndexRow[] {
  if (!plan) return [];
  const rows: DailyCoverageIndexRow[] = [];
  const topics = [...(plan.topics || []), ...(plan.dropped || [])].filter(
    (t) => t.action === 'keep' || t.action === 'merge'
  );
  for (const topic of topics) {
    for (const src of topic.source_items || []) {
      const urlNorm = normalizeUrlForDedup(String(src.url ?? ''));
      if (!urlNorm) continue;
      rows.push({
        date,
        topic_id: topic.topic_id,
        url_norm: urlNorm,
        headline: topic.headline || src.title || '',
        section: topic.suggested_section || '',
        importance_rank: topic.importance_rank ?? 999,
        ingested_at: ingestedAt
      });
    }
  }
  return rows;
}

export function buildPublicationItemsFromCoverageRows(
  historyId: number,
  rows: DailyCoverageIndexRow[],
  namespace = 'default'
): PublicationItemInput[] {
  return rows.map((row) => ({
    historyId,
    date: row.date,
    topicId: row.topic_id,
    title: row.headline,
    urlNorm: row.url_norm,
    section: row.section,
    importanceRank: row.importance_rank,
    createdAt: row.ingested_at,
    metadata: { source: 'coverage_row', namespace }
  }));
}

export function buildCoverageRowsFromPublicationItems(
  items: PublicationItem[]
): DailyCoverageIndexRow[] {
  return items.map((item) => ({
    date: item.date,
    topic_id: item.topicId,
    url_norm: item.urlNorm,
    headline: item.title,
    section: item.section,
    importance_rank: item.importanceRank,
    ingested_at: item.createdAt
  }));
}

export function prependCoverageManifestToMarkdown(
  markdown: string,
  date: string,
  plan: EditorialPlan | undefined
): string {
  const topics = plan?.topics?.filter((t) => t.action === 'keep' || t.action === 'merge') ?? [];
  const manifest = {
    date,
    coverage_manifest: topics.map((t) => ({
      topic_id: t.topic_id,
      headline: t.headline,
      urls: (t.source_items || []).map((s) => s.url).filter(Boolean),
      suggested_section: t.suggested_section,
      importance_rank: t.importance_rank
    }))
  };
  const block = `<!-- coverage_manifest\n${JSON.stringify(manifest, null, 2)}\n-->\n\n`;
  if (markdown.includes('coverage_manifest')) return markdown;
  return block + markdown;
}

function indexRowsToTopics(rows: DailyCoverageIndexRow[]): DailyCoverageTopic[] {
  const byKey = new Map<string, DailyCoverageTopic>();
  for (const row of rows) {
    const key = `${row.date}:${row.topic_id}`;
    let topic = byKey.get(key);
    if (!topic) {
      topic = {
        date: row.date,
        topic_id: row.topic_id,
        headline: row.headline,
        urls: [],
        suggested_section: row.section,
        importance_rank: row.importance_rank
      };
      byKey.set(key, topic);
    }
    if (row.url_norm && !topic.urls.includes(row.url_norm)) {
      topic.urls.push(row.url_norm);
    }
  }
  return [...byKey.values()];
}

export function matchPriorCoverageFromIndex(
  items: Record<string, unknown>[],
  indexRows: DailyCoverageIndexRow[],
  options: {
    titleThreshold: number;
    asOfDate: string;
  }
): PriorCoverageMatch[] {
  const priorTopics = indexRowsToTopics(indexRows);
  const urlToPrior = new Map<string, DailyCoverageTopic>();
  for (const row of indexRows) {
    if (!row.url_norm) continue;
    if (!urlToPrior.has(row.url_norm)) {
      const t = priorTopics.find((p) => p.date === row.date && p.topic_id === row.topic_id);
      if (t) urlToPrior.set(row.url_norm, t);
    }
  }

  const matches: PriorCoverageMatch[] = [];
  for (const item of items) {
    const index = Number(item.index);
    if (!Number.isFinite(index)) continue;
    const url = String(item.url ?? '');
    const title = String(item.title ?? '');
    const norm = normalizeUrlForDedup(url);

    if (norm && urlToPrior.has(norm)) {
      const prior = urlToPrior.get(norm)!;
      matches.push({
        index,
        kind: 'url_exact',
        prior_date: prior.date,
        prior_headline: prior.headline,
        prior_topic_id: prior.topic_id,
        suggestion: 'drop',
        url: norm
      });
      continue;
    }

    let best: { prior: DailyCoverageTopic; score: number } | null = null;
    for (const prior of priorTopics) {
      if (prior.date >= options.asOfDate) continue;
      const score = titleSimilarity(title, prior.headline);
      if (score >= options.titleThreshold && (!best || score > best.score)) {
        best = { prior, score };
      }
    }
    if (best) {
      matches.push({
        index,
        kind: 'title_similar',
        prior_date: best.prior.date,
        prior_headline: best.prior.headline,
        prior_topic_id: best.prior.topic_id,
        score: best.score,
        suggestion: best.score >= 0.95 ? 'drop' : 'continuation'
      });
    }
  }
  return matches;
}

export function matchPriorCoverageFromPublicationItems(
  items: Record<string, unknown>[],
  publicationItems: PublicationItem[],
  options: {
    titleThreshold: number;
    asOfDate: string;
  }
): PriorCoverageMatch[] {
  const rows = buildCoverageRowsFromPublicationItems(publicationItems);
  const matches = matchPriorCoverageFromIndex(items, rows, options);
  return matches.map((match) => {
    const found = publicationItems.find((item) => {
      if (match.kind === 'url_exact' && match.url) {
        return item.date === match.prior_date && item.urlNorm === match.url;
      }
      return (
        item.date === match.prior_date &&
        item.topicId === match.prior_topic_id &&
        item.title === match.prior_headline
      );
    });
    return found ? { ...match, history_id: found.historyId } : match;
  });
}

export function buildPriorCoveragePayload(
  asOfDate: string,
  lookbackDays: number,
  indexRows: DailyCoverageIndexRow[],
  matches: PriorCoverageMatch[],
  extras?: { memory_summary?: string; knowledge_summary?: string }
): PriorCoveragePayload {
  const reported_urls = [...new Set(indexRows.map((r) => r.url_norm).filter(Boolean))];
  const topicCount = new Set(indexRows.map((r) => `${r.date}:${r.topic_id}`)).size;
  return {
    lookback_days: lookbackDays,
    as_of_date: asOfDate,
    reported_urls,
    matches,
    summary_markdown: `近 ${lookbackDays} 日已报 ${topicCount} 个主题、${reported_urls.length} 个 URL；本批命中 ${matches.length} 条跨日关联。`,
    memory_summary: extras?.memory_summary,
    knowledge_summary: extras?.knowledge_summary
  };
}

export function buildPublicationHistoryQueryResult(
  asOfDate: string,
  lookbackDays: number,
  items: PublicationItem[],
  matches: PriorCoverageMatch[]
): PublicationHistoryQueryResult {
  const reportedUrls = [...new Set(items.map((item) => item.urlNorm).filter(Boolean))];
  const topicCount = new Set(items.map((item) => `${item.date}:${item.topicId}`)).size;
  return {
    lookbackDays,
    asOfDate,
    reportedUrls,
    matches,
    summary: `近 ${lookbackDays} 日已发布 ${topicCount} 个主题、${reportedUrls.length} 个 URL；本批命中 ${matches.length} 条历史关联。`
  };
}

export function applyCrossDayHints(
  plan: EditorialPlan,
  prior: PriorCoveragePayload,
  hardDrop: boolean
): EditorialPlan {
  const dropByIndex = new Map<number, PriorCoverageMatch>();
  const continuationByIndex = new Map<number, PriorCoverageMatch>();
  for (const m of prior.matches) {
    if (
      m.suggestion === 'drop' &&
      (m.kind === 'url_exact' || (hardDrop && m.kind === 'title_similar'))
    ) {
      dropByIndex.set(m.index, m);
    } else if (m.suggestion === 'continuation') {
      continuationByIndex.set(m.index, m);
    }
  }

  let crossDayDropped = 0;
  let crossDayContinuation = 0;
  const topics: EditorialTopic[] = [];
  const dropped: EditorialTopic[] = [...(plan.dropped || [])];

  for (const topic of plan.topics || []) {
    const srcs = topic.source_items || [];
    const shouldDrop = hardDrop && srcs.some((s) => dropByIndex.has(s.index));
    if (shouldDrop) {
      const hit = dropByIndex.get(srcs.find((s) => dropByIndex.has(s.index))!.index)!;
      dropped.push({
        ...topic,
        action: 'drop',
        drop_reason: `跨日已报 ${hit.prior_date}：${hit.prior_headline}`
      });
      crossDayDropped++;
      continue;
    }
    const cont = srcs.find((s) => continuationByIndex.has(s.index));
    if (cont) {
      const hit = continuationByIndex.get(cont.index)!;
      topic.editorial_note = `${topic.editorial_note || ''} [续报 ${hit.prior_date}]`.trim();
      crossDayContinuation++;
    }
    topics.push(topic);
  }

  const log = {
    ...plan.editorial_log,
    cross_day_dropped: crossDayDropped,
    cross_day_continuation: crossDayContinuation
  };

  return {
    ...plan,
    topics,
    dropped,
    output_topic_count: topics.length,
    editorial_log: log
  };
}

export function getEditorialCrossDayConfig(ec: EditorialConfig | undefined) {
  const base = ec || ({} as EditorialConfig);
  return {
    lookbackDays: base.crossDayLookbackDays ?? 7,
    urlHardDrop: base.crossDayUrlHardDrop !== false,
    titleThreshold: base.crossDayTitleSimilarityThreshold ?? base.titleDedupThreshold ?? 0.88,
    ingestMemory: base.ingestToMemoryOnPublish !== false,
    ingestKnowledge: base.ingestToKnowledgeOnPublish !== false,
    knowledgeCategoryName: base.knowledgeCategoryName || 'AI资讯日报',
    memoryCategoryName: base.memoryCategoryName || DAILY_MEMORY_CATEGORY_NAME,
    knowledgeCategoryId: base.knowledgeCategoryId,
    memoryCategoryId: base.memoryCategoryId || DAILY_MEMORY_CATEGORY_ID
  };
}
