import { describe, expect, it } from 'vitest';
import { scoreBand, scoreTone } from './timelineLayout';

describe('scoreBand', () => {
  it('maps the five editorial bands', () => {
    expect(scoreBand(0)).toBe('low');
    expect(scoreBand(59)).toBe('low');
    expect(scoreBand(60)).toBe('fair');
    expect(scoreBand(69)).toBe('fair');
    expect(scoreBand(70)).toBe('good');
    expect(scoreBand(79)).toBe('good');
    expect(scoreBand(80)).toBe('high');
    expect(scoreBand(89)).toBe('high');
    expect(scoreBand(90)).toBe('elite');
    expect(scoreBand(100)).toBe('elite');
  });
});

describe('scoreTone', () => {
  it('exposes display color classes per band', () => {
    expect(scoreTone(55).display).toContain('score-low');
    expect(scoreTone(65).display).toContain('score-fair');
    expect(scoreTone(75).display).toContain('score-good');
    expect(scoreTone(85).display).toContain('score-high');
    expect(scoreTone(95).display).toContain('score-elite');
  });
});
