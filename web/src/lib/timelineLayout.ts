/** Shared grid for timeline time · rail · content columns */
export const TIMELINE_GRID =
  'grid grid-cols-[3.25rem_0.625rem_minmax(0,1fr)] sm:grid-cols-[3.75rem_0.625rem_minmax(0,1fr)] gap-x-3 sm:gap-x-4';

export type ScoreBand = 'low' | 'fair' | 'good' | 'high' | 'elite';

/** Score color bands: &lt;60, 60–69, 70–79, 80–89, 90+. */
export function scoreBand(score: number): ScoreBand {
  if (score >= 90) return 'elite';
  if (score >= 80) return 'high';
  if (score >= 70) return 'good';
  if (score >= 60) return 'fair';
  return 'low';
}

export function scoreTone(score: number) {
  const band = scoreBand(score);
  switch (band) {
    case 'elite':
      return {
        band,
        chip: 'border-score-elite/45 bg-score-elite/12',
        text: 'text-score-elite',
        display: 'text-score-elite',
        size: 'text-[1.55rem] sm:text-[1.75rem]',
        glowClass: 'bg-score-elite/35',
        shadow:
          '[text-shadow:0_0_14px_color-mix(in_srgb,var(--ll-score-elite)_45%,transparent)]'
      };
    case 'high':
      return {
        band,
        chip: 'border-score-high/40 bg-score-high/10',
        text: 'text-score-high',
        display: 'text-score-high',
        size: 'text-[1.5rem] sm:text-[1.7rem]',
        glowClass: 'bg-score-high/30',
        shadow:
          '[text-shadow:0_0_12px_color-mix(in_srgb,var(--ll-score-high)_35%,transparent)]'
      };
    case 'good':
      return {
        band,
        chip: 'border-score-good/35 bg-score-good/10',
        text: 'text-score-good',
        display: 'text-score-good',
        size: 'text-[1.4rem] sm:text-[1.55rem]',
        glowClass: 'bg-score-good/22',
        shadow: ''
      };
    case 'fair':
      return {
        band,
        chip: 'border-score-fair/30 bg-score-fair/8',
        text: 'text-score-fair',
        display: 'text-score-fair',
        size: 'text-[1.3rem] sm:text-[1.45rem]',
        glowClass: 'bg-score-fair/20',
        shadow: ''
      };
    default:
      return {
        band,
        chip: 'border-hairline bg-canvas',
        text: 'text-score-low',
        display: 'text-score-low opacity-70',
        size: 'text-[1.2rem] sm:text-[1.3rem]',
        glowClass: 'bg-muted/10',
        shadow: ''
      };
  }
}
