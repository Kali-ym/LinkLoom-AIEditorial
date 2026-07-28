import type { MetadataFilter } from '../../domain/ports/store.js';
import type { UnifiedData } from '../../types/index.js';

/** Minimal store surface for scored-item windows. */
export interface HotItemWindowStore {
  listSourceData(options: {
    hasAiScored?: boolean;
    publishedFrom?: string;
    limit?: number;
    orderByPublishedDesc?: boolean;
    metadataFilters?: MetadataFilter[];
  }): Promise<{ items: UnifiedData[] }>;
}

export async function loadScoredPublishedFrom(
  store: HotItemWindowStore,
  from: Date,
  limit: number
): Promise<UnifiedData[]> {
  try {
    const listed = await store.listSourceData({
      hasAiScored: true,
      publishedFrom: from.toISOString(),
      limit,
      orderByPublishedDesc: true
    });
    return listed.items;
  } catch {
    return [];
  }
}

function collectEventIds(items: UnifiedData[]): string[] {
  const ids = new Set<string>();
  for (const it of items) {
    const eid = it.metadata?.event_id;
    if (typeof eid === 'string' && eid.startsWith('evt_')) ids.add(eid);
  }
  return [...ids];
}

function chunkIds(ids: string[], size: number): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

/**
 * Load full event clusters whose tip activity falls in `[periodStart, ∞)`.
 *
 * 1) Tip pass: scored items published since `periodStart` (discovers candidate event_ids).
 * 2) Expand: all scored members of those event_ids (may predate the period).
 */
export async function loadEventClusterPool(
  store: HotItemWindowStore,
  periodStart: Date,
  tipLimit: number,
  expandLimit: number
): Promise<UnifiedData[]> {
  const tips = await loadScoredPublishedFrom(store, periodStart, tipLimit);
  const eventIds = collectEventIds(tips);
  if (eventIds.length === 0) return [];

  const byId = new Map<string, UnifiedData>();
  for (const chunk of chunkIds(eventIds, 200)) {
    try {
      const listed = await store.listSourceData({
        hasAiScored: true,
        metadataFilters: [{ path: 'event_id', op: 'in', value: chunk }],
        limit: expandLimit,
        orderByPublishedDesc: true
      });
      for (const it of listed.items) {
        if (it?.id) byId.set(it.id, it);
      }
    } catch {
      // skip chunk
    }
  }
  return [...byId.values()];
}
