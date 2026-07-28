import type { HotMergeMode } from '../../types/config.js';
import type { HotClusterItem } from './hotEvents.js';
import {
  finalizeClusters,
  mergeHotStories,
  pickClusterCompareText,
  softMergeScore,
  type MergedStoryCluster
} from './mergeHotStories.js';
import { normalizeEventSignature } from './normalizeEventSignature.js';
import {
  isEmbeddingCandidate,
  passesEmbeddingGuards,
  softMergeByEmbedding,
  type ProvisionalCluster
} from './semanticSoftMerge.js';
import { cosineSimilarity, type EmbedTextsFn } from './hotEmbed.js';

type MutableCluster = {
  eventId: string;
  signatureNorm: string | null;
  members: HotClusterItem[];
};

export interface IncrementalMergeResult {
  clusters: MergedStoryCluster[];
  mergeModeApplied: HotMergeMode;
  fallbackReason?: string;
  /** True when no sticky event_ids existed and full merge was used. */
  bootstrapped: boolean;
}

/**
 * Pure incremental merge:
 * - Items already carrying evt_* stay in that cluster (never split / never merge two sticky clusters).
 * - Unassigned items hard-match by signature, then soft-match into sticky clusters,
 *   otherwise form new clusters among themselves.
 */
export async function mergeHotStoriesIncremental(
  items: HotClusterItem[],
  opts: {
    mergeMode: HotMergeMode;
    embed?: EmbedTextsFn | null;
    similarityMin?: number;
  }
): Promise<IncrementalMergeResult> {
  const byId = new Map<string, HotClusterItem>();
  for (const it of items) {
    if (it?.id) byId.set(it.id, it);
  }
  const all = [...byId.values()];
  if (all.length === 0) {
    return { clusters: [], mergeModeApplied: opts.mergeMode, bootstrapped: false };
  }

  const sticky: MutableCluster[] = [];
  const stickyIndex = new Map<string, number>();
  const unassigned: HotClusterItem[] = [];

  for (const it of all) {
    const eid = it.metadata?.event_id;
    if (typeof eid === 'string' && eid.startsWith('evt_')) {
      const idx = stickyIndex.get(eid);
      if (idx !== undefined) {
        sticky[idx].members.push(it);
        sticky[idx].signatureNorm = pickNorm(
          sticky[idx].signatureNorm,
          normalizeEventSignature(it.metadata?.event_signature)
        );
      } else {
        stickyIndex.set(eid, sticky.length);
        sticky.push({
          eventId: eid,
          signatureNorm:
            normalizeEventSignature(it.metadata?.event_signature_norm) ||
            normalizeEventSignature(it.metadata?.event_signature),
          members: [it]
        });
      }
    } else {
      unassigned.push(it);
    }
  }

  // Bootstrap: no prior clusters → full merge (existing behavior once).
  if (sticky.length === 0) {
    const full = await fullMerge(all, opts);
    return { ...full, bootstrapped: true };
  }

  if (unassigned.length === 0) {
    return {
      clusters: sticky.map(toMerged),
      mergeModeApplied: opts.mergeMode,
      bootstrapped: false
    };
  }

  // 1) Hard-attach unassigned items that share a sticky signature.
  const remaining = hardAttachBySignature(sticky, unassigned);

  // 2) Cluster remaining newcomers among themselves (never touching sticky membership).
  const { newClusters, mergeModeApplied, fallbackReason } = await clusterNewcomers(
    remaining,
    opts
  );

  // 3) Soft-attach each newcomer cluster into the best sticky match; else keep as new event.
  const keptNew: MergedStoryCluster[] = [];
  for (const neu of newClusters) {
    const attached = await tryAttachToSticky(sticky, neu, {
      mergeMode: mergeModeApplied,
      embed: opts.embed,
      similarityMin: opts.similarityMin ?? 0.78
    });
    if (!attached) keptNew.push(neu);
  }

  return {
    clusters: [...sticky.map(toMerged), ...keptNew],
    mergeModeApplied,
    fallbackReason,
    bootstrapped: false
  };
}

async function fullMerge(
  items: HotClusterItem[],
  opts: {
    mergeMode: HotMergeMode;
    embed?: EmbedTextsFn | null;
    similarityMin?: number;
  }
): Promise<Omit<IncrementalMergeResult, 'bootstrapped'>> {
  const previousEventIds = collectPreviousEventIds(items);
  let mergeModeApplied: HotMergeMode = opts.mergeMode;
  let fallbackReason: string | undefined;

  let clusters = mergeHotStories(items, {
    previousEventIds,
    softMerge: opts.mergeMode === 'semantic' ? 'none' : 'rules'
  });

  if (opts.mergeMode === 'semantic' || opts.mergeMode === 'hybrid') {
    if (!opts.embed) {
      if (opts.mergeMode === 'semantic') {
        clusters = mergeHotStories(items, { previousEventIds, softMerge: 'rules' });
      }
      mergeModeApplied = 'rules';
      fallbackReason = 'embedding_unavailable';
    } else {
      const provisional = clusters.map((c) => ({
        signatureNorm: c.signatureNorm,
        members: c.members
      }));
      const merged = await softMergeByEmbedding(
        provisional,
        opts.embed,
        opts.similarityMin ?? 0.78,
        { requireCandidateFilter: opts.mergeMode === 'hybrid' }
      );
      if (!merged) {
        if (opts.mergeMode === 'semantic') {
          clusters = mergeHotStories(items, { previousEventIds, softMerge: 'rules' });
        }
        mergeModeApplied = 'rules';
        fallbackReason = 'embedding_failed';
      } else {
        clusters = finalizeClusters(merged, previousEventIds);
        mergeModeApplied = opts.mergeMode;
      }
    }
  }

  return { clusters, mergeModeApplied, fallbackReason };
}

async function clusterNewcomers(
  items: HotClusterItem[],
  opts: {
    mergeMode: HotMergeMode;
    embed?: EmbedTextsFn | null;
    similarityMin?: number;
  }
): Promise<{
  newClusters: MergedStoryCluster[];
  mergeModeApplied: HotMergeMode;
  fallbackReason?: string;
}> {
  if (items.length === 0) {
    return { newClusters: [], mergeModeApplied: opts.mergeMode };
  }
  const result = await fullMerge(items, opts);
  return {
    newClusters: result.clusters,
    mergeModeApplied: result.mergeModeApplied,
    fallbackReason: result.fallbackReason
  };
}

function hardAttachBySignature(
  sticky: MutableCluster[],
  unassigned: HotClusterItem[]
): HotClusterItem[] {
  const bySig = new Map<string, number>();
  for (let i = 0; i < sticky.length; i++) {
    const norm = sticky[i].signatureNorm;
    if (norm && !bySig.has(norm)) bySig.set(norm, i);
  }

  const remaining: HotClusterItem[] = [];
  for (const it of unassigned) {
    const norm = normalizeEventSignature(it.metadata?.event_signature);
    const idx = norm ? bySig.get(norm) : undefined;
    if (idx === undefined) {
      remaining.push(it);
      continue;
    }
    sticky[idx].members.push(it);
    sticky[idx].signatureNorm = pickNorm(sticky[idx].signatureNorm, norm);
  }
  return remaining;
}

async function tryAttachToSticky(
  sticky: MutableCluster[],
  neu: MergedStoryCluster,
  opts: {
    mergeMode: HotMergeMode;
    embed?: EmbedTextsFn | null;
    similarityMin: number;
  }
): Promise<boolean> {
  // Hard signature match against sticky
  if (neu.signatureNorm) {
    const idx = sticky.findIndex((s) => s.signatureNorm === neu.signatureNorm);
    if (idx >= 0) {
      sticky[idx].members.push(...neu.members);
      return true;
    }
  }

  if (opts.mergeMode === 'rules') {
    return attachByRules(sticky, neu);
  }

  if (opts.mergeMode === 'semantic' || opts.mergeMode === 'hybrid') {
    if (!opts.embed) {
      return opts.mergeMode === 'semantic' ? false : attachByRules(sticky, neu);
    }
    const attached = await attachByEmbedding(sticky, neu, opts.embed, opts.similarityMin, {
      requireCandidateFilter: opts.mergeMode === 'hybrid'
    });
    if (attached) return true;
    // hybrid: embedding miss → still try rules (rules already ran among newcomers;
    // attaching to sticky via rules is useful).
    if (opts.mergeMode === 'hybrid') return attachByRules(sticky, neu);
    return false;
  }

  return false;
}

function attachByRules(sticky: MutableCluster[], neu: MergedStoryCluster): boolean {
  let bestIdx = -1;
  let bestScore = -1;
  const neuView = { members: neu.members };
  for (let i = 0; i < sticky.length; i++) {
    const breakdown = softMergeScore({ members: sticky[i].members }, neuView);
    if (!breakdown.ok) continue;
    if (breakdown.score > bestScore) {
      bestScore = breakdown.score;
      bestIdx = i;
    }
  }
  if (bestIdx < 0) return false;
  sticky[bestIdx].members.push(...neu.members);
  sticky[bestIdx].signatureNorm = pickNorm(sticky[bestIdx].signatureNorm, neu.signatureNorm);
  return true;
}

async function attachByEmbedding(
  sticky: MutableCluster[],
  neu: MergedStoryCluster,
  embed: EmbedTextsFn,
  similarityMin: number,
  opts: { requireCandidateFilter: boolean }
): Promise<boolean> {
  const neuProv: ProvisionalCluster = {
    signatureNorm: neu.signatureNorm,
    members: neu.members
  };

  const candidates: number[] = [];
  for (let i = 0; i < sticky.length; i++) {
    const stickyProv: ProvisionalCluster = {
      signatureNorm: sticky[i].signatureNorm,
      members: sticky[i].members
    };
    if (opts.requireCandidateFilter) {
      if (!isEmbeddingCandidate(stickyProv, neuProv)) continue;
    } else if (!passesEmbeddingGuards(stickyProv, neuProv)) {
      continue;
    }
    candidates.push(i);
  }
  if (candidates.length === 0) return false;

  const texts = [
    pickClusterCompareText(neu.members),
    ...candidates.map((i) => pickClusterCompareText(sticky[i].members))
  ];
  const vectors = await embed(texts);
  if (!vectors?.[0]) return false;
  const neuVec = vectors[0];

  let bestIdx = -1;
  let bestSim = -1;
  for (let c = 0; c < candidates.length; c++) {
    const vec = vectors[c + 1];
    if (!vec?.length) continue;
    const sim = cosineSimilarity(neuVec, vec);
    if (sim < similarityMin) continue;
    if (sim > bestSim) {
      bestSim = sim;
      bestIdx = candidates[c];
    }
  }
  if (bestIdx < 0) return false;
  sticky[bestIdx].members.push(...neu.members);
  sticky[bestIdx].signatureNorm = pickNorm(sticky[bestIdx].signatureNorm, neu.signatureNorm);
  return true;
}

function collectPreviousEventIds(items: HotClusterItem[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const it of items) {
    const id = it.metadata?.event_id;
    if (typeof id === 'string' && id.startsWith('evt_')) {
      map.set(it.id, id);
    }
  }
  return map;
}

function toMerged(c: MutableCluster): MergedStoryCluster {
  return {
    eventId: c.eventId,
    signatureNorm: c.signatureNorm,
    members: c.members
  };
}

function pickNorm(a: string | null, b: string | null): string | null {
  if (a && b) return a <= b ? a : b;
  return a || b;
}
