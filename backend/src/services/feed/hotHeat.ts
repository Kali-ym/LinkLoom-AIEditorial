export const OTHER_SCORE_WEIGHT = 0.3;

/** max + 0.3 × (sum − max); non-finite scores treated as 0. */
export function computeClusterQuality(scores: number[]): number {
  const cleaned = scores.map((s) => (typeof s === 'number' && Number.isFinite(s) ? s : 0));
  if (cleaned.length === 0) return 0;
  const maxScore = Math.max(...cleaned);
  const sum = cleaned.reduce((a, b) => a + b, 0);
  return maxScore + OTHER_SCORE_WEIGHT * (sum - maxScore);
}

export function computeHeat(input: {
  quality: number;
  sourceCount: number;
  ageHours: number;
  hasPicked: boolean;
  halfLifeHours?: number;
  /** When false, skip recency decay (week / month boards). Default true. */
  applyDecay?: boolean;
}): number {
  const pickBoost = input.hasPicked ? 1.25 : 1;
  const sources = Math.max(1, input.sourceCount);
  const q = Math.max(0, input.quality);
  const recency =
    input.applyDecay === false
      ? 1
      : Math.pow(0.5, Math.max(0, input.ageHours) / (input.halfLifeHours ?? 8));
  return Math.round(q * Math.log2(1 + sources) * recency * pickBoost);
}
