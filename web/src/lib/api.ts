import type {
  DailyReportJson,
  FeedTagCount,
  HotBoardPeriod,
  HotBoards,
  HotEvent,
  ItemDetail,
  ReportDateEntry,
  TimelineResponse
} from './types';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  (typeof window !== 'undefined'
    ? ''
    : process.env.BACKEND_INTERNAL_URL || 'http://127.0.0.1:3000');

const IS_SERVER = typeof window === 'undefined';

interface FetchOpts extends RequestInit {
  next?: NextFetchRequestConfig;
}

const apiUrl = (path: string) => `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;

/**
 * 仅在服务端记录 API 失败（生产/开发均写入 Next 进程日志，便于运维采集）。
 * 浏览器端静默，避免污染访客控制台。
 */
function logApiFailure(message: string) {
  if (!IS_SERVER || process.env.NODE_ENV === 'test') return;
  console.warn(message);
}

async function get<T>(path: string, opts: FetchOpts = {}): Promise<T | null> {
  try {
    const res = await fetch(apiUrl(path), {
      ...opts,
      headers: { accept: 'application/json', ...(opts.headers || {}) }
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      logApiFailure(`[api] ${res.status} ${path}: ${text}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err: any) {
    logApiFailure(`[api] fetch failed ${path}: ${err?.message || err}`);
    return null;
  }
}

export async function fetchTimeline(
  params: {
    cursor?: string | number;
    limit?: number;
    picked?: boolean;
    topic?: string;
    category?: string;
    includeTags?: string[];
    excludeTags?: string[];
    sourceType?: string;
    minScore?: number;
    search?: string;
    event?: string;
  } = {}
): Promise<TimelineResponse> {
  const q = new URLSearchParams();
  if (params.cursor !== undefined) q.set('cursor', String(params.cursor));
  if (params.limit) q.set('limit', String(params.limit));
  if (params.picked) q.set('picked', '1');
  if (params.topic) q.set('topic', params.topic);
  if (params.category) q.set('category', params.category);
  if (params.includeTags?.length) q.set('includeTags', params.includeTags.join(','));
  if (params.excludeTags?.length) q.set('excludeTags', params.excludeTags.join(','));
  if (params.sourceType) q.set('sourceType', params.sourceType);
  if (params.minScore !== undefined) q.set('minScore', String(params.minScore));
  if (params.search && params.search.trim()) q.set('search', params.search.trim());
  if (params.event && params.event.trim()) q.set('event', params.event.trim());
  const qs = q.toString();
  const res = await get<TimelineResponse>(`/api/feed/timeline${qs ? `?${qs}` : ''}`, {
    next: { revalidate: 60 }
  });
  return res || { items: [], nextCursor: null, total: 0 };
}

export async function fetchHotEvents(): Promise<{
  events: HotEvent[];
  boards: HotBoards;
  period: HotBoardPeriod;
  generatedAt: string;
}> {
  const res = await get<{
    events: HotEvent[];
    boards?: HotBoards;
    period?: HotBoardPeriod;
    generatedAt: string;
  }>('/api/feed/hot', {
    next: { revalidate: 60 }
  });
  const events = res?.events ?? [];
  const boards: HotBoards = res?.boards ?? {
    realtime: events,
    week: [],
    month: []
  };
  return {
    events: res?.events ?? boards.realtime,
    boards,
    period: res?.period ?? 'realtime',
    generatedAt: res?.generatedAt ?? new Date().toISOString()
  };
}

/** Distinct tags from recent scored items (include/exclude pickers). */
export async function fetchFeedTags(
  params: { limit?: number } = {}
): Promise<{ tags: FeedTagCount[]; generatedAt: string }> {
  const q = new URLSearchParams();
  if (params.limit) q.set('limit', String(params.limit));
  const qs = q.toString();
  const res = await get<{ tags: FeedTagCount[]; generatedAt: string }>(
    `/api/feed/tags${qs ? `?${qs}` : ''}`,
    { next: { revalidate: 60 } }
  );
  return res || { tags: [], generatedAt: new Date().toISOString() };
}

/** Item detail; 404 → null. */
export async function fetchItemDetail(id: string): Promise<ItemDetail | null> {
  if (!id || !id.trim()) return null;
  return get<ItemDetail>(`/api/feed/items/${encodeURIComponent(id.trim())}`, {
    next: { revalidate: 60 }
  });
}

/** 获取 JSON 版日报（wf_ai_daily_report_json 工作流落到 KV 的结构化 report）。 */
export async function fetchReportJson(date?: string): Promise<DailyReportJson | null> {
  const q = new URLSearchParams();
  if (date) q.set('date', date);
  const qs = q.toString();
  const res = await get<{ date: string; report: DailyReportJson | null }>(
    `/api/feed/report-json${qs ? `?${qs}` : ''}`,
    { cache: 'no-store' }
  );
  if (!res || !res.report) return null;
  const report = res.report;
  if (!Array.isArray(report.sections) || report.sections.length === 0) return null;
  return report;
}

/** JSON 版日报的可用日期列表（含每期的 storyCount）。 */
export async function fetchReportJsonDates(): Promise<ReportDateEntry[]> {
  const res = await get<{ dates: ReportDateEntry[] }>('/api/feed/report-json/dates', {
    cache: 'no-store'
  });
  return res?.dates || [];
}
