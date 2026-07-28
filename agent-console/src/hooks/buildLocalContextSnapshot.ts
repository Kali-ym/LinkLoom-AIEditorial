import { ContextTokenCategory } from '../domain/types/contextUsage';
import type { ContextUsageSnapshot } from '../domain/types/contextUsage';
import type { ContextTokenBreakdown } from './useContextTokenBreakdown';

const DEFAULT_RESERVE_OUTPUT = 8192;
const DEFAULT_DRIFT = 1.15;

export interface BuildLocalContextSnapshotOptions {
  driftMultiplier?: number;
  reserveOutputTokens?: number;
  compactionBuffer?: number;
}

/**
 * 将本地 4 桶估算映射为 8 类 ContextUsageSnapshot（无 SSE 时的 fallback）。
 */
export function buildLocalContextSnapshot(
  breakdown: ContextTokenBreakdown,
  maxContextTokens: number,
  options: BuildLocalContextSnapshotOptions = {},
): ContextUsageSnapshot {
  const driftMultiplier = options.driftMultiplier ?? DEFAULT_DRIFT;
  const reserveOutputTokens = options.reserveOutputTokens ?? DEFAULT_RESERVE_OUTPUT;
  const compactionBuffer =
    options.compactionBuffer ?? Math.min(20_000, Math.ceil(maxContextTokens * 0.1));

  const byCategory: Record<string, number> = {
    [ContextTokenCategory.SystemPrompt]: breakdown.systemRoleToken,
    [ContextTokenCategory.ToolDefinitions]: breakdown.toolsToken,
    [ContextTokenCategory.Rules]: 0,
    [ContextTokenCategory.Skills]: 0,
    [ContextTokenCategory.Mcp]: 0,
    [ContextTokenCategory.SubagentDefinitions]: 0,
    [ContextTokenCategory.Conversation]: breakdown.chatsToken,
    [ContextTokenCategory.SummarizedConversation]: breakdown.historySummaryToken,
  };

  const totalTokens = Object.values(byCategory).reduce((a, b) => a + b, 0);
  const adjustedTotal = Math.ceil(totalTokens * driftMultiplier);
  const usable = maxContextTokens - reserveOutputTokens - compactionBuffer;
  const remainingTokens = Math.max(usable - adjustedTotal, 0);
  const usageRatio = usable > 0 ? adjustedTotal / usable : 0;

  return {
    byCategory,
    totalTokens,
    adjustedTotal,
    driftMultiplier,
    maxContextTokens,
    reserveOutputTokens,
    compactionBuffer,
    remainingTokens,
    usageRatio,
    source: 'estimate',
  };
}
