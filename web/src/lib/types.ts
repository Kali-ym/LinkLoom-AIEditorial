import type { FeedCategory } from './categories';

export interface ReportDateEntry {
  date: string;
  storyCount?: number;
}

export interface DailyIssueSummary {
  storyCount?: number;
  stats?: DailyDigestStats;
  vol?: string;
}

export type FeedSourceType = 'official' | 'kol' | 'media' | 'academic' | 'blog';
export type { FeedCategory };

export interface TimelineFeedItem {
  id: string;
  title: string;
  url?: string;
  source: string;
  sourceLabel?: string;
  /** Author / feed profile image when available (e.g. Folo feeds.image). */
  sourceImage?: string;
  sourceType?: FeedSourceType;
  publishedAt: string;
  ingestionDate?: string;
  category?: string;
  categoryId?: FeedCategory;
  permalink?: string;
  score?: number;
  picked?: boolean;
  /** Legacy topic string from API when present; prefer categoryId. */
  topic?: string;
  tags?: string[];
  summary?: string;
  summaryShort?: string;
  recommendation?: string;
  relatedIds?: string[];
}

export interface TimelineContext {
  eventId: string;
  title: string;
}

export interface TimelineResponse {
  items: TimelineFeedItem[];
  nextCursor: string | null;
  total: number;
  context?: TimelineContext | null;
}

export interface FeedTagCount {
  tag: string;
  count: number;
}

export interface HotEventMember {
  itemId: string;
  permalink: string;
  sourceLabel: string;
  role: 'primary' | 'secondary';
  title: string;
  url?: string;
  sourceImage?: string;
  summary?: string;
  publishedAt: string;
}

export interface HotEvent {
  id: string;
  title: string;
  why?: string;
  heat: number;
  sourceCount: number;
  tags?: string[];
  members: HotEventMember[];
}

export type HotBoardPeriod = 'realtime' | 'week' | 'month';

export interface HotBoards {
  realtime: HotEvent[];
  week: HotEvent[];
  month: HotEvent[];
}

/** Public reader item detail (`GET /api/feed/items/:id`). */
export interface ItemDetail {
  id: string;
  title: string;
  sourceLabel: string;
  sourceUrl?: string;
  sourceImage?: string;
  publishedAt: string;
  categoryId?: FeedCategory;
  tags?: string[];
  picked?: boolean;
  score?: number;
  summary?: string;
  recommendation?: string;
  /** Raw pipeline HTML when bodyStatus=full; UI strips tags → escaped paragraphs. */
  bodyHtml?: string | null;
  bodyStatus: 'full' | 'summary_only';
  relatedItemIds?: string[];
  permalink: string;
  sourceType?: FeedSourceType;
}

export interface DailyDigestStats {
  events: number;
  firsthand: number;
  newModels: number;
  sources: number;
}

/**
 * 由 wf_ai_daily_report_json 工作流的 build_daily_report_json 工具产出，
 * 落到 KV `daily_report_json:YYYY-MM-DD`，供前端按 aihot 杂志体直接渲染。
 */
export interface DailyReportJsonHeadline {
  rank: number;
  topicId: string;
  title: string;
  url?: string;
}

/** aihot 风格的「来源行」元信息。 */
export interface DailyReportSourceMeta {
  /** 来源种类，如 `X·KOL` / `官方·X` / `官方` / `综合资讯` / `学术机构` / `大咖博客` / `开源仓库` */
  kind: string;
  /** 主体名（账号显示名 / 媒体名 / 博客名） */
  name: string;
  /** 社媒账号 handle，例如 `@rohanpaul_ai`（可空） */
  handle: string;
  /** 渠道形式补注，如 `RSS` / `网页` / `VC 分析`（可空） */
  format: string;
  /** 直接用于渲染的整行，如 `X·KOL：Rohan Paul (@rohanpaul_ai)` */
  displayText: string;
  /** 是否一手来源（官方/学术机构/开源仓库） */
  primary: boolean;
}

export interface DailyReportJsonItem {
  topicId: string;
  index?: number;
  rank: number;
  title: string;
  url?: string;
  section: string;
  headlineCandidate?: boolean;
  bodyMd?: string;
  aiScore?: number;
  reason?: string;
  sourceItems?: unknown[];
  /** 首条来源对应的展示信息（兜底自动推导） */
  sourceMeta?: DailyReportSourceMeta;
  /** 全部来源的展示信息 */
  sourceMetas?: DailyReportSourceMeta[];
}

export interface DailyReportJsonSection {
  id: string;
  title: string;
  /** 英文副标题（Model & Weights / Agent & Tools / Train & Infra / Product & Biz / Safety & Gov / Research & Eval） */
  subtitle?: string;
  /** 路由用代码（model / product / industry / research / tips） */
  code?: string;
  /** 在最终成品里的顺序（1-based，与 sections 数组顺序保持一致） */
  order?: number;
  items: DailyReportJsonItem[];
}

export interface DailyReportJsonStats {
  /** 今日事件 = 全部正文条目数 */
  totalStories: number;
  /** 一手报道数（来源种类为官方/学术机构/开源仓库的条目） */
  primaryReports: number;
  /** 新模型数（「模型与权重」栏目条目数） */
  newModels: number;
  /** 信源数（按 kind+name 去重） */
  sources: number;
}

export interface DailyReportJson {
  schemaVersion?: number;
  date?: string;
  title?: string;
  linkTitle?: string;
  description?: string;
  yamlBlock?: string;
  topQuotesMd?: string;
  footerMd?: string;
  /** 杂志体「VOL.YYYY.MM.DD」字串中的版次部分（如 `2026.05.23`） */
  vol?: string;
  /** 中文大写日期 + 星期，例如 `二〇二六年五月二十三日 星期六` */
  chineseDate?: string;
  /** 展示用品牌名，默认 `AI HOT DAILY` */
  brandName?: string;
  /** 副标题，默认 `DAILY · 每早八时` */
  subtitle?: string;
  headlines: DailyReportJsonHeadline[];
  sections: DailyReportJsonSection[];
  /** 实际命中的栏目元数据（顺序与 sections 对齐，便于直接渲染英文副标题） */
  sectionMeta?: Array<{ id: string; subtitle: string; code: string }>;
  stats?: DailyReportJsonStats;
  meta?: {
    itemsTotal?: number;
    headlinesCount?: number;
    sectionsCount?: number;
    coverageNamespace?: string;
    generatedAt?: string;
  };
}
