import type { HotMergeMode } from '../../types/config.js';
import type { HotClusterItem } from './hotEvents.js';
import {
  clusterOldestMs,
  finalizeClusters,
  finalizeOneCluster,
  mergeHotStories,
  pickClusterCompareText,
  pickClusterSeedMember,
  softMergeScore,
  withinClusterPublishWindow,
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
import type { LLMMergeJudge } from './llmMergeJudge.js';

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
    llmJudge?: LLMMergeJudge | null;
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
    if (opts.mergeMode === 'llm' && opts.llmJudge) {
      await opts.llmJudge.regenerateDirtyFingerprints();
    }
    return { ...full, bootstrapped: true };
  }

  // Ensure every sticky cluster has a fingerprint before hard-attach / LLM attach.
  if (opts.mergeMode === 'llm' && opts.llmJudge) {
    for (const s of sticky) {
      const seed = s.members[0];
      if (seed) opts.llmJudge.getOrCreateFingerprint(s.eventId, seed);
    }
  }

  if (unassigned.length === 0) {
    // Still regenerate dirty fingerprints for sealed/unsealed clusters
    if (opts.mergeMode === 'llm' && opts.llmJudge) {
      await opts.llmJudge.regenerateDirtyFingerprints();
    }
    return {
      clusters: sticky.map(toMerged),
      mergeModeApplied: opts.mergeMode,
      bootstrapped: false
    };
  }

  // 1) Hard-attach unassigned items that share a sticky signature.
  const remaining = hardAttachBySignature(sticky, unassigned, opts.llmJudge ?? null);

  const newcomerMerge =
    remaining.length === 0
      ? { clusters: [] as MergedStoryCluster[], mergeModeApplied: opts.mergeMode, fallbackReason: undefined }
      : await fullMerge(remaining, opts);
  const { clusters: newClusters, mergeModeApplied, fallbackReason } = newcomerMerge;

  // 3) Soft-attach each newcomer cluster into the best sticky match; else keep as new event.
  const keptNew: MergedStoryCluster[] = [];

  if (opts.mergeMode === 'llm' && opts.llmJudge) {
    for (const neu of newClusters) {
      const attached = await llmAttachCluster(neu, sticky, opts.llmJudge);
      if (!attached) keptNew.push(neu);
    }
    for (const neu of keptNew) {
      const seed = pickClusterSeedMember(neu.members) || neu.members[0];
      if (seed) opts.llmJudge.getOrCreateFingerprint(neu.eventId, seed);
    }
    await opts.llmJudge.regenerateDirtyFingerprints();
  } else {
    // LLM judge unavailable (mergeMode === 'llm') → fallback to rules.
    // Otherwise (semantic / hybrid / rules) keep the configured mergeMode so
    // embedding still runs for semantic/hybrid attach.
    const attachMode: HotMergeMode = opts.mergeMode === 'llm' ? 'rules' : opts.mergeMode;
    const effectiveFallback =
      opts.mergeMode === 'llm'
        ? fallbackReason || 'llm_unavailable'
        : fallbackReason;
    const effectiveMode = opts.mergeMode === 'llm' ? 'rules' as HotMergeMode : mergeModeApplied;
    for (const neu of newClusters) {
      const attached = await tryAttachToSticky(sticky, neu, {
        mergeMode: attachMode,
        embed: opts.embed,
        similarityMin: opts.similarityMin ?? 0.78
      });
      if (!attached) keptNew.push(neu);
    }
    return {
      clusters: [...sticky.map(toMerged), ...keptNew],
      mergeModeApplied: effectiveMode,
      fallbackReason: effectiveFallback,
      bootstrapped: false
    };
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
    llmJudge?: LLMMergeJudge | null;
  }
): Promise<Omit<IncrementalMergeResult, 'bootstrapped'>> {
  const previousEventIds = collectPreviousEventIds(items);
  let mergeModeApplied: HotMergeMode = opts.mergeMode;
  let fallbackReason: string | undefined;

  if (opts.mergeMode === 'llm') {
    if (!opts.llmJudge) {
      const clusters = mergeHotStories(items, { previousEventIds, softMerge: 'rules' });
      return {
        clusters,
        mergeModeApplied: 'rules',
        fallbackReason: 'llm_unavailable'
      };
    }
    const hardClusters = mergeHotStories(items, { previousEventIds, softMerge: 'none' });
    opts.llmJudge.setJudgmentBudget(
      Math.max(opts.llmJudge.getJudgmentBudget(), hardClusters.length)
    );
    const clusters = await llmChronologicalMerge(
      hardClusters,
      opts.llmJudge,
      previousEventIds
    );
    return { clusters, mergeModeApplied: 'llm', fallbackReason };
  }

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

type ClusterTarget = {
  eventId: string;
  signatureNorm: string | null;
  members: HotClusterItem[];
};

async function llmAttachCluster(
  neu: MergedStoryCluster,
  targets: ClusterTarget[],
  judge: LLMMergeJudge
): Promise<boolean> {
  const rep = pickClusterSeedMember(neu.members);
  if (!rep) return false;

  const matchedId = await judge.tryAttach(
    rep,
    targets.map((t) => ({ eventId: t.eventId, members: t.members }))
  );
  if (!matchedId) return false;

  const idx = targets.findIndex((t) => t.eventId === matchedId);
  if (idx < 0) return false;

  targets[idx].members.push(...neu.members);
  targets[idx].signatureNorm = pickNorm(targets[idx].signatureNorm, neu.signatureNorm);
  const rest = neu.members.filter((m) => m.id !== rep.id);
  if (rest.length > 0) judge.ingestAttachedMembers(matchedId, rest);
  return true;
}

function hardAttachBySignature(
  sticky: MutableCluster[],
  unassigned: HotClusterItem[],
  llmJudge: LLMMergeJudge | null
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
    // Same signature is not enough once the sticky tip has drifted far from its oldest member.
    if (!withinClusterPublishWindow(sticky[idx].members, [it])) {
      remaining.push(it);
      continue;
    }
    sticky[idx].members.push(it);
    sticky[idx].signatureNorm = pickNorm(sticky[idx].signatureNorm, norm);
    // Keep fingerprint aliases / claims in sync with hard-signature membership.
    llmJudge?.ingestAttachedMembers(sticky[idx].eventId, [it]);
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
  // Hard signature match against sticky (still respect publish-window vs oldest member)
  if (neu.signatureNorm) {
    const idx = sticky.findIndex((s) => s.signatureNorm === neu.signatureNorm);
    if (idx >= 0 && withinClusterPublishWindow(sticky[idx].members, neu.members)) {
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

async function llmChronologicalMerge(
  hardClusters: MergedStoryCluster[],
  judge: LLMMergeJudge,
  previousEventIds: Map<string, string>
): Promise<MergedStoryCluster[]> {
  const sorted = [...hardClusters].sort(
    (a, b) => clusterOldestMs(a.members) - clusterOldestMs(b.members)
  );
  const claimed = new Set<string>();
  const kept: MergedStoryCluster[] = [];

  for (const neu of sorted) {
    const attached = await llmAttachCluster(neu, kept, judge);
    if (attached) continue;

    const rep = pickClusterSeedMember(neu.members) || neu.members[0];
    const newCluster = finalizeOneCluster(neu, previousEventIds, claimed);
    if (rep) judge.getOrCreateFingerprint(newCluster.eventId, rep);
    kept.push(newCluster);
  }

  return kept;
}
