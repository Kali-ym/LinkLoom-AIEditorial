import type { HotClusterItem } from './hotEvents.js';
import { specificEntitySet } from './normalizeEntity.js';
import {
  MAX_PUBLISH_DELTA_MS,
  clusterNewestMs,
  collectClusterEntities,
  isLowInfoCompareText,
  pickClusterCompareText,
  softMergeClustersWith,
  titleTokenOverlap
} from './mergeHotStories.js';
import { cosineSimilarity, type EmbedTextsFn } from './hotEmbed.js';

const HYBRID_TEXT_CANDIDATE_MIN = 0.2;

export type ProvisionalCluster = {
  signatureNorm: string | null;
  members: HotClusterItem[];
};

function withinTimeWindow(a: ProvisionalCluster, b: ProvisionalCluster): boolean {
  const ta = clusterNewestMs(a.members);
  const tb = clusterNewestMs(b.members);
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return false;
  return Math.abs(ta - tb) <= MAX_PUBLISH_DELTA_MS;
}

export function passesEmbeddingGuards(a: ProvisionalCluster, b: ProvisionalCluster): boolean {
  if (!withinTimeWindow(a, b)) return false;
  const textA = pickClusterCompareText(a.members);
  const textB = pickClusterCompareText(b.members);
  if (isLowInfoCompareText(textA) || isLowInfoCompareText(textB)) return false;
  return true;
}

function passesGuards(a: ProvisionalCluster, b: ProvisionalCluster): boolean {
  return passesEmbeddingGuards(a, b);
}

/** Hybrid: only embed pairs that already look related by rules-lite signals. */
export function isEmbeddingCandidate(a: ProvisionalCluster, b: ProvisionalCluster): boolean {
  if (!passesGuards(a, b)) return false;
  const sa = specificEntitySet(collectClusterEntities(a.members));
  const sb = specificEntitySet(collectClusterEntities(b.members));
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter += 1;
  if (inter > 0) return true;
  const textOverlap = titleTokenOverlap(
    pickClusterCompareText(a.members),
    pickClusterCompareText(b.members)
  );
  return textOverlap >= HYBRID_TEXT_CANDIDATE_MIN;
}

/**
 * Embedding soft-merge. When `requireCandidateFilter` is true (hybrid),
 * only pairs that pass `isEmbeddingCandidate` are considered.
 */
export async function softMergeByEmbedding(
  clusters: ProvisionalCluster[],
  embed: EmbedTextsFn,
  similarityMin: number,
  opts?: { requireCandidateFilter?: boolean }
): Promise<ProvisionalCluster[] | null> {
  const requireFilter = opts?.requireCandidateFilter === true;

  // Precompute texts + vectors for all clusters
  const texts = clusters.map((c) => pickClusterCompareText(c.members));
  const vectors = await embed(texts);
  if (!vectors) return null;

  const sim = (i: number, j: number): number => {
    const va = vectors[i];
    const vb = vectors[j];
    if (!va?.length || !vb?.length || va.length !== vb.length) return 0;
    return cosineSimilarity(va, vb);
  };

  // Index map: after merges, member sets change — recompute by embedding
  // representative text each round would be expensive; instead greedy on
  // original indices then map. Simpler approach: iterative with re-embed
  // of merged cluster text only when merged (cache by text).

  let current = clusters.map((c) => ({
    signatureNorm: c.signatureNorm,
    members: [...c.members]
  }));

  // Build vector cache keyed by compare text
  const vecByText = new Map<string, number[]>();
  for (let i = 0; i < clusters.length; i++) {
    const t = texts[i].trim();
    if (vectors[i]) vecByText.set(t, vectors[i]);
  }

  const getVec = async (c: ProvisionalCluster): Promise<number[] | null> => {
    const t = pickClusterCompareText(c.members).trim();
    const hit = vecByText.get(t);
    if (hit) return hit;
    const batch = await embed([t]);
    if (!batch?.[0]) return null;
    vecByText.set(t, batch[0]);
    return batch[0];
  };

  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < current.length; i++) {
      for (let j = i + 1; j < current.length; j++) {
        const a = current[i];
        const b = current[j];
        if (requireFilter) {
          if (!isEmbeddingCandidate(a, b)) continue;
        } else if (!passesGuards(a, b)) {
          continue;
        }
        const va = await getVec(a);
        const vb = await getVec(b);
        if (!va || !vb) return null;
        if (cosineSimilarity(va, vb) < similarityMin) continue;

        current[i] = {
          signatureNorm:
            a.signatureNorm && b.signatureNorm
              ? a.signatureNorm <= b.signatureNorm
                ? a.signatureNorm
                : b.signatureNorm
              : a.signatureNorm || b.signatureNorm,
          members: [...a.members, ...b.members]
        };
        current.splice(j, 1);
        merged = true;
        break outer;
      }
    }
  }

  return current;
}
