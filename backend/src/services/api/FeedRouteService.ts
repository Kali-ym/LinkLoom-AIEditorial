import {
  DAILY_REPORT_JSON_INDEX_KEY,
  DAILY_REPORT_JSON_KEY_PREFIX
} from '../../config/businessEnums.js';
import { mapLegacyTopicToCategory } from '../../config/feedCategories.js';
import type {
  FeedAdminStats,
  FeedSourceType,
  FeedTopic,
  HotBoardPeriod,
  HotBoards,
  HotEvent,
  ItemDetail,
  TimelineContext,
  TimelineFeedItem,
  TimelineResponse
} from '../../types/feed.js';
import type { UnifiedData } from '../../types/index.js';
import { getISODate } from '../../utils/helpers.js';
import {
  parseShanghaiLocalDateTimeInput,
  startOfShanghaiCalendarMonth,
  startOfShanghaiCalendarWeek
} from '../../utils/shanghaiDate.js';
import type { LocalStore } from '../LocalStore.js';
import type { ServiceContext } from '../ServiceContext.js';
import { buildHotBoards } from '../feed/hotEvents.js';
import { HotStoryMergeService } from '../feed/HotStoryMergeService.js';
import {
  hotBoardsNeedLivePeriodFill,
  normalizeHotPeriod
} from '../feed/hotSnapshotPayload.js';
import { loadEventClusterPool } from '../feed/loadHotWindowItems.js';
import { resolveHotEventFilter } from '../feed/resolveHotEventFilter.js';
import { matchTags, parseCommaList } from '../feed/timelineFilters.js';
import { aggregateFeedTags } from '../feed/aggregateFeedTags.js';
import {
  applySourceImagesToHotEvents,
  readSourceImage
} from '../../utils/sourceImage.js';

export class FeedRouteService {
  constructor(
    private store: LocalStore,
    private context: ServiceContext
  ) {}

  async getTimeline(query: {
    cursor?: string;
    limit?: string | number;
    picked?: string | boolean;
    sourceType?: string;
    topic?: string;
    category?: string;
    includeTags?: string;
    excludeTags?: string;
    minScore?: string | number;
    search?: string;
    event?: string;
  }): Promise<TimelineResponse> {
    const limit = Math.min(50, Math.max(5, Number(query.limit) || 20));
    const offset = Math.max(0, Number(query.cursor) || 0);
    const onlyPicked = query.picked === '1' || query.picked === 'true' || query.picked === true;
    const sourceType =
      typeof query.sourceType === 'string' && query.sourceType.length > 0
        ? (query.sourceType.split(',') as FeedSourceType[])
        : undefined;
    const topic =
      typeof query.topic === 'string' && query.topic.length > 0
        ? (query.topic as FeedTopic)
        : undefined;
    const minScore = query.minScore ? Number(query.minScore) : undefined;
    const search =
      typeof query.search === 'string' && query.search.trim().length > 0
        ? query.search.trim()
        : undefined;
    const eventId =
      typeof query.event === 'string' && query.event.trim().length > 0
        ? query.event.trim()
        : undefined;

    let eventContext: TimelineContext | null | undefined;
    let eventMemberIds: Set<string> | null = null;
    let eventSignature: string | null = null;
    if (eventId) {
      const { events } = await this.getHot();
      const resolved = resolveHotEventFilter(events, eventId);
      if (!resolved) {
        return { items: [], nextCursor: null, total: 0, context: null };
      }
      eventContext = { eventId: resolved.eventId, title: resolved.title };
      eventMemberIds = resolved.memberIds;
      eventSignature = resolved.signature;
    }

    const hasCategoryParam =
      typeof query.category === 'string' && query.category.trim().length > 0;
    const includeTagList = parseCommaList(
      typeof query.includeTags === 'string' ? query.includeTags : undefined
    );
    const excludeTagList = parseCommaList(
      typeof query.excludeTags === 'string' ? query.excludeTags : undefined
    );
    // Post-filter when new params are present. Legacy `topic`-only keeps the store aiTopic path.
    const needsPostFilter =
      hasCategoryParam ||
      Boolean(includeTagList) ||
      Boolean(excludeTagList) ||
      Boolean(eventId);
    const categoryFilter = hasCategoryParam
      ? mapLegacyTopicToCategory(query.category!.trim())
      : topic
        ? mapLegacyTopicToCategory(topic)
        : undefined;

    const fetchLimit = needsPostFilter ? Math.min(500, offset + limit * 8) : limit;
    const fetchOffset = needsPostFilter ? 0 : offset;

    const { items, total } = await this.store.listSourceData({
      hasAiScored: true,
      aiPicked: onlyPicked ? true : undefined,
      aiSourceTypes: sourceType,
      // Store still indexes legacy ai_topic; omit when post-filtering six-lane category/tags.
      aiTopic: needsPostFilter ? undefined : topic,
      minScore,
      search,
      limit: fetchLimit,
      offset: fetchOffset,
      orderByPublishedDesc: true
    });

    let sourceItems = items;
    if (eventMemberIds) {
      sourceItems = items.filter((it) => {
        if (eventMemberIds!.has(it.id)) return true;
        if (eventId && it.metadata?.event_id === eventId) return true;
        if (eventSignature) {
          const raw = it.metadata?.event_signature;
          const sig = typeof raw === 'string' ? raw.trim() : '';
          if (sig.length > 0 && sig === eventSignature) return true;
          const norm = it.metadata?.event_signature_norm;
          return typeof norm === 'string' && norm === eventSignature;
        }
        return false;
      });
    }

    let mapped = sourceItems.map((it) => this.toTimelineFeedItem(it));

    if (needsPostFilter) {
      mapped = mapped.filter((item) => {
        if (categoryFilter && item.categoryId !== categoryFilter) return false;
        return matchTags(item.tags, includeTagList, excludeTagList);
      });
      const page = mapped.slice(offset, offset + limit);
      // total/nextCursor are approximate: only items within the fetched window.
      const nextCursor = mapped.length > offset + limit ? String(offset + limit) : null;
      return {
        items: page,
        nextCursor,
        total: mapped.length,
        ...(eventId ? { context: eventContext ?? null } : {})
      };
    }

    const nextCursor = total > offset + limit ? String(offset + limit) : null;

    return {
      items: mapped,
      nextCursor,
      total
    };
  }

  /** Distinct `ai_tags` from recent scored items (for feed include/exclude pickers). */
  async getTags(query?: { limit?: string | number }): Promise<{
    tags: Array<{ tag: string; count: number }>;
    generatedAt: string;
  }> {
    const limit = Math.min(300, Math.max(10, Number(query?.limit) || 200));
    const { items } = await this.store.listSourceData({
      hasAiScored: true,
      limit: 800,
      offset: 0,
      orderByPublishedDesc: true
    });
    return {
      tags: aggregateFeedTags(items, { limit }),
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * 读取 JSON 版日报（由 wf_ai_daily_report_json 工作流落地的结构化 report）。
   * 返回 { date, report }；找不到时返回 null 让上层决定占位响应。
   */
  async getReportJson(query: { date?: string }): Promise<{ date: string; report: unknown } | null> {
    const date = query.date && /^\d{4}-\d{2}-\d{2}$/.test(query.date) ? query.date : getISODate();
    const report = await this.store.get(`${DAILY_REPORT_JSON_KEY_PREFIX}${date}`);
    if (!report) return null;
    return { date, report };
  }

  /** JSON 版日报的可用日期列表（由 kv-write 维护的 daily_report_json_index）。
   *  返回 Array\<{ date: string; storyCount?: number }\>。 */
  async getReportJsonDates(): Promise<Array<{ date: string; storyCount?: number }>> {
    const index = (await this.store.get(DAILY_REPORT_JSON_INDEX_KEY)) as
      | Array<string | { date: string; storyCount?: number }>
      | undefined;
    if (!Array.isArray(index)) return [];
    return index.map((v) =>
      typeof v === 'string'
        ? { date: v }
        : { date: (v as any).date, storyCount: (v as any).storyCount }
    );
  }

  async getHot(query?: {
    period?: string;
  }): Promise<{
    events: HotEvent[];
    boards: HotBoards;
    period: HotBoardPeriod;
    generatedAt: string;
  }> {
    const period = normalizeHotPeriod(query?.period);
    try {
      const snap = await this.store.loadLatestHotEventSnapshot();
      if (snap?.boards || snap?.events) {
        let boards = await this.hydrateHotBoards(
          snap.boards ?? { realtime: snap.events, week: [], month: [] }
        );
        if (hotBoardsNeedLivePeriodFill(boards, snap.schemaVersion ?? 0)) {
          const live = await this.buildHotLive();
          boards = {
            realtime: boards.realtime.length ? boards.realtime : live.boards.realtime,
            week: live.boards.week,
            month: live.boards.month
          };
        }
        return {
          events: boards[period],
          boards,
          period,
          generatedAt: snap.generatedAt
        };
      }
    } catch {
      // fall through to live build
    }
    const live = await this.buildHotLive();
    return {
      events: live.boards[period],
      boards: live.boards,
      period,
      generatedAt: live.generatedAt
    };
  }

  private async hydrateHotBoards(boards: HotBoards): Promise<HotBoards> {
    const [realtime, week, month] = await Promise.all([
      this.hydrateHotSourceImages(boards.realtime),
      this.hydrateHotSourceImages(boards.week),
      this.hydrateHotSourceImages(boards.month)
    ]);
    return { realtime, week, month };
  }

  /** Stale snapshots may predate source_image backfill — fill from source_data. */
  private async hydrateHotSourceImages(events: HotEvent[]): Promise<HotEvent[]> {
    const missing = new Set<string>();
    for (const ev of events) {
      for (const m of ev.members || []) {
        if (!m.sourceImage && m.itemId) missing.add(m.itemId);
      }
    }
    if (missing.size === 0) return events;

    const pairs = await Promise.all(
      [...missing].map(async (id) => {
        const item = await this.store.getSourceData(id);
        const img = readSourceImage(item?.metadata as Record<string, unknown> | undefined);
        return img ? ([id, img] as const) : null;
      })
    );
    const images = new Map(pairs.filter((p): p is readonly [string, string] => Boolean(p)));
    return applySourceImagesToHotEvents(events, images);
  }

  async rebuildHotSnapshot(body?: {
    mergeMode?: 'rules' | 'semantic' | 'hybrid';
    embeddingServiceId?: string;
    similarityMin?: number;
  }): Promise<{
    eventCount: number;
    generatedAt: string;
    itemCount: number;
    clusterCount: number;
    mergeModeRequested: string;
    mergeModeApplied: string;
    fallbackReason?: string;
  }> {
    const service = new HotStoryMergeService(this.store);
    return service.runMergeAndSnapshot(new Date(), body);
  }

  private async buildHotLive(): Promise<{
    events: HotEvent[];
    boards: HotBoards;
    generatedAt: string;
  }> {
    const now = new Date();
    const from = new Date(now.getTime() - 36 * 3600 * 1000).toISOString();
    let items: UnifiedData[] = [];
    try {
      const listed = await this.store.listSourceData({
        hasAiScored: true,
        publishedFrom: from,
        limit: 500,
        orderByPublishedDesc: true
      });
      items = listed.items;
    } catch {
      items = [];
    }

    // Fallback when publishedFrom filtering is empty/unreliable (e.g. sparse publish dates).
    if (items.length === 0) {
      const today = getISODate();
      const yesterday = this.shiftDate(today, -1);
      const dayBefore = this.shiftDate(today, -2);
      const [{ items: t }, { items: y }, { items: d }] = await Promise.all([
        this.store.listSourceData({
          ingestionDate: today,
          hasAiScored: true,
          limit: 500,
          orderByPublishedDesc: true
        }),
        this.store.listSourceData({
          ingestionDate: yesterday,
          hasAiScored: true,
          limit: 500,
          orderByPublishedDesc: true
        }),
        this.store.listSourceData({
          ingestionDate: dayBefore,
          hasAiScored: true,
          limit: 500,
          orderByPublishedDesc: true
        })
      ]);
      const seen = new Set<string>();
      items = [...t, ...y, ...d].filter((it) => {
        if (seen.has(it.id)) return false;
        seen.add(it.id);
        return true;
      });
    }

    const weekStart = startOfShanghaiCalendarWeek(now);
    const monthStart = startOfShanghaiCalendarMonth(now);
    const realtimeFrom = new Date(now.getTime() - 36 * 3600 * 1000);

    const [realtimeExpanded, weekPool, monthPool] = await Promise.all([
      loadEventClusterPool(this.store, realtimeFrom, 1000, 3000),
      loadEventClusterPool(this.store, weekStart, 2000, 5000),
      loadEventClusterPool(this.store, monthStart, 3000, 8000)
    ]);
    const unsigned = items.filter((it) => {
      const eid = it.metadata?.event_id;
      return !(typeof eid === 'string' && eid.startsWith('evt_'));
    });
    const byId = new Map<string, UnifiedData>();
    for (const it of [...realtimeExpanded, ...unsigned]) {
      if (it?.id) byId.set(it.id, it);
    }
    const boards = buildHotBoards(
      { realtime: [...byId.values()], week: weekPool, month: monthPool },
      now,
      { weekStart, monthStart }
    );
    return {
      events: boards.realtime,
      boards,
      generatedAt: now.toISOString()
    };
  }

  async getRss() {
    const today = getISODate();
    const yesterday = this.shiftDate(today, -1);
    const [{ items: a }, { items: b }] = await Promise.all([
      this.store.listSourceData({ ingestionDate: today, limit: 200 }),
      this.store.listSourceData({ ingestionDate: yesterday, limit: 200 })
    ]);
    const merged = [...a, ...b]
      .filter((it) => it.metadata?.ai_picked === true)
      .sort((a, b) => (b.published_date || '').localeCompare(a.published_date || ''))
      .slice(0, 50);

    const baseUrl = process.env.SITE_BASE_URL || '';
    const escape = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const items = merged
      .map(
        (it) => `
      <item>
        <title>${escape(it.metadata?.ai_summary_short || it.title)}</title>
        <link>${escape(it.url || '')}</link>
        <guid isPermaLink="false">${escape(it.id)}</guid>
        <pubDate>${new Date(it.published_date).toUTCString()}</pubDate>
        <description><![CDATA[${it.metadata?.ai_summary || it.description}]]></description>
        ${it.metadata?.ai_recommendation ? `<category>精选</category>` : ''}
      </item>`
      )
      .join('');

    return `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
  <channel>
    <title>LinkLoom · AI 精选时间线</title>
    <link>${escape(baseUrl)}</link>
    <description>AI 资讯精选时间线，由 LinkLoom 自动评分推荐。</description>
    <language>zh-CN</language>
    ${items}
  </channel>
</rss>`;
  }

  async getAdminStats(): Promise<FeedAdminStats> {
    const today = getISODate();
    const yesterday = this.shiftDate(today, -1);
    const dayBefore = this.shiftDate(today, -2);

    const [{ items: t }, { items: y }, { items: d }] = await Promise.all([
      this.store.listSourceData({ ingestionDate: today, limit: 1000 }),
      this.store.listSourceData({ ingestionDate: yesterday, limit: 1000 }),
      this.store.listSourceData({ ingestionDate: dayBefore, limit: 1000 })
    ]);
    const all = [...t, ...y, ...d];

    const cutoff = Date.now() - 24 * 3600 * 1000;
    const inWindow = all.filter((it) => {
      const ts = it.metadata?.ai_scored_at ? Date.parse(it.metadata.ai_scored_at) : 0;
      return ts >= cutoff;
    });

    const raw = all.filter((it) => !this.isScored(it)).length;
    const processed24h = inWindow.length;
    const failed24h = 0; // task logs handle errors; no per-item failure persisted for now
    const passRate24h =
      processed24h > 0 ? Math.round(((processed24h - failed24h) / processed24h) * 100) : 0;
    const taskLogs = await this.store.listTaskLogs({ limit: 50 });
    const lastDigestLog = taskLogs.find(
      (l: any) => l.taskName?.includes('日报') || (l.message || '').includes('Daily digest')
    );
    const lastDigestAt = lastDigestLog?.endTime || lastDigestLog?.startTime;

    return {
      raw,
      processed24h,
      failed24h,
      passRate24h,
      lastDigestAt
    };
  }

  /** Public reader detail — returns null when missing. */
  async getItemDetail(id: string): Promise<ItemDetail | null> {
    const it = await this.store.getSourceData(id);
    if (!it) return null;

    const rawHtml =
      (typeof it.metadata?.content_html === 'string' && it.metadata.content_html) ||
      (typeof it.metadata?.full_content === 'string' && it.metadata.full_content) ||
      null;
    const bodyStatus: ItemDetail['bodyStatus'] =
      rawHtml && rawHtml.trim().length > 40 ? 'full' : 'summary_only';

    return {
      id: it.id,
      title: it.title,
      sourceLabel: this.deriveSourceLabel(it),
      sourceUrl: it.url,
      sourceImage: readSourceImage(it.metadata),
      publishedAt: it.published_date,
      categoryId: mapLegacyTopicToCategory(
        (typeof it.metadata?.ai_category === 'string' && it.metadata.ai_category) ||
          it.metadata?.ai_topic
      ),
      tags: it.metadata?.ai_tags,
      picked: it.metadata?.ai_picked,
      score: it.metadata?.ai_score,
      summary: it.metadata?.ai_summary || it.description,
      recommendation: it.metadata?.ai_recommendation,
      // Raw pipeline HTML; web strips tags → plain <p> (never dangerouslySetInnerHTML in v1).
      bodyHtml: bodyStatus === 'full' ? rawHtml : null,
      bodyStatus,
      relatedItemIds: it.metadata?.ai_related_ids,
      permalink: `/items/${it.id}`,
      sourceType: it.metadata?.ai_source_type
    };
  }

  /** Admin raw item payload (unchanged contract). */
  async getAdminItemDetail(id: string) {
    const item = await this.store.getSourceData(id);
    if (!item) throw new Error('source data not found');
    const metadata = (item.metadata || {}) as Record<string, unknown>;
    return {
      id: item.id,
      title: item.title,
      url: item.url,
      source: item.source,
      author: item.author,
      category: item.category,
      published_date: item.published_date,
      ingestion_date: item.ingestion_date,
      description: item.description,
      metadata
    };
  }

  async resetScoring(id: string, body: Record<string, any> = {}) {
    const item = await this.store.getSourceData(id);
    if (!item) throw new Error('source data not found');

    const requestedKeys = this.pickStringArray(body.keys || body.fields || body.resetKeys);
    const writeConfig = await this.resolveWorkflowMetadataWriteConfig('scoring-pipeline');
    const keys = requestedKeys.length > 0 ? requestedKeys : writeConfig.keys;
    const stamp = this.resolveStamp(body.stamp, writeConfig.stamp);
    const keysToReset = new Set(keys);
    if (stamp) keysToReset.add(stamp);

    if (keysToReset.size === 0) return { id, changed: false };

    const metadata = { ...(item.metadata || {}) } as Record<string, any>;
    for (const key of keysToReset) delete metadata[key];

    await this.store.updateSourceDataMetadata(id, metadata);
    return { id, changed: true, resetKeys: Array.from(keysToReset) };
  }

  async patchScoring(id: string, body: Record<string, any>) {
    const item = await this.store.getSourceData(id);
    if (!item) throw new Error('source data not found');

    const patch = this.extractMetadataPatch(body);
    const requestedKeys = this.pickStringArray(body?.allowedKeys || body?.keys || body?.fields);
    const writeConfig = await this.resolveWorkflowMetadataWriteConfig('scoring-pipeline');
    const allowedKeys = requestedKeys.length > 0 ? requestedKeys : writeConfig.keys;
    const filteredPatch = this.filterPatchByAllowedKeys(patch, allowedKeys);

    if (Object.keys(filteredPatch).length === 0) return { id, changed: false };

    const stamp = this.resolveStamp(body?.stamp, writeConfig.stamp);
    const metadata = {
      ...(item.metadata || {}),
      ...filteredPatch
    } as Record<string, any>;
    if (stamp && metadata[stamp] === undefined) {
      metadata[stamp] = item.metadata?.[stamp] || new Date().toISOString();
    }

    await this.store.updateSourceDataMetadata(id, metadata);
    return { id, changed: true, changedKeys: Object.keys(filteredPatch), stamp };
  }

  private extractMetadataPatch(body: Record<string, any> | undefined): Record<string, any> {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return {};
    if (body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)) {
      return { ...body.metadata };
    }
    if (body.patch && typeof body.patch === 'object' && !Array.isArray(body.patch)) {
      return { ...body.patch };
    }

    const controlKeys = new Set([
      'allowedKeys',
      'fields',
      'keys',
      'metadata',
      'patch',
      'resetKeys',
      'stamp'
    ]);
    return Object.fromEntries(Object.entries(body).filter(([key]) => !controlKeys.has(key)));
  }

  private filterPatchByAllowedKeys(
    patch: Record<string, any>,
    allowedKeys: string[]
  ): Record<string, any> {
    if (allowedKeys.length === 0) return patch;
    const allowed = new Set(allowedKeys);
    return Object.fromEntries(Object.entries(patch).filter(([key]) => allowed.has(key)));
  }

  private pickStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
  }

  private resolveStamp(requested: unknown, fallback: string | null): string | null {
    if (requested === false || requested === null || requested === '') return null;
    if (typeof requested === 'string') return requested;
    return fallback;
  }

  private async resolveWorkflowMetadataWriteConfig(
    kind: string
  ): Promise<{ keys: string[]; stamp: string | null }> {
    const workflows = await this.store.listWorkflows();
    const workflow = workflows.find((item: any) => item?.metadata?.kind === kind);
    if (!workflow) return { keys: [], stamp: null };

    const configs = this.collectStoreWriteConfigs(workflow.steps || []);
    const keys = new Set<string>();
    let stamp: string | null = null;

    for (const config of configs) {
      for (const key of this.pickStringArray(config.allowedKeys)) keys.add(key);
      if (!stamp && typeof config.stamp === 'string' && config.stamp.length > 0)
        stamp = config.stamp;
    }

    return { keys: Array.from(keys), stamp };
  }

  private collectStoreWriteConfigs(steps: any[]): Array<Record<string, any>> {
    const configs: Array<Record<string, any>> = [];
    for (const step of steps) {
      if (step?.type === 'store-write') {
        configs.push(step.config || {});
      }
      const child = step?.config?.child;
      if (child?.type === 'store-write') {
        configs.push(child.config || {});
      }
      if (Array.isArray(child?.steps)) {
        configs.push(...this.collectStoreWriteConfigs(child.steps));
      }
    }
    return configs;
  }

  async getRawTimeline(query: {
    date?: string;
    rangeFrom?: string;
    rangeTo?: string;
    limit?: string | number;
    offset?: string | number;
  }) {
    const limit = Math.min(200, Math.max(10, Number(query.limit) || 100));
    const offset = Math.max(0, Number(query.offset) || 0);
    const range = this.resolvePublishedRange(query);

    const { items, total } = await this.store.listSourceData({
      ingestionDate: range ? undefined : this.resolveDate(query.date),
      publishedFrom: range?.publishedFrom,
      publishedTo: range?.publishedTo,
      limit,
      offset,
      orderByPublishedDesc: true
    });

    return {
      total,
      items: items.map((it) => this.toTimelineFeedItem(it))
    };
  }

  async getProcessedTimeline(query: {
    date?: string;
    rangeFrom?: string;
    rangeTo?: string;
    limit?: string | number;
    offset?: string | number;
    topic?: string;
    sourceType?: string;
    picked?: string | boolean;
  }) {
    const limit = Math.min(200, Math.max(10, Number(query.limit) || 100));
    const offset = Math.max(0, Number(query.offset) || 0);
    const onlyPicked = query.picked === '1' || query.picked === 'true' || query.picked === true;
    const sourceTypes =
      typeof query.sourceType === 'string' && query.sourceType.length > 0
        ? (query.sourceType.split(',') as FeedSourceType[])
        : undefined;
    const topic =
      typeof query.topic === 'string' && query.topic.length > 0
        ? (query.topic as FeedTopic)
        : undefined;
    const range = this.resolvePublishedRange(query);

    const { items, total } = await this.store.listSourceData({
      ingestionDate: range ? undefined : this.resolveDate(query.date),
      publishedFrom: range?.publishedFrom,
      publishedTo: range?.publishedTo,
      hasAiScored: true,
      aiPicked: onlyPicked ? true : undefined,
      aiSourceTypes: sourceTypes,
      aiTopic: topic,
      limit,
      offset,
      orderByPublishedDesc: true
    });

    return {
      total,
      items: items.map((it) => this.toTimelineFeedItem(it)),
      nextCursor: total > offset + limit ? String(offset + limit) : null
    };
  }

  // ---------- helpers ----------

  toTimelineFeedItem(it: UnifiedData): TimelineFeedItem {
    return {
      id: it.id,
      title: it.title,
      url: it.url,
      source: it.source,
      sourceLabel: this.deriveSourceLabel(it),
      sourceImage: readSourceImage(it.metadata),
      sourceType: it.metadata?.ai_source_type,
      publishedAt: it.published_date,
      ingestionDate: it.ingestion_date,
      category: it.category,
      permalink: `/items/${it.id}`,
      categoryId: mapLegacyTopicToCategory(
        (typeof it.metadata?.ai_category === 'string' && it.metadata.ai_category) ||
          it.metadata?.ai_topic
      ),
      score: it.metadata?.ai_score,
      picked: it.metadata?.ai_picked,
      topic: it.metadata?.ai_topic,
      tags: it.metadata?.ai_tags,
      summary: it.metadata?.ai_summary || it.description,
      summaryShort: it.metadata?.ai_summary_short,
      recommendation: it.metadata?.ai_recommendation,
      relatedIds: it.metadata?.ai_related_ids,
      scored: this.isScored(it),
      description: it.description,
      contentHtml:
        typeof it.metadata?.content_html === 'string' ? it.metadata.content_html : undefined,
      fullContent:
        typeof it.metadata?.full_content === 'string' ? it.metadata.full_content : undefined
    };
  }

  private deriveSourceLabel(it: UnifiedData): string {
    if (it.author && it.source && !it.source.includes(it.author)) {
      return `${it.source}（${it.author}）`;
    }
    return it.source;
  }

  private isScored(it: UnifiedData): boolean {
    return typeof it.metadata?.ai_scored_at === 'string' && it.metadata.ai_scored_at.length > 0;
  }

  private resolveDate(date?: string): string | undefined {
    return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;
  }

  private resolvePublishedRange(query: {
    rangeFrom?: string;
    rangeTo?: string;
  }): { publishedFrom: string; publishedTo: string } | undefined {
    if (!query.rangeFrom || !query.rangeTo) return undefined;
    const fromMs = parseShanghaiLocalDateTimeInput(query.rangeFrom);
    const toMs = parseShanghaiLocalDateTimeInput(query.rangeTo);
    if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) return undefined;
    const [from, to] = fromMs <= toMs ? [fromMs, toMs] : [toMs, fromMs];
    return {
      publishedFrom: new Date(from).toISOString(),
      publishedTo: new Date(to).toISOString()
    };
  }

  private shiftDate(isoDate: string, days: number): string {
    const dt = new Date(isoDate + 'T00:00:00Z');
    dt.setUTCDate(dt.getUTCDate() + days);
    return dt.toISOString().slice(0, 10);
  }
}
