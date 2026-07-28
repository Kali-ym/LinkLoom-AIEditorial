import {
  ContextTokenCategory,
  emptyBreakdown,
  type ClassifiedModelInput,
  type ContextTokenBreakdown,
  type ContextUsageSnapshot
} from './ContextTokenTypes.js';
import type { TokenEstimator } from './TokenEstimator.js';
import type { ModelContextProfile } from './ModelContextProfile.js';

export interface TokenCountOptions {
  compacted?: boolean;
  round?: number;
  source?: 'counter' | 'provider';
}

export class TokenCounter {
  constructor(
    private readonly estimator: TokenEstimator,
    private readonly profile: ModelContextProfile
  ) {}

  count(input: ClassifiedModelInput): ContextTokenBreakdown {
    const breakdown = emptyBreakdown(this.profile.driftMultiplier);

    for (const sm of input.systemMessages) {
      breakdown.byCategory[sm.category] += this.estimator.countMessage(sm.message);
    }
    for (const cm of input.conversationMessages) {
      breakdown.byCategory[cm.category] += this.estimator.countMessage(cm.message);
    }
    for (const td of input.toolDefinitions) {
      if (td.tools.length > 0) {
        breakdown.byCategory[td.category] += this.estimator.countToolDefinitions(td.tools);
      }
    }

    breakdown.totalTokens = Object.values(breakdown.byCategory).reduce((a, b) => a + b, 0);
    breakdown.adjustedTotal = Math.ceil(breakdown.totalTokens * this.profile.driftMultiplier);
    return breakdown;
  }

  toSnapshot(breakdown: ContextTokenBreakdown, options: TokenCountOptions = {}): ContextUsageSnapshot {
    const maxContext = this.profile.providerEffectiveMax ?? this.profile.theoreticalMax;
    const reserveOutput = this.profile.maxOutput ?? 8192;
    const compactionBuffer = Math.min(20000, Math.ceil(maxContext * 0.1));
    const usable = maxContext - reserveOutput - compactionBuffer;
    return {
      ...breakdown,
      maxContextTokens: maxContext,
      reserveOutputTokens: reserveOutput,
      compactionBuffer,
      remainingTokens: Math.max(usable - breakdown.adjustedTotal, 0),
      usageRatio: usable > 0 ? breakdown.adjustedTotal / usable : 0,
      source: options.source ?? 'counter',
      round: options.round,
      compacted: options.compacted
    };
  }
}
