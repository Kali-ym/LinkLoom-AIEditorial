import { specificEntitySet } from './normalizeEntity.js';
import {
  collectClusterEntities,
  isLowInfoCompareText,
  pickClusterCompareText,
  softMergeScore,
  titleTokenOverlap,
  withinClusterPublishWindow
} from './mergeHotStories.js';
import { cosineSimilarity, type EmbedTextsFn } from './hotEmbed.js';

const HYBRID_TEXT_CANDIDATE_MIN = 0.2;

export type ProvisionalCluster = {
  signatureNorm: string | null;
  members: import('./hotEvents.js').HotClusterItem[];
};

export function passesEmbeddingGuards(a: ProvisionalCluster, b: ProvisionalCluster): boolean {
  if (!withinClusterPublishWindow(a.members, b.members)) return false;
  const textA = pickClusterCompareText(a.members);
  const textB = pickClusterCompareText(b.members);
  if (isLowInfoCompareText(textA) || isLowInfoCompareText(textB)) return false;
  return true;
}

/** Hybrid: only embed pairs that already look related by rules-lite signals. */
export function isEmbeddingCandidate(a: ProvisionalCluster, b: ProvisionalCluster): boolean {
  if (!passesEmbeddingGuards(a, b)) return false;
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

function oldestPublishMs(members: ProvisionalCluster['members']): number {
  let min = Number.POSITIVE_INFINITY;
  for (const m of members) {
    const t = Date.parse(m.published_date) || 0;
    if (t > 0 && t < min) min = t;
  }
  return Number.isFinite(min) ? min : 0;
}

/**
 * Embedding soft-merge in chronological attach order.
 * Vectors are anchored on each cluster's oldest-member text.
 * Hybrid: candidate filter + skip pairs that rules hard-veto.
 */
export async function softMergeByEmbedding(
  clusters: ProvisionalCluster[],
  embed: EmbedTextsFn,
  similarityMin: number,
  opts?: { requireCandidateFilter?: boolean }
): Promise<ProvisionalCluster[] | null> {
  const requireFilter = opts?.requireCandidateFilter === true;

  const texts = clusters.map((c) => pickClusterCompareText(c.members));
  const vectors = await embed(texts);
  if (!vectors) return null;

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

  const pending = clusters
    .map((c) => ({
      signatureNorm: c.signatureNorm,
      members: [...c.members]
    }))
    .sort((a, b) => oldestPublishMs(a.members) - oldestPublishMs(b.members));

  const result: ProvisionalCluster[] = [];
  for (const neu of pending) {
    let bestIdx = -1;
    let bestSim = -1;
    for (let i = 0; i < result.length; i++) {
      const existing = result[i];
      if (requireFilter) {
        if (!isEmbeddingCandidate(existing, neu)) continue;
        // Do not let embedding override hard rule vetoes (over-merge guards).
        const rules = softMergeScore(existing, neu);
        if (rules.reason) continue;
      } else if (!passesEmbeddingGuards(existing, neu)) {
        continue;
      }

      const va = await getVec(existing);
      const vb = await getVec(neu);
      if (!va || !vb) return null;
      const sim = cosineSimilarity(va, vb);
      if (sim < similarityMin) continue;
      if (sim > bestSim) {
        bestSim = sim;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0) {
      const existing = result[bestIdx];
      result[bestIdx] = {
        signatureNorm:
          existing.signatureNorm && neu.signatureNorm
            ? existing.signatureNorm <= neu.signatureNorm
              ? existing.signatureNorm
              : neu.signatureNorm
            : existing.signatureNorm || neu.signatureNorm,
        members: [...existing.members, ...neu.members]
      };
    } else {
      result.push(neu);
    }
  }

  return result;
}
