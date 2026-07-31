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
import { createAIProvider } from '../AIProvider.js';
import { LLMMergeJudge } from './llmMergeJudge.js';

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
  /** Strip evt_* assignments + fingerprints and run a one-shot full merge. */
  fullRebuild?: boolean;
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
  fullRebuild?: boolean;
  clearedAssignments?: number;
}

export class HotStoryMergeService {
  constructor(private store: LocalStore) {}

  async runMergeAndSnapshot(
    now: Date = new Date(),
    overrides?: HotRebuildOverrides
  ): Promise<HotRebuildResult> {
    const settings = await this.loadSettings();
    const hot = this.resolveHotConfig(settings, overrides);
    let items = await this.loadScoredWindow(now);

    const fullRebuild = overrides?.fullRebuild === true;
    let clearedAssignments = 0;
    if (fullRebuild) {
      clearedAssignments = await this.clearHotAssignments(items);
      items = this.stripHotAssignments(items);
      await this.clearClusterFingerprints();
      LogService.info(
        `Hot story full rebuild: cleared ${clearedAssignments} evt_* assignments, fingerprints reset`
      );
    }

    const embedSvc = this.resolveEmbedService(settings, hot.embeddingServiceId);
    const embed =
      embedSvc && (hot.mergeMode === 'semantic' || hot.mergeMode === 'hybrid')
        ? createHotEmbedder(resolveSmallModelConfigForRuntime(embedSvc, settings), this.store)
        : null;

    // LLM mode: create judge
    let llmJudge: LLMMergeJudge | null = null;
    if (hot.mergeMode === 'llm') {
      llmJudge = await this.createLLMJudge(settings, hot);
      if (llmJudge) {
        await llmJudge.loadFingerprints();
      }
    }

    const { clusters, mergeModeApplied, fallbackReason, bootstrapped } =
      await mergeHotStoriesIncremental(items, {
        mergeMode: hot.mergeMode,
        embed,
        similarityMin: hot.similarityMin,
        llmJudge
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
        incremental: !fullRebuild,
        bootstrapped,
        fullRebuild,
        clearedAssignments: fullRebuild ? clearedAssignments : undefined,
        boardFilter: 'cluster_newest'
      }
    });

    LogService.info(
      `Hot story merge${fullRebuild ? ' (full rebuild)' : ' (incremental)'}: mode=${mergeModeApplied}` +
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
      bootstrapped,
      fullRebuild,
      clearedAssignments: fullRebuild ? clearedAssignments : undefined
    };
  }

  private stripHotAssignments(items: UnifiedData[]): UnifiedData[] {
    return items.map((it) => {
      if (!it.metadata?.event_id && !it.metadata?.event_signature_norm) return it;
      const metadata = { ...it.metadata };
      delete metadata.event_id;
      delete metadata.event_signature_norm;
      return { ...it, metadata };
    });
  }

  private async clearHotAssignments(items: UnifiedData[]): Promise<number> {
    let cleared = 0;
    for (const it of items) {
      const eid = it.metadata?.event_id;
      if (typeof eid !== 'string' || !eid.startsWith('evt_')) continue;
      const current = await this.store.getSourceData(it.id);
      if (!current?.metadata) continue;
      const metadata = { ...current.metadata };
      if (!metadata.event_id && !metadata.event_signature_norm) continue;
      delete metadata.event_id;
      delete metadata.event_signature_norm;
      await this.store.updateSourceDataMetadata(it.id, metadata);
      cleared += 1;
    }
    return cleared;
  }

  private async clearClusterFingerprints(): Promise<void> {
    const fpPath = join(this.store.getDataDir(), 'cluster_fingerprints.json');
    try {
      await fs.unlink(fpPath);
    } catch {
      // missing file is fine
    }
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
      mergeMode: 'llm' as HotMergeMode,
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
    const llmProviderId = base.llmProviderId;
    const llmModelId = base.llmModelId;
    const llmMaxJudgmentsPerRun = base.llmMaxJudgmentsPerRun;
    const llmCacheTtlMinutes = base.llmCacheTtlMinutes;
    return {
      mergeMode,
      embeddingServiceId,
      similarityMin,
      llmProviderId,
      llmModelId,
      llmMaxJudgmentsPerRun,
      llmCacheTtlMinutes
    };
  }

  private async createLLMJudge(
    settings: SystemSettings,
    hot: HotConfig
  ): Promise<LLMMergeJudge | null> {
    try {
      const providerId = hot.llmProviderId?.trim() || settings.ACTIVE_AI_PROVIDER_ID;
      const providerConfig = (settings.AI_PROVIDERS || []).find(
        (p) => p.id === providerId
      );
      if (!providerConfig) {
        LogService.warn(`LLM judge: provider not found: ${providerId}, falling back to rules`);
        return null;
      }

      // If a specific model is configured, override the provider config's model
      const configWithModel = hot.llmModelId?.trim()
        ? { ...providerConfig, model: hot.llmModelId.trim() }
        : providerConfig;

      const provider = createAIProvider(configWithModel as any);
      if (!provider) {
        LogService.warn('LLM judge: failed to create provider, falling back to rules');
        return null;
      }

      const store = new FingerprintStoreAdapter(this.store);
      const cache = new JudgmentCacheAdapter();

      return new LLMMergeJudge({
        provider,
        store,
        cache,
        maxJudgmentsPerRun: hot.llmMaxJudgmentsPerRun ?? 50,
        cacheTtlMinutes: hot.llmCacheTtlMinutes ?? 360,
        sealAfterMs: 6 * 3600 * 1000,
        windowMs: REALTIME_WINDOW_MS
      });
    } catch (err) {
      LogService.warn(`LLM judge: init failed: ${err}`);
      return null;
    }
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

// ── Adapters: bridge LocalStore to LLMMergeJudge's storage interfaces ──────

import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import type {
  ClusterFingerprint,
  JudgmentResult
} from './ClusterFingerprint.js';
import type {
  FingerprintStore,
  JudgmentCacheStore
} from './llmMergeJudge.js';

/**
 * File-based fingerprint store. Stores all fingerprints in a single JSON file
 * in the data directory. Simple and atomic — no schema migration needed.
 * Fingerprints can always be rebuilt from member data if the file is lost.
 */
class FingerprintStoreAdapter implements FingerprintStore {
  private readonly filePath: string;
  private cache: ClusterFingerprint[] | null = null;

  constructor(private store: LocalStore) {
    this.filePath = join(store.getDataDir(), 'cluster_fingerprints.json');
  }

  async loadAll(): Promise<ClusterFingerprint[]> {
    if (this.cache) return this.cache;
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      this.cache = JSON.parse(raw) as ClusterFingerprint[];
      return this.cache;
    } catch {
      this.cache = [];
      return this.cache;
    }
  }

  async save(fp: ClusterFingerprint): Promise<void> {
    if (!this.cache) await this.loadAll();
    const idx = this.cache!.findIndex((f) => f.eventId === fp.eventId);
    if (idx >= 0) {
      this.cache![idx] = fp;
    } else {
      this.cache!.push(fp);
    }
    await this.persist();
  }

  async delete(eventId: string): Promise<void> {
    if (!this.cache) await this.loadAll();
    this.cache = this.cache!.filter((f) => f.eventId !== eventId);
    await this.persist();
  }

  private async persist(): Promise<void> {
    try {
      await fs.mkdir(join(this.filePath, '..'), { recursive: true });
      await fs.writeFile(this.filePath, JSON.stringify(this.cache, null, 2), 'utf8');
    } catch (err) {
      LogService.warn(`FingerprintStore: failed to persist: ${err}`);
    }
  }
}

/**
 * In-memory judgment cache with optional file persistence.
 * The cache is ephemeral per process — LLM judgments are cheap and cached
 * results lose validity when fingerprints are regenerated anyway.
 */
class JudgmentCacheAdapter implements JudgmentCacheStore {
  private readonly cache = new Map<string, { result: JudgmentResult; expiresAt: number }>();

  async get(key: string): Promise<JudgmentResult | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.result;
  }

  async set(key: string, result: JudgmentResult, ttlMinutes: number): Promise<void> {
    this.cache.set(key, {
      result,
      expiresAt: Date.now() + ttlMinutes * 60 * 1000
    });
    // Prune if too large
    if (this.cache.size > 5000) {
      const now = Date.now();
      for (const [k, v] of this.cache) {
        if (now > v.expiresAt) this.cache.delete(k);
      }
    }
  }
}
