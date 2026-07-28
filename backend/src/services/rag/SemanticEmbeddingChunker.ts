import { LogService } from '../LogService.js';
import type { ChunkOptions } from './RagSettings.js';
import { cosineSimilarity } from './SmallModelClient.js';

export interface EmbeddingChunkOptions extends ChunkOptions {
  semanticBreakpointPercentile: number;
  embeddingBatchSize: number;
}

export function splitIntoSentences(text: string): string[] {
  const paragraphs = text
    .split(/\n\s*\n+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const sentences: string[] = [];
  for (const paragraph of paragraphs) {
    const parts = paragraph
      .split(/(?<=[.!?。！？;；])\s+|\n+/)
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length === 0) {
      sentences.push(paragraph);
    } else {
      sentences.push(...parts);
    }
  }

  return sentences.length > 0 ? sentences : [text.trim()];
}

export function percentileValue(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const bounded = Math.max(0, Math.min(100, percentile));
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((bounded / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

export function findSemanticBreakpoints(
  similarities: number[],
  breakpointPercentile: number
): Set<number> {
  if (similarities.length === 0) return new Set();

  const distances = similarities.map((value) => 1 - value);
  const threshold = percentileValue(distances, breakpointPercentile);
  const breakpoints = new Set<number>();

  for (let i = 0; i < distances.length; i++) {
    if (distances[i] >= threshold) {
      breakpoints.add(i + 1);
    }
  }

  return breakpoints;
}

export function groupSentencesByBreakpoints(
  sentences: string[],
  breakpoints: Set<number>,
  options: Pick<EmbeddingChunkOptions, 'semanticMaxChunkSize' | 'semanticMinChunkSize' | 'chunkSize' | 'chunkOverlap'>
): string[] {
  if (sentences.length === 0) return [];
  if (sentences.length === 1) {
    return enforceMaxChunkSize(sentences[0], options.semanticMaxChunkSize, options.chunkOverlap);
  }

  const groups: string[] = [];
  let current: string[] = [];

  for (let i = 0; i < sentences.length; i++) {
    current.push(sentences[i]);
    if (breakpoints.has(i + 1)) {
      groups.push(current.join('\n'));
      current = [];
    }
  }

  if (current.length > 0) {
    groups.push(current.join('\n'));
  }

  const sized = groups.flatMap((group) =>
    group.length > options.semanticMaxChunkSize
      ? enforceMaxChunkSize(group, options.semanticMaxChunkSize, options.chunkOverlap)
      : [group]
  );

  return mergeSmallChunks(sized, options.semanticMinChunkSize, options.semanticMaxChunkSize);
}

export function clusterSentencesByEmbeddings(
  sentences: string[],
  vectors: number[][],
  options: EmbeddingChunkOptions
): string[] {
  if (sentences.length === 0) return [];
  if (sentences.length === 1) {
    return enforceMaxChunkSize(sentences[0], options.semanticMaxChunkSize, options.chunkOverlap);
  }
  if (vectors.length !== sentences.length) {
    throw new Error('Embedding vector count does not match sentence count');
  }

  const similarities: number[] = [];
  for (let i = 0; i < vectors.length - 1; i++) {
    similarities.push(cosineSimilarity(vectors[i], vectors[i + 1]));
  }

  const breakpoints = findSemanticBreakpoints(
    similarities,
    options.semanticBreakpointPercentile
  );
  return groupSentencesByBreakpoints(sentences, breakpoints, options);
}

function enforceMaxChunkSize(text: string, maxSize: number, overlap: number): string[] {
  if (text.length <= maxSize) return [text];

  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + maxSize, text.length);
    chunks.push(text.slice(start, end));
    start += maxSize - overlap;
    if (start >= text.length) break;
  }
  return chunks;
}

function mergeSmallChunks(chunks: string[], minSize: number, maxSize: number): string[] {
  if (minSize <= 0 || chunks.length <= 1) return chunks;

  const merged: string[] = [];
  let buffer = '';

  const flush = () => {
    if (buffer) {
      merged.push(buffer);
      buffer = '';
    }
  };

  for (const chunk of chunks) {
    if (!buffer) {
      buffer = chunk;
      continue;
    }

    const candidate = `${buffer}\n\n${chunk}`;
    if (buffer.length < minSize && candidate.length <= maxSize) {
      buffer = candidate;
    } else {
      flush();
      buffer = chunk;
    }
  }

  flush();
  return merged;
}

export async function chunkTextByEmbedding(
  text: string,
  embed: (texts: string[]) => Promise<number[][]>,
  options: EmbeddingChunkOptions
): Promise<string[]> {
  const cleanText = text.replace(/\n\s*\n/g, '\n\n').trim();
  if (!cleanText) return [];

  const sentences = splitIntoSentences(cleanText);
  if (sentences.length <= 1) {
    return enforceMaxChunkSize(sentences[0] || cleanText, options.semanticMaxChunkSize, options.chunkOverlap);
  }

  const vectors: number[][] = [];
  const batchSize = Math.max(1, options.embeddingBatchSize || 16);
  for (let i = 0; i < sentences.length; i += batchSize) {
    const batch = sentences.slice(i, i + batchSize);
    const batchVectors = await embed(batch);
    if (batchVectors.length !== batch.length) {
      throw new Error('Embedding API returned unexpected vector count');
    }
    vectors.push(...batchVectors);
  }

  return clusterSentencesByEmbeddings(sentences, vectors, options);
}

export async function chunkTextWithEmbeddingFallback(
  text: string,
  embed: ((texts: string[]) => Promise<number[][]>) | null,
  options: EmbeddingChunkOptions,
  fallback: (text: string) => string[]
): Promise<{ chunks: string[]; usedEmbedding: boolean }> {
  if (!embed) {
    LogService.warn('Embedding service unavailable, falling back to structure/fixed chunking');
    return { chunks: fallback(text), usedEmbedding: false };
  }

  try {
    const chunks = await chunkTextByEmbedding(text, embed, options);
    return { chunks: chunks.length > 0 ? chunks : fallback(text), usedEmbedding: true };
  } catch (err) {
    LogService.warn(`Embedding semantic chunking failed, falling back: ${err}`);
    return { chunks: fallback(text), usedEmbedding: false };
  }
}
