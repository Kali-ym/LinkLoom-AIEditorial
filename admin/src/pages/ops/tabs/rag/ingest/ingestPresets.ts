import { asNumber } from '../shared/ragStatusLabels.js';

export function computeMissingChunkLimit(coverage: { totalChunkCount?: number; indexedChunkCount?: number } | null | undefined): number {
  const total = asNumber(coverage?.totalChunkCount);
  const indexed = asNumber(coverage?.indexedChunkCount);
  if (total <= 0) return 100;
  const missing = Math.max(1, total - indexed);
  return Math.min(500, missing);
}

export function buildReindexMissingParams(coverage: { totalChunkCount?: number; indexedChunkCount?: number } | null | undefined) {
  return {
    onlyMissing: true,
    dryRun: false,
    targetStorage: 'dual' as const,
    limit: computeMissingChunkLimit(coverage)
  };
}
