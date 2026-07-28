import { describe, expect, it } from 'vitest';
import {
  emitPacedStreamChunks,
  splitTextForStreamEmission
} from '../src/services/agents/runtime/streamTextChunks.js';

describe('splitTextForStreamEmission', () => {
  it('passes through small reasoning deltas unchanged', () => {
    expect(splitTextForStreamEmission('先分析用户意图')).toEqual(['先分析用户意图']);
  });

  it('splits large reasoning blobs into stream-sized chunks', () => {
    const text = 'A'.repeat(80);
    const chunks = splitTextForStreamEmission(text);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join('')).toBe(text);
  });
});

describe('emitPacedStreamChunks', () => {
  it('yields the whole delta in a single chunk without slicing or sleeping', async () => {
    const text = 'A'.repeat(1000);
    const pieces: string[] = [];
    const start = Date.now();
    for await (const piece of emitPacedStreamChunks(text)) {
      pieces.push(piece);
    }
    const elapsed = Date.now() - start;

    // Pacing was removed because providers already stream; a 1000-char blob must
    // come through as one yield with no perceptible delay. The old 18-char/16ms
    // pacing would have taken ~880ms here.
    expect(pieces).toEqual([text]);
    expect(elapsed).toBeLessThan(50);
  });

  it('yields nothing for empty input', async () => {
    const pieces: string[] = [];
    for await (const piece of emitPacedStreamChunks('')) {
      pieces.push(piece);
    }
    expect(pieces).toEqual([]);
  });
});

