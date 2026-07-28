import {
  DAILY_REPORT_JSON_INDEX_KEY,
  DAILY_REPORT_JSON_KEY_PREFIX
} from '../../../config/businessEnums.js';
import {
  DAILY_BODY_SECTION_META,
  getDailyBodySectionMeta,
  normalizeDailySection,
  type DailyBodySectionMeta
} from '../../../config/dailySections.js';
import { parseJsonLenient } from '../../../utils/helpers.js';
import { BaseTool } from '../../base/BaseTool.js';

interface BriefItem {
  index?: number;
  topic_id?: string;
  title?: string;
  url?: string;
  section?: string;
  importance_rank?: number;
  headline_candidate?: boolean;
  source_items?: unknown[];
  body_md?: string;
  ai_score?: number;
  reason?: string;
}

interface DigestPayload {
  headlines?: Array<{ rank?: number; topicId?: string; title?: string; url?: string }>;
  metaDescription?: string;
  meta_description_hint?: string;
}

interface MetaPayload {
  yaml_block?: string;
  top_quotes_markdown?: string;
  footer_markdown?: string;
}

/** aihot 杂志体支持的来源种类。其它落到 `综合资讯` 兜底。 */
const KNOWN_SOURCE_KINDS = [
  'X·KOL',
  '官方·X',
  '官方',
  '综合资讯',
  '学术机构',
  '大咖博客',
  '开源仓库'
] as const;
type SourceKind = (typeof KNOWN_SOURCE_KINDS)[number];

interface SourceMeta {
  /** 来源种类（aihot 风格的"前缀"），例如 X·KOL / 官方·X / 综合资讯 */
  kind: SourceKind;
  /** 主体名（账号名/媒体名/博客名） */
  name: string;
  /** 社媒账号 handle（可空） */
  handle: string;
  /** 渠道形式补注（RSS / 网页 / VC 分析），可空 */
  format: string;
  /** 用于直接渲染的整行文本，例如 `X·KOL：Rohan Paul (@rohanpaul_ai)` */
  displayText: string;
  /** 是否一手来源（用于 stats.primaryReports 统计） */
  primary: boolean;
}

function parseMaybeJson<T = unknown>(value: unknown): T | undefined {
  if (value == null) return undefined;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    try {
      return parseJsonLenient<T>(trimmed);
    } catch {
      return undefined;
    }
  }
  return value as T;
}

function formatDatePart(date: string, token: string): string {
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return token;
  const [, yyyy, mm, dd] = m;
  const month = String(Number(mm));
  const day = String(Number(dd));
  return token
    .replace(/\{yyyy\}/g, yyyy)
    .replace(/\{mm\}/g, mm)
    .replace(/\{dd\}/g, dd)
    .replace(/\{m\}/g, month)
    .replace(/\{d\}/g, day)
    .replace(/\{date\}/g, date);
}

const CN_DIGITS = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const CN_WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

function toCnYear(yyyy: string): string {
  return yyyy
    .split('')
    .map((c) => CN_DIGITS[Number(c)] ?? c)
    .join('');
}

function toCnNum(n: number): string {
  if (n <= 10) return n === 10 ? '十' : CN_DIGITS[n];
  if (n < 20) return `十${CN_DIGITS[n - 10]}`;
  if (n < 100) {
    const tens = Math.floor(n / 10);
    const ones = n % 10;
    return ones === 0 ? `${CN_DIGITS[tens]}十` : `${CN_DIGITS[tens]}十${CN_DIGITS[ones]}`;
  }
  return String(n);
}

/**
 * 把 YYYY-MM-DD 转成 `二〇二六年五月二十三日 星期六`，对齐 aihot 杂志体。
 */
function toChineseDate(date: string): string {
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return date;
  const [, yyyy, mm, dd] = m;
  const weekDay = new Date(`${date}T00:00:00Z`).getUTCDay();
  return `${toCnYear(yyyy)}年${toCnNum(Number(mm))}月${toCnNum(Number(dd))}日 ${CN_WEEKDAYS[weekDay]}`;
}

function pickString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeSourceKind(kind: string | undefined): SourceKind {
  const v = (kind || '').trim();
  if ((KNOWN_SOURCE_KINDS as readonly string[]).includes(v)) return v as SourceKind;
  if (/x[·-]?kol/i.test(v)) return 'X·KOL';
  if (/官方[·-]?x/i.test(v)) return '官方·X';
  if (/官方|官网|newsroom/i.test(v)) return '官方';
  if (/学术|实验室|research|lab/i.test(v)) return '学术机构';
  if (/博客|blog|vc/i.test(v)) return '大咖博客';
  if (/github|huggingface|开源仓库/i.test(v)) return '开源仓库';
  return '综合资讯';
}

function isPrimarySource(kind: SourceKind): boolean {
  return kind === '官方·X' || kind === '官方' || kind === '学术机构' || kind === '开源仓库';
}

interface RawSourceItem {
  url?: unknown;
  source?: unknown;
  source_tier?: unknown;
  author?: unknown;
  source_meta?: {
    kind?: unknown;
    name?: unknown;
    handle?: unknown;
    format?: unknown;
  };
}

/**
 * 从一条 source_item 里推导出 aihot 风格的来源元信息。
 * 优先用 LLM 在 daily_material_brief 里写的 `source_meta`；缺失字段用启发式补齐。
 */
function buildSourceMeta(raw: RawSourceItem | unknown): SourceMeta {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as RawSourceItem;
  const meta = obj.source_meta || {};

  const sourceText = pickString(obj.source);
  const author = pickString(obj.author);
  const handleMatch = author.match(/@([\w.-]+)/) || sourceText.match(/@([\w.-]+)/);
  const handle = pickString(meta.handle) || (handleMatch ? `@${handleMatch[1]}` : '');

  let kind = normalizeSourceKind(pickString(meta.kind));
  // 没有 LLM 标记时按 source 文本做粗启发
  if (!pickString(meta.kind)) {
    if (handle) {
      kind = author && /(team|labs|ai|app|dev|官方)/i.test(author) ? '官方·X' : 'X·KOL';
    } else if (/官方|newsroom|blog|官网/i.test(sourceText)) {
      kind = '官方';
    } else if (/学术|research|university|实验室/i.test(sourceText)) {
      kind = '学术机构';
    } else if (/github\.com|huggingface\.co/i.test(pickString(obj.url))) {
      kind = '开源仓库';
    }
  }

  const name = pickString(meta.name) || author || sourceText.replace(/[（(].*?[)）]/g, '').trim();

  const format = pickString(meta.format) || (/\bRSS\b/i.test(sourceText) ? 'RSS' : '');

  const parts = [`${kind}：${name}`];
  if (handle) parts[0] += ` (${handle})`;
  if (format) parts.push(`（${format}）`);
  const displayText = parts.join('').replace(/\s+/g, ' ').trim();

  return { kind, name, handle, format, displayText, primary: isPrimarySource(kind) };
}

function normalizeItem(raw: BriefItem, fallbackIndex: number) {
  const section = normalizeDailySection(raw.section);
  const sourceList = Array.isArray(raw.source_items) ? raw.source_items : [];
  const sourceMeta = sourceList.length > 0 ? buildSourceMeta(sourceList[0]) : undefined;
  const sourceMetas = sourceList.map((s) => buildSourceMeta(s));

  return {
    topicId: raw.topic_id || `t${raw.index ?? fallbackIndex + 1}`,
    index: typeof raw.index === 'number' ? raw.index : fallbackIndex + 1,
    rank:
      typeof raw.importance_rank === 'number'
        ? raw.importance_rank
        : typeof raw.index === 'number'
          ? raw.index
          : fallbackIndex + 1,
    title: String(raw.title || '').trim(),
    url: typeof raw.url === 'string' ? raw.url : '',
    section,
    headlineCandidate: Boolean(raw.headline_candidate),
    bodyMd: typeof raw.body_md === 'string' ? raw.body_md : '',
    aiScore: typeof raw.ai_score === 'number' ? raw.ai_score : undefined,
    reason: typeof raw.reason === 'string' ? raw.reason : undefined,
    sourceItems: sourceList,
    sourceMeta,
    sourceMetas
  };
}

type NormalizedItem = ReturnType<typeof normalizeItem>;

function buildSections(items: NormalizedItem[]) {
  const buckets = new Map<string, NormalizedItem[]>(
    DAILY_BODY_SECTION_META.map((meta) => [meta.id, []] as [string, NormalizedItem[]])
  );
  for (const item of items) {
    const list = buckets.get(item.section) || buckets.get('产品与商业')!;
    list.push(item);
  }
  for (const list of buckets.values()) {
    list.sort((a, b) => a.rank - b.rank);
  }
  return DAILY_BODY_SECTION_META.map((meta, idx) => ({
    id: meta.id,
    title: meta.id,
    subtitle: meta.subtitle,
    code: meta.code,
    order: idx + 1,
    items: buckets.get(meta.id) || []
  }))
    .filter((section) => section.items.length > 0)
    .map((section, displayIdx) => ({
      ...section,
      order: displayIdx + 1
    }));
}

function buildHeadlines(
  llmHeadlines: DigestPayload['headlines'],
  items: NormalizedItem[],
  max: number
) {
  const byTopic = new Map(items.map((it) => [it.topicId, it]));
  const cap = Math.max(1, max | 0);

  const collected: NormalizedItem[] = [];
  const seen = new Set<string>();

  if (Array.isArray(llmHeadlines)) {
    for (const h of llmHeadlines) {
      const id = String(h?.topicId || '').trim();
      if (!id) continue;
      const item = byTopic.get(id);
      if (!item || seen.has(id)) continue;
      seen.add(id);
      collected.push(item);
      if (collected.length >= cap) break;
    }
  }

  if (collected.length < cap) {
    const candidates = items
      .filter((it) => !seen.has(it.topicId))
      .sort((a, b) => {
        if (a.headlineCandidate !== b.headlineCandidate) {
          return a.headlineCandidate ? -1 : 1;
        }
        return a.rank - b.rank;
      });
    for (const item of candidates) {
      seen.add(item.topicId);
      collected.push(item);
      if (collected.length >= cap) break;
    }
  }

  return collected.map((item, i) => ({
    rank: i + 1,
    topicId: item.topicId,
    title: item.title,
    url: item.url || undefined
  }));
}

interface ReportStats {
  /** 全部正文条目数 */
  totalStories: number;
  /** "一手报道"：第一手来源（官方/官方·X/学术机构/开源仓库）条数 */
  primaryReports: number;
  /** "新模型"：模型与权重栏目的条目数 */
  newModels: number;
  /** "信源"：去重信源主体数 */
  sources: number;
}

function buildStats(items: NormalizedItem[]): ReportStats {
  const totalStories = items.length;
  let primaryReports = 0;
  let newModels = 0;
  const sourceSet = new Set<string>();
  for (const it of items) {
    if (it.section === '模型与权重') newModels += 1;
    for (const sm of it.sourceMetas) {
      if (sm.primary) {
        primaryReports += 1;
        break;
      }
    }
    for (const sm of it.sourceMetas) {
      const key = `${sm.kind}|${sm.name}`.toLowerCase();
      if (key && key !== '|') sourceSet.add(key);
    }
  }
  return { totalStories, primaryReports, newModels, sources: sourceSet.size };
}

export class BuildDailyReportJsonTool extends BaseTool {
  readonly id = 'build_daily_report_json';
  readonly name = 'build_daily_report_json';
  readonly displayName = '组装日报 JSON';
  readonly scope = 'workflow' as const;
  readonly description =
    '将简报条目（brief）、摘要正文（digest）与页眉页脚元数据（meta）组装为 aihot 风格的 DailyReportJson 对象，供发布流水线使用。' +
    '必填：brief 或 items，以及 digest、meta；建议同时传 date（YYYY-MM-DD）。';
  readonly parameters = {
    type: 'object',
    properties: {
      brief: { description: 'daily_brief_batch output (object/JSON string)' },
      items: { type: 'array', description: 'Brief items (alternative to brief.items)' },
      digest: { description: 'daily_digest_body_json output (object/JSON string)' },
      meta: { description: 'daily_meta_footer output (object/JSON string)' },
      editorialPlan: { description: 'Optional editorial plan to embed in meta' },
      date: { type: 'string', description: 'Report date YYYY-MM-DD' },
      titleTemplate: { type: 'string', description: 'Example: AI资讯日报 {yyyy}/{m}/{d}' },
      linkTitleTemplate: { type: 'string', description: 'Example: {mm}-{dd} AI资讯' },
      descriptionDefault: { type: 'string' },
      headlineMaxTopics: { type: 'number', description: 'Default 5' },
      coverageNamespace: { type: 'string' },
      brandName: { type: 'string', description: '展示用品牌名，默认 AI HOT DAILY' },
      subtitle: { type: 'string', description: '副标题，默认 "DAILY · 每早八时"' },
      kvKeyPrefix: { type: 'string', description: 'KV key prefix; default daily_report_json:' },
      kvIndexKey: { type: 'string', description: 'KV index key; default daily_report_json_index' }
    }
  };

  async handler(args: {
    brief?: unknown;
    items?: BriefItem[];
    digest?: unknown;
    meta?: unknown;
    editorialPlan?: unknown;
    date?: string;
    titleTemplate?: string;
    linkTitleTemplate?: string;
    descriptionDefault?: string;
    headlineMaxTopics?: number;
    coverageNamespace?: string;
    brandName?: string;
    subtitle?: string;
    kvKeyPrefix?: string;
    kvIndexKey?: string;
  }) {
    const brief = parseMaybeJson<{ items?: BriefItem[]; count?: number }>(args.brief);
    const rawItems: BriefItem[] = Array.isArray(args.items)
      ? args.items
      : Array.isArray(brief?.items)
        ? brief.items
        : [];

    const digest = parseMaybeJson<DigestPayload>(args.digest) || {};
    const meta = parseMaybeJson<MetaPayload>(args.meta) || {};

    const items = rawItems.map((raw, i) => normalizeItem(raw, i)).filter((it) => it.title);
    const sections = buildSections(items);
    const headlines = buildHeadlines(digest.headlines, items, args.headlineMaxTopics ?? 5);
    const stats = buildStats(items);

    const date = args.date || new Date().toISOString().slice(0, 10);
    const title = formatDatePart(date, args.titleTemplate || 'AI Daily {yyyy}/{m}/{d}');
    const linkTitle = formatDatePart(date, args.linkTitleTemplate || '{mm}-{dd} AI');
    const description =
      (typeof digest.metaDescription === 'string' && digest.metaDescription.trim()) ||
      (typeof digest.meta_description_hint === 'string' && digest.meta_description_hint.trim()) ||
      args.descriptionDefault ||
      '';

    const vol = formatDatePart(date, '{yyyy}.{mm}.{dd}');
    const chineseDate = toChineseDate(date);
    const brandName = (args.brandName || 'LINKLOOM DAILY').trim();
    const subtitle = (args.subtitle || 'DAILY · 每早八时').trim();

    const sectionMeta: DailyBodySectionMeta[] = sections.map((s) => getDailyBodySectionMeta(s.id));

    const report = {
      schemaVersion: 2 as const,
      date,
      title,
      linkTitle,
      description,
      yamlBlock: typeof meta.yaml_block === 'string' ? meta.yaml_block : '',
      topQuotesMd: typeof meta.top_quotes_markdown === 'string' ? meta.top_quotes_markdown : '',
      footerMd: typeof meta.footer_markdown === 'string' ? meta.footer_markdown : '',
      vol,
      chineseDate,
      brandName,
      subtitle,
      headlines,
      sections,
      sectionMeta,
      stats,
      meta: {
        itemsTotal: items.length,
        headlinesCount: headlines.length,
        sectionsCount: sections.length,
        coverageNamespace: args.coverageNamespace || undefined,
        generatedAt: new Date().toISOString()
      },
      editorialPlan: args.editorialPlan ?? undefined
    };

    const kvKeyPrefix =
      (args.kvKeyPrefix || DAILY_REPORT_JSON_KEY_PREFIX).trim() || DAILY_REPORT_JSON_KEY_PREFIX;
    const kvKey = `${kvKeyPrefix}${date}`;
    const kvIndexKey =
      (args.kvIndexKey || DAILY_REPORT_JSON_INDEX_KEY).trim() || DAILY_REPORT_JSON_INDEX_KEY;

    return {
      success: true,
      report,
      kvKey,
      kvIndexKey,
      kvIndexValue: date,
      content: JSON.stringify(report)
    };
  }
}
