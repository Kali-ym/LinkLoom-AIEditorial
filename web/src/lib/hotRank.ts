import type { HotEvent } from './types';

export type HotRankKind = 1 | 2 | 3 | 'rest';

export function hotRankKind(rank: number): HotRankKind {
  if (rank === 1) return 1;
  if (rank === 2) return 2;
  if (rank === 3) return 3;
  return 'rest';
}

/** Detail / metric heat numeral color. */
export function heatValueClass(rank: number): string {
  const kind = hotRankKind(rank);
  if (kind === 1) return 'text-rank-1';
  if (kind === 2) return 'text-rank-2';
  if (kind === 3) return 'text-rank-3';
  return 'text-rank-rest-active';
}

/** Detail title rank numeral color. */
export function detailRankClass(rank: number): string {
  return heatValueClass(rank);
}

const HOUR_MS = 3_600_000;

function eventMidMs(event: HotEvent): number | null {
  let min: number | null = null;
  let max: number | null = null;
  for (const m of event.members) {
    const t = Date.parse(m.publishedAt);
    if (!Number.isFinite(t)) continue;
    if (min == null || t < min) min = t;
    if (max == null || t > max) max = t;
  }
  if (min == null || max == null) return null;
  return (min + max) / 2;
}

/** Shanghai wall-clock `HH:00` for axis labels. */
export function formatShanghaiHourLabel(ms: number): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    hour12: false
  }).formatToParts(new Date(ms));
  const raw = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const h = Number(raw) === 24 ? 0 : Number(raw);
  return `${String(h).padStart(2, '0')}:00`;
}

/**
 * Rolling last-24h hourly heat series (24 points, oldest → newest).
 * Stacks event heat around each event's member mid-time.
 */
export function heatSeriesFromEvents(events: HotEvent[], now: Date = new Date()): number[] {
  const buckets = new Array(24).fill(0) as number[];
  const newestBucketStart = now.getTime() - (now.getTime() % HOUR_MS);
  const oldestBucketStart = newestBucketStart - 23 * HOUR_MS;
  const windowStart = oldestBucketStart;
  const windowEnd = newestBucketStart + HOUR_MS;

  for (const ev of events) {
    const mid = eventMidMs(ev);
    if (mid == null) continue;
    if (mid < windowStart || mid >= windowEnd) continue;
    const heat = Math.max(0, ev.heat);
    const i = Math.max(0, Math.min(23, Math.floor((mid - oldestBucketStart) / HOUR_MS)));
    buckets[i]! += heat;
    if (i > 0) buckets[i - 1]! += heat * 0.35;
    if (i < 23) buckets[i + 1]! += heat * 0.35;
  }

  return buckets.map((_, i) => {
    const l = buckets[i - 1] ?? buckets[i]!;
    const r = buckets[i + 1] ?? buckets[i]!;
    return buckets[i]! * 0.5 + l * 0.25 + r * 0.25;
  });
}

/** Oldest bucket start (ms) for a series built at `now`. */
export function heatSeriesWindowStart(now: Date = new Date()): number {
  const newestBucketStart = now.getTime() - (now.getTime() % HOUR_MS);
  return newestBucketStart - 23 * HOUR_MS;
}

export function sparklineDelta(series: number[]): number {
  if (series.length < 2) return 0;
  return Math.round(series[series.length - 1]! - series[series.length - 2]!);
}
