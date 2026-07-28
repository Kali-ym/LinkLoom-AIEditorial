import type { DigestContextPayload } from '../../types/digestContext.js';
import type { LocalStore } from '../LocalStore.js';

const HOT_KEY = 'hot_topics_digest:';
const MONITOR_KEY = 'source_monitor_snapshot:';
const TRACK_KEY = 'topic_track_digest:';

function asItems(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (Array.isArray(obj.items)) return obj.items;
  }
  return [];
}

function itemTitle(item: any): string {
  return String(
    item?.metadata?.translated_title || item?.title || item?.metadata?.title || item?.name || ''
  ).trim();
}

function itemUrl(item: any): string | undefined {
  const url = item?.url || item?.link || item?.metadata?.url || item?.metadata?.link;
  return typeof url === 'string' && url ? url : undefined;
}

function itemScore(item: any): number | undefined {
  const raw = item?.metadata?.ai_score ?? item?.ai_score ?? item?.score;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : undefined;
  if (typeof raw === 'string' && raw.trim()) {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function itemSource(item: any): string | undefined {
  const source = item?.source || item?.adapterName || item?.metadata?.source || item?.metadata?.adapterName;
  return typeof source === 'string' && source ? source : undefined;
}

function itemTags(item: any): string[] {
  const tags = item?.metadata?.ai_tags ?? item?.ai_tags ?? item?.tags;
  if (Array.isArray(tags)) return tags.map((t) => String(t).trim()).filter(Boolean);
  if (typeof tags === 'string' && tags.trim()) {
    return tags
      .split(/[，,、;；|]+/)
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
  return [];
}

function uniqueStrings(values: string[], limit: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of values) {
    const trimmed = v.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
    if (out.length >= limit) break;
  }
  return out;
}

export class DigestContextService {
  constructor(private readonly store: LocalStore) {}

  async getDigestContext(date: string): Promise<DigestContextPayload> {
    const normalizedDate = date.slice(0, 10);
    const missingKeys: string[] = [];

    const hotRaw = await this.store.get(`${HOT_KEY}${normalizedDate}`);
    const monitorRaw = await this.store.get(`${MONITOR_KEY}${normalizedDate}`);
    const trackRaw = await this.store.get(`${TRACK_KEY}${normalizedDate}`);

    if (hotRaw === undefined || hotRaw === null) missingKeys.push(`${HOT_KEY}${normalizedDate}`);
    if (monitorRaw === undefined || monitorRaw === null) {
      missingKeys.push(`${MONITOR_KEY}${normalizedDate}`);
    }
    if (trackRaw === undefined || trackRaw === null) missingKeys.push(`${TRACK_KEY}${normalizedDate}`);

    const hotItems = asItems(hotRaw).sort((a, b) => (itemScore(b) ?? 0) - (itemScore(a) ?? 0));
    const monitorItems = asItems(monitorRaw);
    const trackItems = asItems(trackRaw);

    const hotHeadlines: DigestContextPayload['hotHeadlines'] = hotItems.slice(0, 8).map((item) => ({
      title: itemTitle(item) || '未命名素材',
      url: itemUrl(item),
      score: itemScore(item),
      source: itemSource(item)
    }));

    const bySource = new Map<string, any[]>();
    for (const item of monitorItems) {
      const source = itemSource(item) || 'unknown';
      const list = bySource.get(source) || [];
      list.push(item);
      bySource.set(source, list);
    }
    const monitorAlerts: DigestContextPayload['monitorAlerts'] = [...bySource.entries()]
      .map(([source, items]) => ({
        source,
        count: items.length,
        topTitle: itemTitle(items[0])
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    const byTag = new Map<string, any[]>();
    for (const item of trackItems) {
      for (const tag of itemTags(item)) {
        const list = byTag.get(tag) || [];
        list.push(item);
        byTag.set(tag, list);
      }
    }
    const trackedThemes: DigestContextPayload['trackedThemes'] = [...byTag.entries()]
      .map(([tag, items]) => ({
        tag,
        itemCount: items.length,
        sampleTitles: items.slice(0, 3).map((i) => itemTitle(i)).filter(Boolean)
      }))
      .sort((a, b) => b.itemCount - a.itemCount)
      .slice(0, 8);

    const topicCandidates = [
      ...trackedThemes.map((t) => t.tag),
      ...hotHeadlines.map((h) => h.title).slice(0, 3)
    ];

    return {
      date: normalizedDate,
      suggestedDailyOneXTopics: uniqueStrings(topicCandidates, 3),
      hotHeadlines,
      monitorAlerts,
      trackedThemes,
      stale: missingKeys.length > 0,
      missingKeys
    };
  }
}
