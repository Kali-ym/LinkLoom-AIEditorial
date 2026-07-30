/**
 * LLM merge judge: recall-3 → pairwise → cache.
 *
 * The judge replaces softMergeScore / embedding cosine in the 'llm' merge mode.
 * It uses an AIProvider (small model) to make pairwise same-event judgments
 * between newcomer items and candidate clusters (identified by entity-overlap
 * recall). Results are cached by content-hash + fingerprint-hash.
 */

import type { AIProvider } from '../AIProvider.js';
import { LogService } from '../LogService.js';
import {
  bootstrapFingerprint,
  extractMiniProfile,
  judgmentCacheKey,
  onMerge,
  recallTopK,
  trySeal,
  type ClusterFingerprint,
  type ItemMiniProfile,
  type JudgmentResult
} from './ClusterFingerprint.js';
import {
  JUDGMENT_SYSTEM_PROMPT,
  REGEN_SYSTEM_PROMPT,
  buildJudgmentUserPrompt,
  buildRegenUserPrompt
} from './llmJudgePrompt.js';
import type { HotClusterItem } from './hotEvents.js';

// ── Types ─────────────────────────────────────────────────────────────────

export interface FingerprintStore {
  loadAll(): Promise<ClusterFingerprint[]>;
  save(fp: ClusterFingerprint): Promise<void>;
  delete(eventId: string): Promise<void>;
}

export interface JudgmentCacheStore {
  get(key: string): Promise<JudgmentResult | null>;
  set(key: string, result: JudgmentResult, ttlMinutes: number): Promise<void>;
}

export interface LLMJudgeOptions {
  provider: AIProvider;
  store: FingerprintStore;
  cache: JudgmentCacheStore;
  maxJudgmentsPerRun: number;
  cacheTtlMinutes: number;
  sealAfterMs: number;
  windowMs: number;
}

interface JudgmentBatchEntry {
  item: ItemMiniProfile;
  candidates: ClusterFingerprint[];
  cacheKey: string;
}

// ── In-memory cache (fast path) ────────────────────────────────────────────

const memCache = new Map<string, { result: JudgmentResult; expiresAt: number }>();

function memCacheGet(key: string): JudgmentResult | null {
  const entry = memCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memCache.delete(key);
    return null;
  }
  return entry.result;
}

function memCacheSet(key: string, result: JudgmentResult, ttlMinutes: number): void {
  memCache.set(key, {
    result,
    expiresAt: Date.now() + ttlMinutes * 60 * 1000
  });
  // Prune if too large
  if (memCache.size > 5000) {
    const now = Date.now();
    for (const [k, v] of memCache) {
      if (now > v.expiresAt) memCache.delete(k);
    }
  }
}

// ── Judge ──────────────────────────────────────────────────────────────────

export class LLMMergeJudge {
  private judgmentCount = 0;
  private fingerprints: ClusterFingerprint[] = [];
  private dirtyFingerprints = new Set<string>();

  constructor(private opts: LLMJudgeOptions) {}

  async loadFingerprints(): Promise<void> {
    this.fingerprints = await this.opts.store.loadAll();
  }

  getFingerprints(): ClusterFingerprint[] {
    return this.fingerprints;
  }

  getOrCreateFingerprint(eventId: string, seedItem?: HotClusterItem): ClusterFingerprint | null {
    const existing = this.fingerprints.find((f) => f.eventId === eventId);
    if (existing) return existing;

    if (!seedItem) return null;
    const profile = extractMiniProfile(seedItem);
    const fp = bootstrapFingerprint(eventId, profile);
    this.fingerprints.push(fp);
    this.dirtyFingerprints.add(eventId);
    return fp;
  }

  /**
   * Try to attach an item to an existing cluster via recall-3 → pairwise → cache.
   * Returns the matched eventId, or null if no match.
   */
  async tryAttach(
    item: HotClusterItem,
    stickyEventIds: string[]
  ): Promise<string | null> {
    if (this.judgmentCount >= this.opts.maxJudgmentsPerRun) {
      LogService.warn(`LLM judge: max judgments reached (${this.opts.maxJudgmentsPerRun})`);
      return null;
    }

    const profile = extractMiniProfile(item);

    // Filter to active fingerprints within a reasonable time window
    const itemTime = Date.parse(item.published_date) || Date.now();
    const activeFps = this.fingerprints.filter((fp) => {
      if (stickyEventIds.includes(fp.eventId)) return true;
      const fpTime = Date.parse(fp.lastUpdated) || 0;
      return Math.abs(itemTime - fpTime) <= this.opts.windowMs * 4;
    });

    if (activeFps.length === 0) return null;

    // Recall top-3 by entity overlap
    const candidates = recallTopK(profile, activeFps, this.opts.windowMs, 3);
    if (candidates.length === 0) return null;

    // Check cache + collect uncached pairs
    const batch: JudgmentBatchEntry[] = [];
    for (const fp of candidates) {
      const key = judgmentCacheKey(profile, fp);

      // Memory cache
      const memHit = memCacheGet(key);
      if (memHit) {
        if (memHit.sameEvent && memHit.confidence >= 0.6) {
          this.onMatch(fp, profile);
          return fp.eventId;
        }
        continue;
      }

      // Persistent cache
      const dbHit = await this.opts.cache.get(key);
      if (dbHit) {
        memCacheSet(key, dbHit, this.opts.cacheTtlMinutes);
        if (dbHit.sameEvent && dbHit.confidence >= 0.6) {
          this.onMatch(fp, profile);
          return fp.eventId;
        }
        continue;
      }

      batch.push({ item: profile, candidates: [fp], cacheKey: key });
    }

    if (batch.length === 0) return null;

    // Batch LLM call for uncached pairs
    const judgments = await this.batchJudge(batch);
    if (!judgments) return null; // LLM failed

    for (let i = 0; i < batch.length; i++) {
      const result = judgments[i];
      if (!result) continue;

      const fp = batch[i].candidates[0];
      const key = batch[i].cacheKey;

      // Cache the result
      memCacheSet(key, result, this.opts.cacheTtlMinutes);
      await this.opts.cache.set(key, result, this.opts.cacheTtlMinutes);
      this.judgmentCount++;

      if (result.sameEvent && result.confidence >= 0.6) {
        this.onMatch(fp, profile);
        return fp.eventId;
      }
    }

    return null;
  }

  private onMatch(fp: ClusterFingerprint, profile: ItemMiniProfile): void {
    const { promoted } = onMerge(fp, profile);
    this.dirtyFingerprints.add(fp.eventId);
    if (promoted.length > 0) {
      LogService.info(
        `LLM judge: promoted ${promoted.length} claim(s) for ${fp.eventId}: ${promoted.join(', ')}`
      );
    }
  }

  /**
   * Batch judge multiple pairs in a single LLM call.
   * Each entry is a single (item, candidate) pair.
   */
  private async batchJudge(
    batch: JudgmentBatchEntry[]
  ): Promise<JudgmentResult[] | null> {
    if (batch.length === 0) return [];

    try {
      // For simplicity, judge each pair individually but could be batched
      // into a single prompt with multiple candidate clusters.
      // For now, we group by item and judge against multiple candidates at once.

      const results: JudgmentResult[] = [];

      // Group entries by item (same item may have multiple candidates)
      const byItem = new Map<string, JudgmentBatchEntry[]>();
      for (const entry of batch) {
        const key = entry.item.itemId;
        const group = byItem.get(key);
        if (group) {
          group.push(entry);
        } else {
          byItem.set(key, [entry]);
        }
      }

      for (const [, entries] of byItem) {
        const item = entries[0].item;
        const candidates = entries.map((e) => e.candidates[0]);

        const userPrompt = buildJudgmentUserPrompt(item, candidates);
        const response = await this.opts.provider.generateContent(
          userPrompt,
          [],
          JUDGMENT_SYSTEM_PROMPT
        );

        const parsed = parseJudgmentResponse(response, candidates.length);

        for (let i = 0; i < entries.length; i++) {
          results.push(parsed[i] || {
            sameEvent: false,
            confidence: 0,
            reason: 'parse_failed'
          });
        }
      }

      return results;
    } catch (err) {
      LogService.warn(`LLM judge batch failed: ${err}`);
      return null;
    }
  }

  /**
   * Regenerate fingerprints for dirty (unsealed, promoted) clusters.
   * Called once at the end of a merge run.
   */
  async regenerateDirtyFingerprints(): Promise<void> {
    const dirty = this.fingerprints.filter(
      (fp) => this.dirtyFingerprints.has(fp.eventId) && !fp.sealed
    );

    for (const fp of dirty) {
      trySeal(fp, this.opts.sealAfterMs);
      if (fp.sealed) {
        this.dirtyFingerprints.delete(fp.eventId);
        continue;
      }

      // Only regenerate if there are cross-verified claims to distill
      const hasPromotable = fp.pendingClaims.some((c) => c.sources >= 2);
      if (!hasPromotable) {
        this.dirtyFingerprints.delete(fp.eventId);
        continue;
      }

      try {
        const userPrompt = buildRegenUserPrompt(fp);
        const response = await this.opts.provider.generateContent(
          userPrompt,
          [],
          REGEN_SYSTEM_PROMPT
        );

        const parsed = parseRegenResponse(response);
        if (parsed) {
          if (parsed.seedFingerprint && parsed.seedFingerprint !== fp.seedFingerprint) {
            fp.seedFingerprint = parsed.seedFingerprint;
          }
          if (parsed.discriminators && parsed.discriminators.length > 0) {
            // Merge, don't replace — keep existing discriminators that are still valid
            for (const d of parsed.discriminators) {
              if (!fp.discriminators.includes(d)) {
                fp.discriminators.push(d);
              }
            }
          }
          fp.sealed = true;
          fp.lastUpdated = new Date().toISOString();
        }
      } catch (err) {
        LogService.warn(`LLM judge: fingerprint regen failed for ${fp.eventId}: ${err}`);
      }

      this.dirtyFingerprints.delete(fp.eventId);
    }

    // Persist all dirty fingerprints
    for (const fp of this.fingerprints) {
      await this.opts.store.save(fp);
    }
  }

  getJudgmentCount(): number {
    return this.judgmentCount;
  }
}

// ── Response parsing ───────────────────────────────────────────────────────

function parseJudgmentResponse(
  response: { content?: string | unknown },
  expectedCount: number
): JudgmentResult[] {
  const text = extractText(response);
  if (!text) {
    return Array.from({ length: expectedCount }, () => ({
      sameEvent: false,
      confidence: 0,
      reason: 'empty_response'
    }));
  }

  try {
    // Extract JSON from response (may have surrounding text)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('no JSON found');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const judgments = parsed.judgments || parsed.results || [];

    return Array.from({ length: expectedCount }, (_, i) => {
      const j = judgments[i];
      if (!j) {
        return { sameEvent: false, confidence: 0, reason: 'missing' };
      }
      return {
        sameEvent: Boolean(j.same_event),
        confidence: Number(j.confidence) || 0,
        reason: String(j.reason || '')
      };
    });
  } catch {
    return Array.from({ length: expectedCount }, () => ({
      sameEvent: false,
      confidence: 0,
      reason: 'parse_error'
    }));
  }
}

function parseRegenResponse(
  response: { content?: string | unknown }
): { seedFingerprint: string; discriminators: string[] } | null {
  const text = extractText(response);
  if (!text) return null;

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      seedFingerprint: String(parsed.seedFingerprint || parsed.seed_fingerprint || ''),
      discriminators: Array.isArray(parsed.discriminators)
        ? parsed.discriminators.map(String)
        : []
    };
  } catch {
    return null;
  }
}

function extractText(response: { content?: string | unknown }): string | null {
  if (!response) return null;
  if (typeof response.content === 'string') return response.content;
  if (Array.isArray(response.content)) {
    return response.content
      .map((part: unknown) =>
        typeof part === 'string'
          ? part
          : part && typeof part === 'object' && 'text' in part
            ? String((part as { text: unknown }).text)
            : ''
      )
      .join('');
  }
  // Some providers return text directly
  if (typeof response === 'string') return response;
  return null;
}
