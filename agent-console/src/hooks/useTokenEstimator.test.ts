import { describe, expect, it } from 'vitest';
import { createTokenEstimator } from './useTokenEstimator';

describe('createTokenEstimator', () => {
  it('returns 0 for empty text', () => {
    const est = createTokenEstimator({ driftMultiplier: 1 });
    expect(est.countText('')).toBe(0);
  });

  it('counts text with drift multiplier (fallback chars/4 before load)', () => {
    const est = createTokenEstimator({ driftMultiplier: 1.15 });
    const tokens = est.countText('hello world');
    expect(tokens).toBeGreaterThan(0);
  });

  it('counts message with per-message overhead', () => {
    const est = createTokenEstimator({ driftMultiplier: 1 });
    const tokens = est.countMessage({ role: 'user', content: 'hello' });
    expect(tokens).toBeGreaterThan(4);
  });

  it('counts multimodal message with image estimate', () => {
    const est = createTokenEstimator({ driftMultiplier: 1 });
    const tokens = est.countMessage({
      role: 'user',
      content: [
        { type: 'text', text: 'describe' },
        { type: 'image_url', image_url: { url: 'data:...' } }
      ]
    });
    expect(tokens).toBeGreaterThan(1500);
  });

  it('uses gpt-tokenizer after preload', async () => {
    const est = createTokenEstimator({ driftMultiplier: 1, encoding: 'o200k_base' });
    await est.preload();
    const tokens = est.countText('hello world');
    expect(tokens).toBe(2);
  });

  it('cl100k encodes Chinese differently from o200k after preload', async () => {
    const estO200k = createTokenEstimator({ driftMultiplier: 1, encoding: 'o200k_base' });
    const estCl100k = createTokenEstimator({ driftMultiplier: 1, encoding: 'cl100k_base' });
    await estO200k.preload();
    await estCl100k.preload();
    const o = estO200k.countText('你好世界');
    const c = estCl100k.countText('你好世界');
    expect(c).toBeGreaterThan(o);
  });
});
