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
const SINGLE_ENTITY_TEXT_MIN = 0.5;
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
  if (!withinClusterPublishWindow(a.members, b.members)) {
    const ta = newestMs(a.members);
    const tb = newestMs(b.members);
    if (!Number.isFinite(ta) || !Number.isFinite(tb) || ta <= 0 || tb <= 0) {
      return zeroScore('bad_time');
    }
    return zeroScore('time_window');
  }

  const oldestA = pickOldestMember(a.members);
  const oldestB = pickOldestMember(b.members);
  const ea = oldestA ? collectEntities([oldestA]) : [];
  const eb = oldestB ? collectEntities([oldestB]) : [];
  const na = oldestA ? collectNumbers([oldestA]) : [];
  const nb = oldestB ? collectNumbers([oldestB]) : [];
  const hasEntityA = ea.length > 0;
  const hasEntityB = eb.length > 0;
  const hasNumA = na.length > 0;
  const hasNumB = nb.length > 0;

  if ((!hasEntityA && !hasNumA) || (!hasEntityB && !hasNumB)) {
    return zeroScore('no_anchors');
  }

  const textA = oldestA ? memberContentText(oldestA) : '';
  const textB = oldestB ? memberContentText(oldestB) : '';
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
  // Versioned product names (kimik3 / claudeopus5 / gpt5) are strong event anchors
  // even when Chinese summary tokenization yields low text overlap.
  let strongProduct = false;
  if (specificAvailable && interSpecific > 0) {
    for (const t of sa) {
      if (sb.has(t) && /\d/.test(t)) {
        strongProduct = true;
        break;
      }
    }
  }
  let entitySignal = 0;
  if (specificAvailable && interSpecific > 0) {
    const floor = interSpecific >= 2 || strongProduct ? 0.85 : 0.7;
    entitySignal = Math.max(ej, entityOverlap, floor);
  }

  if (specificAvailable && interSpecific > 0 && entitySignal < ENTITY_JACCARD_FLOOR) {
    return zeroScore('entity_floor');
  }

  // Content similarity anchors on each cluster's oldest solid member (not tip).
  const textOverlap = titleTokenOverlap(textA, textB);
  const numbersOverlap = setOverlapRatio(normalizeNumberSet(na), normalizeNumberSet(nb));
  const factsOverlap = titleTokenOverlap(
    oldestA ? joinFacts([oldestA]) : '',
    oldestB ? joinFacts([oldestB]) : ''
  );

  const sigA = oldestA ? normalizeEventSignature(oldestA.metadata?.event_signature) : null;
  const sigB = oldestB ? normalizeEventSignature(oldestB.metadata?.event_signature) : null;
  const signaturesDiverge = Boolean(sigA && sigB && sigA !== sigB);
  const weakTextSingleEntity =
    interSpecific === 1 &&
    textOverlap < TEXT_OVERLAP_GUARD &&
    numbersOverlap === 0;

  // Rules fallback only: one shared entity + low text is too weak (incl. stray product names).
  if (
    weakTextSingleEntity &&
    (signaturesDiverge || (!strongProduct && entitySignal >= ENTITY_JACCARD_FLOOR))
  ) {
    return {
      ok: false,
      score: 0,
      textOverlap,
      entityJaccard: entitySignal,
      numbersOverlap,
      factsOverlap,
      reason: signaturesDiverge ? 'signature_diverge' : 'overmerge_guard'
    };
  }

  if (
    !strongProduct &&
    interSpecific === 1 &&
    textOverlap < SINGLE_ENTITY_TEXT_MIN &&
    numbersOverlap === 0
  ) {
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

  // Same versioned product (Kimi K3 / Opus 5) within the tip window is enough —
  // Chinese token overlap often understates paraphrase of the same release.
  const ok =
    score >= SCORE_MIN ||
    (strongProduct && interSpecific >= 1 && entitySignal >= 0.85);

  return {
    ok,
    score: ok ? Math.max(score, SCORE_MIN) : score,
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
  return clusters.map((c) => finalizeOneCluster(c, previousEventIds, claimed));
}

/** Assign a stable evt_* id to a single cluster (shared `claimed` avoids collisions in a run). */
export function finalizeOneCluster(
  cluster: { signatureNorm: string | null; members: HotClusterItem[] },
  previousEventIds?: Map<string, string>,
  claimed?: Set<string>
): MergedStoryCluster {
  const eventId = assignEventId(
    cluster.members,
    cluster.signatureNorm,
    previousEventIds,
    claimed
  );
  claimed?.add(eventId);
  return {
    eventId,
    signatureNorm: cluster.signatureNorm,
    members: cluster.members
  };
}

/**
 * Chronological soft-merge: process clusters from oldest seed → newest,
 * attaching each into the best existing match. Matches the product rule
 * "new article vs current tip (time) / vs oldest seed (content)" and avoids
 * pairwise greed where late follow-ups clump first then exceed the tip window.
 */
export function softMergeClustersChronological(
  clusters: Array<{ signatureNorm: string | null; members: HotClusterItem[] }>,
  scorePair: (
    existing: { signatureNorm: string | null; members: HotClusterItem[] },
    incoming: { signatureNorm: string | null; members: HotClusterItem[] }
  ) => { ok: boolean; score: number }
): Array<{ signatureNorm: string | null; members: HotClusterItem[] }> {
  const pending = clusters
    .map((c) => ({
      signatureNorm: c.signatureNorm,
      members: [...c.members]
    }))
    .sort((a, b) => oldestMs(a.members) - oldestMs(b.members));

  const result: Array<{ signatureNorm: string | null; members: HotClusterItem[] }> = [];
  for (const neu of pending) {
    let bestIdx = -1;
    let bestScore = -1;
    for (let i = 0; i < result.length; i++) {
      const scored = scorePair(result[i], neu);
      if (!scored.ok) continue;
      if (scored.score > bestScore) {
        bestScore = scored.score;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0) {
      result[bestIdx] = {
        signatureNorm: pickNorm(result[bestIdx].signatureNorm, neu.signatureNorm),
        members: [...result[bestIdx].members, ...neu.members]
      };
    } else {
      result.push(neu);
    }
  }
  return result;
}

function softMergeClusters(
  clusters: Array<{ signatureNorm: string | null; members: HotClusterItem[] }>
): Array<{ signatureNorm: string | null; members: HotClusterItem[] }> {
  return softMergeClustersChronological(clusters, (a, b) => {
    const s = softMergeScore(a, b);
    return { ok: s.ok, score: s.score };
  });
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

function memberContentText(m: HotClusterItem): string {
  const short =
    typeof m.metadata?.ai_summary_short === 'string' ? m.metadata.ai_summary_short.trim() : '';
  return short || m.title || '';
}

/** Content-similarity anchor: oldest among solid-scored members (event seed).
 * Tip / time gates still use the true newest member separately.
 */
export function pickClusterSeedMember(members: HotClusterItem[]): HotClusterItem | undefined {
  const solid = members.filter((m) => (Number(m.metadata?.ai_score) || 0) >= 70);
  const pool = solid.length > 0 ? solid : members;
  let best: HotClusterItem | undefined;
  let bestMs = Number.POSITIVE_INFINITY;
  for (const m of pool) {
    const t = Date.parse(m.published_date) || 0;
    if (t > 0 && t < bestMs) {
      bestMs = t;
      best = m;
    }
  }
  return best ?? members[0];
}

function pickOldestMember(members: HotClusterItem[]): HotClusterItem | undefined {
  return pickClusterSeedMember(members);
}

function pickCompareText(members: HotClusterItem[]): string {
  const oldest = pickClusterSeedMember(members);
  return oldest ? memberContentText(oldest) : '';
}

/**
 * Text used for content similarity (rules overlap + embedding cosine).
 * Always the cluster's oldest member — tip drift must not retarget the anchor.
 * Time gates use withinClusterPublishWindow (tip-vs-tip) separately.
 */
export function pickClusterCompareText(members: HotClusterItem[]): string {
  return pickCompareText(members);
}

export function isLowInfoCompareText(text: string): boolean {
  return isLowInfoText(text);
}

export function clusterNewestMs(members: HotClusterItem[]): number {
  return newestMs(members);
}

export function clusterOldestMs(members: HotClusterItem[]): number {
  return oldestMs(members);
}

/**
 * Merge/attach time gate only (not board age / heat / period span).
 *
 * Gate: the newer tip must be within MAX_PUBLISH_DELTA_MS of the other
 * side's current tip (上一条最新). Total cluster span may exceed 36h when
 * coverage continues in a chain. Board heat / realtime / week-month filters
 * still use clusterNewestMs.
 */
export function withinClusterPublishWindow(
  a: HotClusterItem[],
  b: HotClusterItem[]
): boolean {
  const newestA = newestMs(a);
  const newestB = newestMs(b);
  if (!Number.isFinite(newestA) || !Number.isFinite(newestB) || newestA <= 0 || newestB <= 0) {
    return false;
  }
  return Math.abs(newestA - newestB) <= MAX_PUBLISH_DELTA_MS;
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
  return Math.max(...members.map((m) => Date.parse(m.published_date) || 0), 0);
}

function oldestMs(members: HotClusterItem[]): number {
  let min = Number.POSITIVE_INFINITY;
  for (const m of members) {
    const t = Date.parse(m.published_date) || 0;
    if (t > 0 && t < min) min = t;
  }
  return Number.isFinite(min) ? min : 0;
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
