/**
 * ClusterFingerprint — LLM-maintained cluster identity for hot story merge.
 *
 * Design principles:
 * - seedFingerprint is nearly immutable; only changes when a pending claim
 *   gets cross-verified (sources >= 2) and promoted to discriminator.
 * - aliases accumulate on every merge, replacing normalizeEntity.ts heuristics.
 * - pendingClaims act as a staging area: single-source facts stay pending
 *   until a second independent report confirms them.
 * - Cold start is zero-LLM: the first fingerprint is assembled from
 *   structured signals already produced by the AI scoring stage.
 */

import { createHash } from 'node:crypto';
import type { HotClusterItem } from './hotEvents.js';

// ── Types ─────────────────────────────────────────────────────────────────

export interface AliasEntry {
  canonical: string;
  surface: string;
  addedAt: string;
}

export interface PendingClaim {
  claim: string;
  sources: number;
  firstSeenAt: string;
}

export interface ClusterFingerprint {
  eventId: string;
  seedFingerprint: string;
  discriminators: string[];
  aliases: AliasEntry[];
  pendingClaims: PendingClaim[];
  memberCount: number;
  lastUpdated: string;
  sealed: boolean;
}

export interface ItemMiniProfile {
  itemId: string;
  signature: string;
  entities: string[];
  numbers: string[];
  keyFacts: string[];
  summaryShort: string;
  publishedAt: string;
  contentHash: string;
}

export interface JudgmentResult {
  sameEvent: boolean;
  confidence: number;
  reason: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function nowISO(): string {
  return new Date().toISOString();
}

function metaString(meta: Record<string, unknown> | undefined, key: string): string {
  const v = meta?.[key];
  return typeof v === 'string' ? v.trim() : '';
}

function metaStringArray(meta: Record<string, unknown> | undefined, key: string): string[] {
  const v = meta?.[key];
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }
  return [];
}

function hashContent(text: string): string {
  return createHash('sha256').update(text.trim(), 'utf8').digest('hex').slice(0, 16);
}

export function fingerprintHash(fp: ClusterFingerprint): string {
  return hashContent(`${fp.eventId}::${fp.seedFingerprint}::${fp.lastUpdated}`);
}

// ── Mini profile extraction (zero LLM) ────────────────────────────────────

export function extractMiniProfile(item: HotClusterItem): ItemMiniProfile {
  const meta = item.metadata || {};
  const signature = metaString(meta, 'event_signature');
  const entities = metaStringArray(meta, 'entities');
  const numbers = metaStringArray(meta, 'numbers');
  const keyFacts = metaStringArray(meta, 'key_facts');
  const summaryShort = metaString(meta, 'ai_summary_short') || item.title || '';

  const contentForHash = [
    signature,
    entities.join(','),
    numbers.join(','),
    keyFacts.join(','),
    summaryShort
  ].join('|');

  return {
    itemId: item.id,
    signature,
    entities,
    numbers,
    keyFacts,
    summaryShort,
    publishedAt: item.published_date || '',
    contentHash: hashContent(contentForHash)
  };
}

// ── Cold start: bootstrap fingerprint from seed member (zero LLM) ──────────

export function bootstrapFingerprint(
  eventId: string,
  seed: ItemMiniProfile
): ClusterFingerprint {
  const topEntities = seed.entities.slice(0, 3);
  const fingerprintParts = [
    ...topEntities,
    seed.signature.replace(/\s+/g, ' ').trim()
  ].filter(Boolean);

  return {
    eventId,
    seedFingerprint: fingerprintParts.join(' + '),
    discriminators: seed.summaryShort ? [seed.summaryShort] : [],
    aliases: seed.entities.map((e) => ({
      canonical: e,
      surface: e,
      addedAt: nowISO()
    })),
    pendingClaims: seed.keyFacts.map((fact) => ({
      claim: fact,
      sources: 1,
      firstSeenAt: nowISO()
    })),
    memberCount: 1,
    lastUpdated: nowISO(),
    sealed: false
  };
}

// ── Merge post-processing: update fingerprint after attaching a member ─────

export function onMerge(
  fp: ClusterFingerprint,
  item: ItemMiniProfile
): { promoted: string[] } {
  const promoted: string[] = [];

  // 1. Always append new aliases
  for (const entity of item.entities) {
    const exists = fp.aliases.some((a) => a.surface === entity);
    if (!exists) {
      fp.aliases.push({
        canonical: entity,
        surface: entity,
        addedAt: nowISO()
      });
    }
  }

  // 2. Accumulate pending claims
  for (const fact of item.keyFacts) {
    const existing = fp.pendingClaims.find((c) => c.claim === fact);
    if (existing) {
      existing.sources += 1;
      if (existing.sources >= 2 && !fp.discriminators.includes(fact)) {
        fp.discriminators.push(fact);
        promoted.push(fact);
      }
    } else {
      fp.pendingClaims.push({
        claim: fact,
        sources: 1,
        firstSeenAt: nowISO()
      });
    }
  }

  // 3. If claims were promoted, unseal for potential regeneration
  if (promoted.length > 0 && fp.sealed) {
    fp.sealed = false;
  }

  fp.memberCount += 1;
  fp.lastUpdated = nowISO();

  return { promoted };
}

// ── Seal check: a cluster can be sealed when no recent promotions ──────────

export function trySeal(fp: ClusterFingerprint, sealAfterMs: number): boolean {
  if (fp.sealed) return true;
  const hasPendingPromotable = fp.pendingClaims.some((c) => c.sources >= 2);
  if (hasPendingPromotable) return false;

  const elapsed = Date.now() - new Date(fp.lastUpdated).getTime();
  if (elapsed >= sealAfterMs) {
    fp.sealed = true;
    return true;
  }
  return false;
}

// ── Recall: entity overlap scoring (zero LLM, O(1) set ops) ────────────────

export function computeEntityOverlap(
  item: ItemMiniProfile,
  fp: ClusterFingerprint
): number {
  if (item.entities.length === 0 || fp.aliases.length === 0) return 0;

  const itemEntitySet = new Set(
    item.entities.map((e) => e.trim().toLowerCase().replace(/[\s\-_./]+/g, ''))
  );

  const aliasSurfaceSet = new Set(
    fp.aliases.map((a) => a.surface.trim().toLowerCase().replace(/[\s\-_./]+/g, ''))
  );

  let intersection = 0;
  for (const e of itemEntitySet) {
    if (aliasSurfaceSet.has(e)) intersection++;
  }

  // Jaccard-like score weighted toward intersection
  const union = itemEntitySet.size + aliasSurfaceSet.size - intersection;
  return union > 0 ? intersection / union : 0;
}

export function computeNumberOverlap(
  item: ItemMiniProfile,
  fp: ClusterFingerprint
): boolean {
  if (item.numbers.length === 0) return false;
  const fpNumbers = new Set(
    fp.pendingClaims
      .map((c) => c.claim)
      .concat(fp.discriminators)
      .join(' ')
      .match(/\d+/g) || []
  );
  if (fpNumbers.size === 0) return false;
  return item.numbers.some((n) => fpNumbers.has(n.replace(/\D/g, '')));
}

// ── Recall top-K candidates ────────────────────────────────────────────────

export function recallTopK(
  item: ItemMiniProfile,
  clusters: ClusterFingerprint[],
  windowMs: number,
  k: number = 3
): ClusterFingerprint[] {
  const now = Date.now();
  const candidates: Array<{ fp: ClusterFingerprint; score: number }> = [];

  for (const fp of clusters) {
    // Time window check
    const clusterAge = now - new Date(fp.lastUpdated).getTime();
    if (clusterAge > windowMs * 4) continue; // stale cluster, skip

    const entityOverlap = computeEntityOverlap(item, fp);
    if (entityOverlap === 0) continue;

    const numberBonus = computeNumberOverlap(item, fp) ? 0.1 : 0;
    candidates.push({ fp, score: entityOverlap + numberBonus });
  }

  return candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((c) => c.fp);
}

// ── Cache key ──────────────────────────────────────────────────────────────

export function judgmentCacheKey(
  item: ItemMiniProfile,
  fp: ClusterFingerprint
): string {
  return `${item.contentHash}::${fingerprintHash(fp)}`;
}
