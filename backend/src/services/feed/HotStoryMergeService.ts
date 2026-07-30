import type { HotConfig, HotMergeMode, SystemSettings } from '../../types/config.js';
import type { UnifiedData } from '../../types/index.js';
import type { LocalStore } from '../LocalStore.js';
import { ConfigService } from '../ConfigService.js';
import { LogService } from '../LogService.js';
import { getISODate } from '../../utils/helpers.js';
import {
  startOfShanghaiCalendarMonth,
  startOfShanghaiCalendarWeek
} from '../../utils/shanghaiDate.js';
import { buildHotBoards } from './hotEvents.js';
import { loadEventClusterPool } from './loadHotWindowItems.js';
import { HOT_SNAPSHOT_SCHEMA_VERSION } from './hotSnapshotPayload.js';
import { normalizeEventSignature } from './normalizeEventSignature.js';
import { createHotEmbedder } from './hotEmbed.js';
import { mergeHotStoriesIncremental } from './incrementalHotMerge.js';
import {
  resolveEmbeddingService,
  resolveEmbeddingServiceById
} from '../rag/RagSettings.js';
import { resolveSmallModelConfigForRuntime } from '../settingsSecurity.js';

const REALTIME_WINDOW_MS = 36 * 3600 * 1000;
/** Merge assignment lookback — wider than realtime so week/month sticky ids can be (re)built. */
const MERGE_ASSIGN_WINDOW_MS = 7 * 24 * 3600 * 1000;

function shiftDate(isoDate: string, deltaDays: number): string {
  const d = new Date(`${isoDate}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

function dedupeItems(items: UnifiedData[]): UnifiedData[] {
  const byId = new Map<string, UnifiedData>();
  for (const it of items) {
    if (it?.id) byId.set(it.id, it);
  }
  return [...byId.values()];
}

function isAssignedEvent(it: UnifiedData): boolean {
  const eid = it.metadata?.event_id;
  return typeof eid === 'string' && eid.startsWith('evt_');
}

export interface HotRebuildOverrides {
  mergeMode?: HotMergeMode;
  embeddingServiceId?: string;
  similarityMin?: number;
}

export interface HotRebuildResult {
  eventCount: number;
  generatedAt: string;
  itemCount: number;
  clusterCount: number;
  mergeModeRequested: HotMergeMode;
  mergeModeApplied: HotMergeMode;
  fallbackReason?: string;
  weekEventCount?: number;
  monthEventCount?: number;
  bootstrapped?: boolean;
}

export class HotStoryMergeService {
  constructor(private store: LocalStore) {}

  async runMergeAndSnapshot(
    now: Date = new Date(),
    overrides?: HotRebuildOverrides
  ): Promise<HotRebuildResult> {
    const settings = await this.loadSettings();
    const hot = this.resolveHotConfig(settings, overrides);
    const items = await this.loadScoredWindow(now);

    const embedSvc = this.resolveEmbedService(settings, hot.embeddingServiceId);
    const embed =
      embedSvc && (hot.mergeMode === 'semantic' || hot.mergeMode === 'hybrid')
        ? createHotEmbedder(resolveSmallModelConfigForRuntime(embedSvc, settings), this.store)
        : null;

    const { clusters, mergeModeApplied, fallbackReason, bootstrapped } =
      await mergeHotStoriesIncremental(items, {
        mergeMode: hot.mergeMode,
        embed,
        similarityMin: hot.similarityMin
      });

    for (const cluster of clusters) {
      const norm =
        cluster.signatureNorm ||
        normalizeEventSignature(cluster.members[0]?.metadata?.event_signature);
      for (const member of cluster.members) {
        const metadata = {
          ...(member.metadata || {}),
          event_id: cluster.eventId,
          event_signature_norm: norm
        };
        member.metadata = metadata;
        const current = await this.store.getSourceData(member.id);
        if (!current) continue;
        await this.store.updateSourceDataMetadata(member.id, {
          ...(current.metadata || {}),
          event_id: cluster.eventId,
          event_signature_norm: norm
        });
      }
    }

    const weekStart = startOfShanghaiCalendarWeek(now);
    const monthStart = startOfShanghaiCalendarMonth(now);
    const realtimeFrom = new Date(now.getTime() - REALTIME_WINDOW_MS);

    const [realtimeExpanded, weekPool, monthPool] = await Promise.all([
      loadEventClusterPool(this.store, realtimeFrom, 1000, 3000),
      loadEventClusterPool(this.store, weekStart, 2000, 5000),
      loadEventClusterPool(this.store, monthStart, 3000, 8000)
    ]);

    // Realtime display: full sticky clusters touched in-window + still-unassigned newcomers.
    const unsigned = items.filter((it) => !isAssignedEvent(it));
    const realtimePool = dedupeItems([...realtimeExpanded, ...unsigned]);

    const boards = buildHotBoards(
      { realtime: realtimePool, week: weekPool, month: monthPool },
      now,
      { weekStart, monthStart }
    );
    const { realtime, week, month } = boards;

    const generatedAt = now.toISOString();
    await this.store.saveHotEventSnapshot({
      generatedAt: now,
      boards,
      meta: {
        itemCount: items.length,
        clusterCount: clusters.length,
        weekItemCount: weekPool.length,
        monthItemCount: monthPool.length,
        realtimeItemCount: realtimePool.length,
        version: HOT_SNAPSHOT_SCHEMA_VERSION,
        mergeModeApplied,
        fallbackReason,
        incremental: true,
        bootstrapped,
        boardFilter: 'cluster_newest'
      }
    });

    LogService.info(
      `Hot story merge (incremental): mode=${mergeModeApplied}` +
        (fallbackReason ? `(${fallbackReason})` : '') +
        (bootstrapped ? ' bootstrap' : '') +
        ` items=${items.length} clusters=${clusters.length}` +
        ` events=${realtime.length} week=${week.length} month=${month.length}`
    );

    return {
      eventCount: realtime.length,
      generatedAt,
      itemCount: items.length,
      clusterCount: clusters.length,
      mergeModeRequested: hot.mergeMode,
      mergeModeApplied,
      fallbackReason,
      weekEventCount: week.length,
      monthEventCount: month.length,
      bootstrapped
    };
  }

  private async loadSettings(): Promise<SystemSettings> {
    const configService = await ConfigService.getInstance(this.store);
    return configService.getSettings();
  }

  private resolveHotConfig(
    settings: SystemSettings,
    overrides?: HotRebuildOverrides
  ): HotConfig {
    const base = settings.HOT_CONFIG || {
      mergeMode: 'hybrid' as HotMergeMode,
      embeddingServiceId: '',
      similarityMin: 0.78
    };
    const mergeMode = overrides?.mergeMode || base.mergeMode;
    const embeddingServiceId =
      overrides?.embeddingServiceId !== undefined
        ? overrides.embeddingServiceId
        : base.embeddingServiceId;
    const similarityMin =
      overrides?.similarityMin !== undefined ? overrides.similarityMin : base.similarityMin;
    return { mergeMode, embeddingServiceId, similarityMin };
  }

  private resolveEmbedService(settings: SystemSettings, hotEmbeddingId: string) {
    const preferred = hotEmbeddingId?.trim();
    if (preferred) {
      return resolveEmbeddingServiceById(settings, preferred);
    }
    return resolveEmbeddingService(settings);
  }

  private async loadScoredWindow(now: Date): Promise<UnifiedData[]> {
    const from = new Date(now.getTime() - MERGE_ASSIGN_WINDOW_MS).toISOString();
    let items: UnifiedData[] = [];
    try {
      const listed = await this.store.listSourceData({
        hasAiScored: true,
        publishedFrom: from,
        limit: 3000,
        orderByPublishedDesc: true
      });
      items = listed.items;
    } catch {
      items = [];
    }

    if (items.length === 0) {
      const today = getISODate();
      const days = [0, -1, -2, -3, -4, -5, -6].map((d) => shiftDate(today, d));
      const listed = await Promise.all(
        days.map((ingestionDate) =>
          this.store.listSourceData({
            ingestionDate,
            hasAiScored: true,
            limit: 500
          })
        )
      );
      const byId = new Map<string, UnifiedData>();
      for (const { items: dayItems } of listed) {
        for (const it of dayItems) {
          if (it?.id) byId.set(it.id, it);
        }
      }
      items = [...byId.values()];
    }

    return items;
  }
}
