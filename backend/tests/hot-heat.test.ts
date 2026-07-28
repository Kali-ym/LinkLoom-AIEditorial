import { describe, expect, it } from 'vitest';
import { computeClusterQuality, computeHeat } from '../src/services/feed/hotHeat.js';

describe('computeClusterQuality', () => {
  it('returns max for a single score', () => {
    expect(computeClusterQuality([88])).toBe(88);
  });

  it('adds 0.3 × sum of non-max scores', () => {
    expect(computeClusterQuality([10, 25])).toBe(28);
    expect(computeClusterQuality([70, 60])).toBe(88);
  });

  it('treats empty as 0 and ignores non-finite', () => {
    expect(computeClusterQuality([])).toBe(0);
    expect(computeClusterQuality([NaN, 40, undefined as unknown as number])).toBe(40);
  });
});

describe('computeHeat with quality', () => {
  it('ranks single high score above weak dual sources (same age, no pick)', () => {
    const single = computeHeat({
      quality: computeClusterQuality([88]),
      sourceCount: 1,
      ageHours: 0,
      hasPicked: false
    });
    const dual = computeHeat({
      quality: computeClusterQuality([10, 25]),
      sourceCount: 2,
      ageHours: 0,
      hasPicked: false
    });
    expect(single).toBeGreaterThan(dual);
    expect(single).toBe(88);
    expect(dual).toBe(Math.round(28 * Math.log2(3)));
  });

  it('lets strong dual sources beat a slightly lower single', () => {
    const single = computeHeat({
      quality: computeClusterQuality([88]),
      sourceCount: 1,
      ageHours: 0,
      hasPicked: false
    });
    const dual = computeHeat({
      quality: computeClusterQuality([70, 60]),
      sourceCount: 2,
      ageHours: 0,
      hasPicked: false
    });
    expect(dual).toBeGreaterThan(single);
  });

  it('applies pick boost and recency', () => {
    const base = computeHeat({
      quality: 80,
      sourceCount: 1,
      ageHours: 0,
      hasPicked: false
    });
    const picked = computeHeat({
      quality: 80,
      sourceCount: 1,
      ageHours: 0,
      hasPicked: true
    });
    const aged = computeHeat({
      quality: 80,
      sourceCount: 1,
      ageHours: 8,
      hasPicked: false
    });
    expect(picked).toBe(Math.round(80 * 1.25));
    expect(aged).toBe(40);
    expect(base).toBe(80);
  });

  it('skips time decay when applyDecay is false', () => {
    const fresh = computeHeat({
      quality: 80,
      sourceCount: 1,
      ageHours: 0,
      hasPicked: false,
      applyDecay: false
    });
    const aged = computeHeat({
      quality: 80,
      sourceCount: 1,
      ageHours: 72,
      hasPicked: false,
      applyDecay: false
    });
    expect(fresh).toBe(80);
    expect(aged).toBe(80);
  });
});
