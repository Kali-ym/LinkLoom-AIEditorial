import { createHash } from 'node:crypto';
import type { HotClusterItem } from './hotEvents.js';
import { normalizeEventSignature } from './normalizeEventSignature.js';
import {
  normalizeEntitySet,
  normalizeNumberSet,
  specificEntitySet
} from './normalizeEntity.js';

export interface MergedStoryCluster {
  eventId: string;
  signatureNorm: string | null;
  members: HotClusterItem[];
}

export const MAX_PUBLISH_DELTA_MS = 36 * 3600 * 1000;
const ENTITY_JACCARD_FLOOR = 0.25;
const SCORE_MIN = 0.5;
const TEXT_OVERLAP_GUARD = 0.15;
/** When only one specific entity is shared, demand stronger text agreement. */
const SINGLE_ENTITY_TEXT_MIN = 0.55;
const LOW_INFO_TEXT =
  /转推|广播|直播|话题不明|未说明|未附带|watch now|broadcasts\/|live build/i;

const W_TEXT = 0.4;
const W_ENTITY = 0.35;
const W_NUMBERS = 0.15;
const W_FACTS = 0.1;

export function titleTokenOverlap(a: string, b: string): number {
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  return inter / Math.min(ta.size, tb.size);
}

export function entityJaccard(a: string[], b: string[]): number {
  const sa = normalizeEntitySet(a);
  const sb = normalizeEntitySet(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter += 1;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function setOverlapRatio(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  return inter / Math.min(a.size, b.size);
}

function setJaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

export interface SoftMergeScoreBreakdown {
  ok: boolean;
  score: number;
  textOverlap: number;
  entityJaccard: number;
  numbersOverlap: number;
  factsOverlap: number;
  reason?: string;
}

/**
 * Soft-merge score for two clusters. Used by merge + unit tests.
 */
export function softMergeScore(
  a: { members: HotClusterItem[] },
  b: { members: HotClusterItem[] }
): SoftMergeScoreBreakdown {
  const ta = newestMs(a.members);
  const tb = newestMs(b.members);
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) {
    return zeroScore('bad_time');
  }
  if (Math.abs(ta - tb) > MAX_PUBLISH_DELTA_MS) {
    return zeroScore('time_window');
  }

  const ea = collectEntities(a.members);
  const eb = collectEntities(b.members);
  const na = collectNumbers(a.members);
  const nb = collectNumbers(b.members);
  const hasEntityA = ea.length > 0;
  const hasEntityB = eb.length > 0;
  const hasNumA = na.length > 0;
  const hasNumB = nb.length > 0;

  if ((!hasEntityA && !hasNumA) || (!hasEntityB && !hasNumB)) {
    return zeroScore('no_anchors');
  }

  const textA = pickCompareText(a.members);
  const textB = pickCompareText(b.members);
  if (isLowInfoText(textA) || isLowInfoText(textB)) {
    return zeroScore('low_info');
  }

  const sa = specificEntitySet(ea);
  const sb = specificEntitySet(eb);
  const specificAvailable = sa.size > 0 && sb.size > 0;
  let interSpecific = 0;
  for (const t of sa) if (sb.has(t)) interSpecific += 1;
  const ej = setJaccard(sa, sb);
  const entityOverlap = setOverlapRatio(sa, sb);
  // Shared specific entities are strong even when entity lists have long tails
  let entitySignal = 0;
  if (specificAvailable && interSpecific > 0) {
    const floor = interSpecific >= 2 ? 0.85 : 0.7;
    entitySignal = Math.max(ej, entityOverlap, floor);
  }

  if (specificAvailable && interSpecific > 0 && entitySignal < ENTITY_JACCARD_FLOOR) {
    return zeroScore('entity_floor');
  }

  const textOverlap = titleTokenOverlap(textA, textB);
  const numbersOverlap = setOverlapRatio(normalizeNumberSet(na), normalizeNumberSet(nb));
  const factsOverlap = titleTokenOverlap(joinFacts(a.members), joinFacts(b.members));

  if (
    entitySignal >= ENTITY_JACCARD_FLOOR &&
    textOverlap < TEXT_OVERLAP_GUARD &&
    numbersOverlap === 0
  ) {
    return {
      ok: false,
      score: 0,
      textOverlap,
      entityJaccard: entitySignal,
      numbersOverlap,
      factsOverlap,
      reason: 'overmerge_guard'
    };
  }

  if (interSpecific === 1 && textOverlap < SINGLE_ENTITY_TEXT_MIN && numbersOverlap === 0) {
    return {
      ok: false,
      score: 0,
      textOverlap,
      entityJaccard: entitySignal,
      numbersOverlap,
      factsOverlap,
      reason: 'single_entity_text'
    };
  }

  let wText = W_TEXT;
  let wEntity = W_ENTITY;
  let wNumbers = W_NUMBERS;
  const wFacts = W_FACTS;
  if (!specificAvailable) {
    wText = W_TEXT + 0.2;
    wEntity = 0;
    wNumbers = W_NUMBERS + 0.15;
  }

  const score =
    wText * textOverlap +
    wEntity * entitySignal +
    wNumbers * numbersOverlap +
    wFacts * factsOverlap;

  return {
    ok: score >= SCORE_MIN,
    score,
    textOverlap,
    entityJaccard: entitySignal,
    numbersOverlap,
    factsOverlap
  };
}

/**
 * Hard-merge by normalized event_signature, then optional scored soft-merge.
 * Assigns stable evt_ ids.
 */
export function mergeHotStories(
  items: HotClusterItem[],
  opts?: {
    previousEventIds?: Map<string, string>;
    /** default 'rules'; use 'none' for semantic-only path (hard merge only) */
    softMerge?: 'rules' | 'none';
  }
): MergedStoryCluster[] {
  const byId = new Map<string, HotClusterItem>();
  for (const it of items) {
    if (it?.id) byId.set(it.id, it);
  }
  const all = [...byId.values()];
  if (all.length === 0) return [];

  const buckets = new Map<string, HotClusterItem[]>();
  for (const it of all) {
    const norm = normalizeEventSignature(it.metadata?.event_signature);
    const key = norm || `__solo__:${it.id}`;
    const list = buckets.get(key) || [];
    list.push(it);
    buckets.set(key, list);
  }

  let clusters: Array<{ signatureNorm: string | null; members: HotClusterItem[] }> = [
    ...buckets.entries()
  ].map(([key, members]) => ({
    signatureNorm: key.startsWith('__solo__:') ? null : key,
    members
  }));

  if ((opts?.softMerge ?? 'rules') === 'rules') {
    clusters = softMergeClusters(clusters);
  }

  return finalizeClusters(clusters, opts?.previousEventIds);
}

export function finalizeClusters(
  clusters: Array<{ signatureNorm: string | null; members: HotClusterItem[] }>,
  previousEventIds?: Map<string, string>
): MergedStoryCluster[] {
  const claimed = new Set<string>();
  return clusters.map((c) => {
    const eventId = assignEventId(c.members, c.signatureNorm, previousEventIds, claimed);
    claimed.add(eventId);
    return {
      eventId,
      signatureNorm: c.signatureNorm,
      members: c.members
    };
  });
}

/** Greedy soft-merge using a custom predicate (rules or embedding). */
export function softMergeClustersWith(
  clusters: Array<{ signatureNorm: string | null; members: HotClusterItem[] }>,
  shouldMerge: (
    a: { signatureNorm: string | null; members: HotClusterItem[] },
    b: { signatureNorm: string | null; members: HotClusterItem[] }
  ) => boolean
): Array<{ signatureNorm: string | null; members: HotClusterItem[] }> {
  const result = clusters.map((c) => ({
    signatureNorm: c.signatureNorm,
    members: [...c.members]
  }));
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        if (!shouldMerge(result[i], result[j])) continue;
        result[i] = {
          signatureNorm: pickNorm(result[i].signatureNorm, result[j].signatureNorm),
          members: [...result[i].members, ...result[j].members]
        };
        result.splice(j, 1);
        merged = true;
        break outer;
      }
    }
  }
  return result;
}

function softMergeClusters(
  clusters: Array<{ signatureNorm: string | null; members: HotClusterItem[] }>
): Array<{ signatureNorm: string | null; members: HotClusterItem[] }> {
  return softMergeClustersWith(clusters, (a, b) => softMergeScore(a, b).ok);
}

function zeroScore(reason: string): SoftMergeScoreBreakdown {
  return {
    ok: false,
    score: 0,
    textOverlap: 0,
    entityJaccard: 0,
    numbersOverlap: 0,
    factsOverlap: 0,
    reason
  };
}

function assignEventId(
  members: HotClusterItem[],
  signatureNorm: string | null,
  previous?: Map<string, string>,
  claimed?: Set<string>
): string {
  if (previous && previous.size > 0) {
    const counts = new Map<string, number>();
    for (const m of members) {
      const prev = previous.get(m.id);
      if (!prev) continue;
      counts.set(prev, (counts.get(prev) || 0) + 1);
    }
    let best: string | null = null;
    let bestN = 0;
    for (const [id, n] of counts) {
      if (n > bestN) {
        best = id;
        bestN = n;
      }
    }
    // Reuse only if not already taken by another cluster in this merge run
    // (stale shared event_id after a split would otherwise glue UI selection).
    if (best && best.startsWith('evt_') && !claimed?.has(best)) return best;
  }

  const memberBasis = members
    .map((m) => m.id)
    .sort()
    .join('|');
  const basis = signatureNorm || memberBasis;
  let id = `evt_${createHash('sha1').update(basis).digest('hex').slice(0, 16)}`;
  let salt = 0;
  while (claimed?.has(id)) {
    salt += 1;
    id = `evt_${createHash('sha1')
      .update(`${memberBasis}|${signatureNorm || ''}|${salt}`)
      .digest('hex')
      .slice(0, 16)}`;
  }
  return id;
}

function collectEntities(members: HotClusterItem[]): string[] {
  const out: string[] = [];
  for (const m of members) {
    const ents = m.metadata?.entities;
    if (!Array.isArray(ents)) continue;
    for (const e of ents) {
      if (typeof e === 'string' && e.trim()) out.push(e.trim());
    }
  }
  return out;
}

function collectNumbers(members: HotClusterItem[]): string[] {
  const out: string[] = [];
  for (const m of members) {
    const nums = m.metadata?.numbers;
    if (!Array.isArray(nums)) continue;
    for (const n of nums) {
      if (typeof n === 'string' && n.trim()) out.push(n.trim());
      else if (typeof n === 'number' && Number.isFinite(n)) out.push(String(n));
    }
  }
  return out;
}

function joinFacts(members: HotClusterItem[]): string {
  const parts: string[] = [];
  for (const m of members) {
    const facts = m.metadata?.key_facts;
    if (!Array.isArray(facts)) continue;
    for (const f of facts) {
      if (typeof f === 'string' && f.trim()) parts.push(f.trim());
    }
  }
  return parts.join(' ');
}

function pickCompareText(members: HotClusterItem[]): string {
  const picked = members.filter((m) => m.metadata?.ai_picked === true);
  const pool = picked.length ? picked : members;
  const best = [...pool].sort(
    (a, b) => (Number(b.metadata?.ai_score) || 0) - (Number(a.metadata?.ai_score) || 0)
  )[0];
  if (!best) return '';
  const short =
    typeof best.metadata?.ai_summary_short === 'string'
      ? best.metadata.ai_summary_short.trim()
      : '';
  return short || best.title || '';
}

/** Public alias for embedding text selection. */
export function pickClusterCompareText(members: HotClusterItem[]): string {
  return pickCompareText(members);
}

export function isLowInfoCompareText(text: string): boolean {
  return isLowInfoText(text);
}

export function clusterNewestMs(members: HotClusterItem[]): number {
  return newestMs(members);
}

export function collectClusterEntities(members: HotClusterItem[]): string[] {
  return collectEntities(members);
}

function isLowInfoText(text: string): boolean {
  const t = text.trim();
  if (t.length < 6) return true;
  return LOW_INFO_TEXT.test(t);
}

function newestMs(members: HotClusterItem[]): number {
  return Math.max(...members.map((m) => Date.parse(m.published_date) || 0));
}

function pickNorm(a: string | null, b: string | null): string | null {
  if (a && b) return a <= b ? a : b;
  return a || b;
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .map((t) => t.trim())
      .filter((t) => t.length >= 2)
  );
}
