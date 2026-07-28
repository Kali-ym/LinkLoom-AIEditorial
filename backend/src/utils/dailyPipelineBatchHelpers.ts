import { DAILY_BODY_SECTIONS, normalizeDailySection } from '../config/dailySections.js';
import { normalizeUrlForDedup, titleSimilarity } from './editorialUtils.js';

const MAX_DESCRIPTION_CHARS = 480;

export function slimDailyPipelineItem(raw: Record<string, unknown>): Record<string, unknown> {
  const meta = (raw.metadata && typeof raw.metadata === 'object' ? raw.metadata : {}) as Record<
    string,
    unknown
  >;
  const { content_html: _html, ...metaRest } = meta;
  let desc = String(raw.description ?? '');
  if (desc.length > MAX_DESCRIPTION_CHARS) {
    desc = desc.slice(0, MAX_DESCRIPTION_CHARS) + '…';
  }

  const slim: Record<string, unknown> = {
    index: raw.index ?? raw.selectedOrder,
    selectedOrder: raw.selectedOrder ?? raw.index ?? 9999,
    title: raw.title ?? '',
    url: raw.url ?? '',
    description: desc,
    published_date: raw.published_date,
    source: raw.source,
    category: raw.category,
    author: raw.author,
    ingestion_date: raw.ingestion_date,
    suggested_section: raw.suggested_section,
    section: raw.section,
    body_md: raw.body_md,
    ai_score: raw.ai_score,
    reason: raw.reason,
    content_excerpt: raw.content_excerpt,
    source_tier: raw.source_tier,
    topic_id: raw.topic_id,
    headline: raw.headline,
    importance_rank: raw.importance_rank,
    source_items: raw.source_items,
    editorial_note: raw.editorial_note,
    headline_candidate: raw.headline_candidate
  };

  const summary = metaRest.ai_summary;
  if (typeof summary === 'string' && summary.trim()) {
    slim.metadata = { ai_summary: summary.slice(0, 300) };
  }

  return slim;
}

function guessSectionFromItem(item: Record<string, unknown>): string {
  const hay =
    `${item.title ?? ''} ${item.description ?? ''} ${item.source ?? ''} ${item.category ?? ''} ${item.ai_category ?? ''}`.toLowerCase();
  if (/(论文|arxiv|benchmark|评测|研究|research|paper|学术|实验室|sft|rlhf)/.test(hay))
    return '研究与评测';
  if (/(安全|对齐|监管|政策|版权|治理|safety|alignment|regulation)/.test(hay)) return '安全与治理';
  if (
    /(模型|model|llm|大模型|开源模型|新模型|权重|weights|gpt|gemini|claude|llama|deepseek|qwen|mistral|moe)/.test(
      hay
    )
  )
    return '模型与权重';
  if (/(agent|mcp|工具调用|工作流|编码代理|copilot|cursor|ide 插件)/.test(hay))
    return 'Agent 与工具';
  if (/(芯片|nvidia|算力|训练|serving|infra|数据中心|gpu|tpu|成本优化)/.test(hay))
    return '训推与基建';
  if (/(融资|并购|营收|招聘|裁员|估值|商业化|app|产品|api|sdk)/.test(hay)) return '产品与商业';
  return '产品与商业';
}

/** 模型漏条时：用输入素材程序兜底单条路由结果 */
export function buildFallbackRoutedItem(
  raw: Record<string, unknown>,
  batchIndex: number
): Record<string, unknown> {
  const slim = slimDailyPipelineItem(raw);
  return {
    ...slim,
    index: batchIndex,
    suggested_section: normalizeDailySection(
      String(slim.suggested_section ?? guessSectionFromItem(slim))
    ),
    content_excerpt: String(slim.content_excerpt ?? '').slice(0, 200)
  };
}

function findInputSlotForRoutedOutput(
  out: Record<string, unknown>,
  batchInput: Record<string, unknown>[],
  used: Set<number>
): number {
  const normUrl = normalizeUrlForDedup(String(out.url ?? ''));
  if (normUrl) {
    const idx = batchInput.findIndex(
      (item, i) => !used.has(i) && normalizeUrlForDedup(String(item.url ?? '')) === normUrl
    );
    if (idx >= 0) return idx;
  }
  const title = String(out.title ?? '').trim();
  if (title) {
    let bestIdx = -1;
    let bestSim = 0;
    for (let i = 0; i < batchInput.length; i++) {
      if (used.has(i)) continue;
      const sim = titleSimilarity(String(batchInput[i].title ?? ''), title);
      if (sim > bestSim) {
        bestSim = sim;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0 && bestSim >= 0.75) return bestIdx;
  }
  const idx = Number(out.index);
  if (Number.isFinite(idx) && idx >= 1 && idx <= batchInput.length) {
    const slot = idx - 1;
    if (!used.has(slot)) return slot;
  }
  return -1;
}

function mergeRoutedItem(
  input: Record<string, unknown>,
  fromModel: Record<string, unknown>,
  batchIndex: number
): Record<string, unknown> {
  const base = buildFallbackRoutedItem(input, batchIndex);
  return {
    ...base,
    ...fromModel,
    index: batchIndex,
    title: String(fromModel.title ?? base.title ?? ''),
    url: String(fromModel.url ?? base.url ?? ''),
    description: String(fromModel.description ?? base.description ?? ''),
    source: fromModel.source ?? base.source,
    category: fromModel.category ?? base.category,
    author: fromModel.author ?? base.author,
    ingestion_date: fromModel.ingestion_date ?? base.ingestion_date,
    suggested_section: normalizeDailySection(
      String(fromModel.suggested_section ?? base.suggested_section ?? '')
    ),
    content_excerpt: String(fromModel.content_excerpt ?? '').slice(0, 200)
  };
}

/** 将模型返回条数与批次输入对齐（允许少返/多返，保证输出长度 = 输入批大小） */
export function reconcileRoutedBatchItems(
  batchInput: Record<string, unknown>[],
  returned: Record<string, unknown>[]
): Record<string, unknown>[] {
  const used = new Set<number>();
  const result: (Record<string, unknown> | undefined)[] = new Array(batchInput.length);
  for (const out of returned) {
    const slot = findInputSlotForRoutedOutput(out, batchInput, used);
    if (slot < 0) continue;
    used.add(slot);
    result[slot] = mergeRoutedItem(batchInput[slot], out, slot + 1);
  }
  for (let i = 0; i < batchInput.length; i++) {
    if (!result[i]) {
      result[i] = buildFallbackRoutedItem(batchInput[i], i + 1);
    }
  }
  return result as Record<string, unknown>[];
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\[[^\]]+\]\([^)]+\)/g, (match) => match.replace(/\[|\]\([^)]+\)/g, ''))
    .replace(/[*_`>#-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function headlineTitleFromBlock(block: string): string {
  const firstLine = block.split(/\r?\n/).find((line) => line.trim()) || '';
  const withoutNumber = firstLine.replace(/^\s*\d+[.)、]\s+/, '').trim();
  const title = withoutNumber.match(/^\*\*(.+?)\*\*/)?.[1]?.trim();
  if (title) return `**${title}**`;
  return withoutNumber || firstLine.trim();
}

function buildFallbackTitle(item: Record<string, unknown>, index: number): string {
  const title = String(item.title ?? '').trim();
  if (title) return title;
  const body = stripMarkdown(String(item.body_md ?? ''));
  const firstSentence = body
    .split(/[。！？!?]/)
    .find(Boolean)
    ?.trim();
  return firstSentence ? firstSentence.slice(0, 28) : `第 ${index} 条资讯`;
}

function appendUrlToBody(body: string, url: string): string {
  if (!url || !/^https?:\/\//i.test(url)) return body;
  let out = body;
  if (!out.includes(url)) {
    const anchor = `[阅读原文(AI资讯)](${url})`;
    out = out ? `${out}\n\n${anchor}` : anchor;
  }
  const sourceLine = `来源：[${url}](${url})`;
  if (!out.includes(sourceLine) && !out.includes(`来源：${url}`) && !out.includes(`来源: ${url}`)) {
    out = `${out}\n\n${sourceLine}`;
  }
  return out;
}

function formatItemBodyWithUrl(item: Record<string, unknown>): string {
  const url = String(item.url ?? '').trim();
  const body = String(item.body_md ?? '').trim() || stripMarkdown(String(item.description ?? ''));
  return appendUrlToBody(body, url);
}

function formatTopicBodyWithUrls(item: Record<string, unknown>): string {
  let body = String(item.body_md ?? '').trim() || stripMarkdown(String(item.description ?? ''));
  const sources = Array.isArray(item.source_items)
    ? (item.source_items as Record<string, unknown>[])
    : [];
  if (sources.length === 0) {
    return formatItemBodyWithUrl(item);
  }
  for (const src of sources) {
    body = appendUrlToBody(body, String(src.url ?? '').trim());
  }
  return body;
}

function sortByImportanceRank(items: Record<string, unknown>[]): Record<string, unknown>[] {
  return [...items].sort((a, b) => {
    const ra = Number(a.importance_rank ?? a.index ?? 9999);
    const rb = Number(b.importance_rank ?? b.index ?? 9999);
    return ra - rb;
  });
}

export function clampHeadlinesMarkdown(markdown: string, headlineMax = 5): string {
  const max = Math.min(10, Math.max(1, Math.floor(headlineMax)));
  const text = String(markdown ?? '').trim();
  const body = text.replace(/^##\s*(?:\*\*)?今日要闻(?:\*\*)?\s*/u, '').trim();

  if (!body) return '## **今日要闻**\n\n*（今日暂无要闻）*';

  const blocks: string[] = [];
  const leadLines: string[] = [];
  let current: string[] = [];

  const flush = () => {
    const block = current.join('\n').trim();
    current = [];
    if (block) blocks.push(block);
  };

  for (const line of body.split(/\r?\n/)) {
    if (/^\s*\d+[.)、]\s+/.test(line)) {
      flush();
      current = [line];
      continue;
    }
    if (current.length > 0) {
      current.push(line);
    } else if (line.trim()) {
      leadLines.push(line);
    }
  }
  flush();

  if (blocks.length === 0) {
    const fallbackTitle = leadLines.find((line) => line.trim());
    return `## **今日要闻**\n\n${fallbackTitle ? `1. ${fallbackTitle.trim()}` : '*（今日暂无要闻）*'}`;
  }

  const limited = blocks
    .slice(0, max)
    .map((block, idx) => `${idx + 1}. ${headlineTitleFromBlock(block)}`);
  return `## **今日要闻**\n\n${limited.join('\n\n')}`;
}

export function buildDeterministicDigest(
  payload: { count: number; items: Record<string, unknown>[] },
  headlineMax = 5
): {
  headlines_markdown: string;
  body_markdown: string;
  meta_description_hint: string;
} {
  const sorted = sortByImportanceRank(payload.items);
  const headlineItems = sorted
    .filter((item) => item.headline_candidate === true)
    .slice(0, headlineMax);
  const headlineList =
    headlineItems.length > 0
      ? headlineItems
      : sorted.slice(0, Math.min(headlineMax, sorted.length));

  const grouped = new Map<string, Record<string, unknown>[]>(
    DAILY_BODY_SECTIONS.map((section) => [section, []])
  );
  for (const item of sorted) {
    const section = normalizeDailySection(
      String(item.section ?? item.suggested_section ?? '').trim()
    );
    grouped.get(section)!.push(item);
  }

  const headlineLines = headlineList.map((item, idx) => {
    const title = buildFallbackTitle(item, Number(item.importance_rank ?? item.index ?? idx + 1));
    return `${idx + 1}. **${title}**`;
  });
  const headlines_markdown =
    headlineLines.length > 0
      ? `## **今日要闻**\n\n${headlineLines.join('\n\n')}`
      : '## **今日要闻**\n\n*（今日暂无要闻）*';

  const body_markdown = DAILY_BODY_SECTIONS.map((section) => {
    const sectionItems = sortByImportanceRank(grouped.get(section) || []);
    if (sectionItems.length === 0) {
      return `### ${section}\n\n*（今日无条目）*`;
    }
    const blocks = sectionItems.map((item, idx) => {
      const title = buildFallbackTitle(item, Number(item.importance_rank ?? item.index ?? idx + 1));
      const body = formatTopicBodyWithUrls(item);
      return `${idx + 1}. **${title}**\n${body}`;
    });
    return `### ${section}\n\n${blocks.join('\n\n')}`;
  }).join('\n\n');

  const hintSource = sorted
    .map((item) => stripMarkdown(String(item.body_md ?? item.description ?? '')))
    .filter(Boolean)
    .join(' ');

  return {
    headlines_markdown: clampHeadlinesMarkdown(headlines_markdown, headlineMax),
    body_markdown,
    meta_description_hint: hintSource.slice(0, 120)
  };
}
