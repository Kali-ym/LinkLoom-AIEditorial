import type { HotEvent, HotEventMember, HotBoards } from '../../types/feed.js';
import type { UnifiedData } from '../../types/index.js';
import { computeClusterQuality, computeHeat } from './hotHeat.js';
import { readSourceImage } from '../../utils/sourceImage.js';

/** Minimal shape for clustering; UnifiedData is compatible. */
export interface HotClusterItem {
  id: string;
  title: string;
  url?: string;
  source: string;
  author?: string;
  published_date: string;
  metadata?: Record<string, any>;
}

const PRIMARY_SOURCE_TYPES = new Set(['official', 'academic']);
const TOP_N = 10;
const MAX_TAGS = 8;
const EVENT_TITLE_MAX_CODE_POINTS = 40;

function metaString(meta: Record<string, unknown> | undefined, key: string): string | undefined {
  const v = meta?.[key];
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t || undefined;
}

/** Truncate by Unicode code points (spread), append … when cut. */
export function truncateCodePoints(text: string, max: number): string {
  const chars = [...text];
  if (chars.length <= max) return text;
  return `${chars.slice(0, max).join('')}…`;
}

export function resolveEventTitle(representative: HotClusterItem): string {
  const short = metaString(representative.metadata, 'ai_summary_short');
  if (short) return short;
  const full = metaString(representative.metadata, 'ai_summary');
  if (full) return truncateCodePoints(full, EVENT_TITLE_MAX_CODE_POINTS);
  return representative.title;
}

export function resolveMemberSummary(it: HotClusterItem): string | undefined {
  return (
    metaString(it.metadata, 'ai_summary') ||
    metaString(it.metadata, 'ai_summary_short') ||
    undefined
  );
}

export interface BuildHotEventsOptions {
  /** Default true. Week/month boards set false (no time decay). */
  applyDecay?: boolean;
}

/** Signature / related-id clustering only (no event_id grouping). */
function clusterBySignature(
  items: HotClusterItem[],
  now: Date,
  applyDecay: boolean
): HotEvent[] {
  const signatureGroups = new Map<string, HotClusterItem[]>();
  const unsigned: HotClusterItem[] = [];

  for (const it of items) {
    const sig = normalizeSignature(it.metadata?.event_signature);
    if (sig) {
      const list = signatureGroups.get(sig) || [];
      list.push(it);
      signatureGroups.set(sig, list);
    } else {
      unsigned.push(it);
    }
  }

  const clusters: Array<{ id: string; members: HotClusterItem[] }> = [];
  for (const [sig, members] of signatureGroups) {
    clusters.push({ id: `sig:${encodeURIComponent(sig)}`, members });
  }
  for (const members of unionFindClusters(unsigned)) {
    const sortedIds = members.map((m) => m.id).sort();
    clusters.push({ id: `rel:${sortedIds[0]}`, members });
  }
  return clusters.map((c) => clusterToEvent(c.id, c.members, now, { applyDecay }));
}

/**
 * Build ranked Top-N board from a scored item pool.
 * Prefers merge `event_id`; remainder uses signature / related clustering.
 * Realtime / week / month share this path — only `applyDecay` and the pool differ.
 */
export function buildHotEvents(
  items: Array<HotClusterItem | UnifiedData>,
  now: Date = new Date(),
  options: BuildHotEventsOptions = {}
): HotEvent[] {
  const applyDecay = options.applyDecay !== false;
  const byId = new Map<string, HotClusterItem>();
  for (const it of items) {
    if (it?.id) byId.set(it.id, it);
  }

  const byEventId = new Map<string, HotClusterItem[]>();
  const remainder: HotClusterItem[] = [];
  for (const it of byId.values()) {
    const eid = it.metadata?.event_id;
    if (typeof eid === 'string' && eid.startsWith('evt_')) {
      const list = byEventId.get(eid) || [];
      list.push(it);
      byEventId.set(eid, list);
    } else {
      remainder.push(it);
    }
  }

  const fromIds = [...byEventId.entries()].map(([eid, members]) =>
    clusterToEvent(eid, members, now, { applyDecay })
  );
  const fromRest = clusterBySignature(remainder, now, applyDecay);
  return rankHotEvents([...fromIds, ...fromRest]);
}

/**
 * Period boards (week / month): keep whole event clusters whose newest member
 * falls in `[periodStart, periodEnd]`. Membership is not re-cut by the window.
 */
export function buildHotBoardByClusterNewest(
  items: Array<HotClusterItem | UnifiedData>,
  opts: {
    periodStart: Date;
    periodEnd?: Date;
    now?: Date;
    applyDecay?: boolean;
  }
): HotEvent[] {
  const now = opts.now ?? opts.periodEnd ?? new Date();
  const applyDecay = opts.applyDecay === true;
  const startMs = opts.periodStart.getTime();
  const endMs = (opts.periodEnd ?? now).getTime();

  const byId = new Map<string, HotClusterItem>();
  for (const it of items) {
    if (it?.id) byId.set(it.id, it);
  }

  const byEventId = new Map<string, HotClusterItem[]>();
  for (const it of byId.values()) {
    const eid = it.metadata?.event_id;
    if (typeof eid !== 'string' || !eid.startsWith('evt_')) continue;
    const list = byEventId.get(eid) || [];
    list.push(it);
    byEventId.set(eid, list);
  }

  const events: HotEvent[] = [];
  for (const [eid, members] of byEventId) {
    const newestMs = clusterNewestPublishedMs(members);
    if (!Number.isFinite(newestMs) || newestMs < startMs || newestMs > endMs) continue;
    events.push(clusterToEvent(eid, members, now, { applyDecay }));
  }
  return rankHotEvents(events);
}

export function clusterNewestPublishedMs(members: HotClusterItem[]): number {
  return Math.max(...members.map((m) => Date.parse(m.published_date) || 0), 0);
}

/**
 * Realtime: group/merge display from the near-window pool (decay on).
 * Week / month: filter shared clusters by newest-member time only (no decay).
 */
export function buildHotBoards(
  pools: {
    realtime: Array<HotClusterItem | UnifiedData>;
    week: Array<HotClusterItem | UnifiedData>;
    month: Array<HotClusterItem | UnifiedData>;
  },
  now: Date = new Date(),
  bounds: {
    weekStart: Date;
    monthStart: Date;
  }
): HotBoards {
  return {
    realtime: buildHotEvents(pools.realtime, now, { applyDecay: true }),
    week: buildHotBoardByClusterNewest(pools.week, {
      periodStart: bounds.weekStart,
      periodEnd: now,
      now,
      applyDecay: false
    }),
    month: buildHotBoardByClusterNewest(pools.month, {
      periodStart: bounds.monthStart,
      periodEnd: now,
      now,
      applyDecay: false
    })
  };
}

/** Rank all events by heat descending, Top N. */
export function rankHotEvents(events: HotEvent[], topN = TOP_N): HotEvent[] {
  return [...events].sort((a, b) => b.heat - a.heat).slice(0, topN);
}

function normalizeSignature(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function unionFindClusters(items: HotClusterItem[]): HotClusterItem[][] {
  if (items.length === 0) return [];

  const ids = items.map((it) => it.id);
  const index = new Map(ids.map((id, i) => [id, i]));
  const parent = ids.map((_, i) => i);

  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  for (const it of items) {
    const related = it.metadata?.ai_related_ids;
    if (!Array.isArray(related)) continue;
    const ai = index.get(it.id);
    if (ai === undefined) continue;
    for (const rid of related) {
      if (typeof rid !== 'string') continue;
      const bi = index.get(rid);
      if (bi !== undefined) union(ai, bi);
    }
  }

  const groups = new Map<number, HotClusterItem[]>();
  for (let i = 0; i < items.length; i++) {
    const root = find(i);
    const list = groups.get(root) || [];
    list.push(items[i]);
    groups.set(root, list);
  }
  return [...groups.values()];
}

export function clusterToEvent(
  id: string,
  members: HotClusterItem[],
  now: Date,
  options: BuildHotEventsOptions = {}
): HotEvent {
  const applyDecay = options.applyDecay !== false;
  const sources = new Set(
    members.map((m) => (m.source || '').toLowerCase().trim()).filter(Boolean)
  );
  const sourceCount = Math.max(1, sources.size);
  const hasPicked = members.some((m) => m.metadata?.ai_picked === true);
  const newestMs = Math.max(
    ...members.map((m) => Date.parse(m.published_date) || 0)
  );
  const ageHours =
    Number.isFinite(newestMs) && newestMs > 0
      ? Math.max(0, (now.getTime() - newestMs) / 3600000)
      : 0;
  const scores = members.map((m) => Number(m.metadata?.ai_score) || 0);
  const heat = computeHeat({
    quality: computeClusterQuality(scores),
    sourceCount,
    ageHours,
    hasPicked,
    applyDecay
  });

  const representative = pickRepresentative(members);
  const tags = collectTags(members);

  return {
    id,
    title: resolveEventTitle(representative),
    why: typeof representative.metadata?.ai_recommendation === 'string'
      ? representative.metadata.ai_recommendation
      : undefined,
    heat,
    sourceCount,
    tags: tags.length ? tags : undefined,
    members: members.map(toMember)
  };
}

function pickRepresentative(members: HotClusterItem[]): HotClusterItem {
  const score = (m: HotClusterItem) => Number(m.metadata?.ai_score) || 0;
  const picked = members.filter((m) => m.metadata?.ai_picked === true);
  const pool = picked.length > 0 ? picked : members;
  return [...pool].sort((a, b) => score(b) - score(a))[0];
}

function collectTags(members: HotClusterItem[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of members) {
    const tags = m.metadata?.ai_tags;
    if (!Array.isArray(tags)) continue;
    for (const t of tags) {
      if (typeof t !== 'string') continue;
      const key = t.trim();
      if (!key) continue;
      const norm = key.toLowerCase();
      if (seen.has(norm)) continue;
      seen.add(norm);
      out.push(key);
      if (out.length >= MAX_TAGS) return out;
    }
  }
  return out;
}

function toMember(it: HotClusterItem): HotEventMember {
  const sourceType =
    typeof it.metadata?.ai_source_type === 'string' ? it.metadata.ai_source_type : '';
  const role: HotEventMember['role'] = PRIMARY_SOURCE_TYPES.has(sourceType)
    ? 'primary'
    : 'secondary';
  const summary = resolveMemberSummary(it);

  return {
    itemId: it.id,
    permalink: `/items/${it.id}`,
    sourceLabel: deriveSourceLabel(it),
    role,
    title: it.title,
    url: it.url || undefined,
    sourceImage: readSourceImage(it.metadata),
    summary,
    publishedAt: it.published_date
  };
}

function deriveSourceLabel(it: HotClusterItem): string {
  if (it.author && it.source && !it.source.includes(it.author)) {
    return `${it.source}（${it.author}）`;
  }
  return it.source || it.author || '未知来源';
}
