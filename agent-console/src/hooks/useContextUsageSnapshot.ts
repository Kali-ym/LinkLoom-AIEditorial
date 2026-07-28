import { useMemo } from 'react';
import type { TopicContextUsage } from '../domain/types/contextUsage';
import type { ContextUsageSnapshot } from '../domain/types/contextUsage';
import { ContextTokenCategory } from '../domain/types/contextUsage';
import { useTokenEstimator } from './useTokenEstimator';

export interface UseContextUsageSnapshotParams {
  apiUsage?: TopicContextUsage;
  draft: string;
  driftMultiplier?: number;
  encoding?: 'o200k_base' | 'cl100k_base' | 'p50k_base' | 'r50k_base';
}

export function mergeSnapshotWithDraft(
  apiUsage: TopicContextUsage | undefined,
  _draft: string,
  draftTokens: number
): ContextUsageSnapshot | null {
  if (!apiUsage?.byCategory || !apiUsage.maxContextTokens) {
    return null;
  }
  const byCategory = { ...apiUsage.byCategory };
  const convKey = ContextTokenCategory.Conversation;
  byCategory[convKey] = (byCategory[convKey] ?? 0) + draftTokens;

  const totalTokens = Object.values(byCategory).reduce((a, b) => a + b, 0);
  const drift = apiUsage.driftMultiplier ?? 1.15;
  const adjustedTotal = Math.ceil(totalTokens * drift);
  const maxContext = apiUsage.maxContextTokens;
  const reserveOutput = apiUsage.reserveOutputTokens ?? 8192;
  const buffer = apiUsage.compactionBuffer ?? Math.min(20000, Math.ceil(maxContext * 0.1));
  const usable = maxContext - reserveOutput - buffer;

  return {
    byCategory,
    totalTokens,
    adjustedTotal,
    driftMultiplier: drift,
    countedAt: apiUsage.updatedAt,
    maxContextTokens: maxContext,
    reserveOutputTokens: reserveOutput,
    compactionBuffer: buffer,
    remainingTokens: Math.max(usable - adjustedTotal, 0),
    usageRatio: usable > 0 ? adjustedTotal / usable : 0,
    source: apiUsage.source ?? 'counter',
    round: apiUsage.round,
    compacted: apiUsage.compacted
  };
}

export function useContextUsageSnapshot(
  params: UseContextUsageSnapshotParams
): ContextUsageSnapshot | null {
  const { apiUsage, draft } = params;
  const estimator = useTokenEstimator({
    driftMultiplier: params.driftMultiplier ?? apiUsage?.driftMultiplier ?? 1.15,
    encoding: params.encoding ?? 'o200k_base'
  });

  return useMemo(() => {
    const draftTokens = estimator.countText(draft);
    return mergeSnapshotWithDraft(apiUsage, draft, draftTokens);
  }, [apiUsage, draft, estimator]);
}
