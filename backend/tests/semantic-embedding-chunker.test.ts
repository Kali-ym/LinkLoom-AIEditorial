import { describe, expect, it } from 'vitest';
import {
  clusterSentencesByEmbeddings,
  findSemanticBreakpoints,
  groupSentencesByBreakpoints,
  splitIntoSentences
} from '../src/services/rag/SemanticEmbeddingChunker.js';
import type { EmbeddingChunkOptions } from '../src/services/rag/SemanticEmbeddingChunker.js';

const baseOptions: EmbeddingChunkOptions = {
  chunkStrategy: 'embedding',
  chunkSize: 3000,
  chunkOverlap: 400,
  semanticMaxChunkSize: 500,
  semanticMinChunkSize: 0,
  semanticBreakpointPercentile: 50,
  embeddingBatchSize: 16
};

describe('SemanticEmbeddingChunker', () => {
  it('splits text into sentences and paragraphs', () => {
    const sentences = splitIntoSentences('First sentence. Second sentence.\n\nThird paragraph.');
    expect(sentences).toEqual(['First sentence.', 'Second sentence.', 'Third paragraph.']);
  });

  it('finds breakpoints at large similarity drops', () => {
    const breakpoints = findSemanticBreakpoints([0.95, 0.2, 0.93], 50);
    expect(breakpoints.has(2)).toBe(true);
  });

  it('clusters sentences by embedding vectors', () => {
    const sentences = ['Topic A sentence one.', 'Topic A sentence two.', 'Topic B sentence one.'];
    const vectors = [
      [1, 0, 0],
      [0.95, 0.05, 0],
      [0, 1, 0]
    ];

    const chunks = clusterSentencesByEmbeddings(sentences, vectors, {
      ...baseOptions,
      semanticBreakpointPercentile: 90
    });
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toContain('Topic A');
    expect(chunks[1]).toContain('Topic B');
  });

  it('respects max chunk size after semantic grouping', () => {
    const sentences = ['A'.repeat(300), 'B'.repeat(300)];
    const chunks = groupSentencesByBreakpoints(sentences, new Set([1]), baseOptions);
    expect(chunks.length).toBeGreaterThan(1);
  });
});
