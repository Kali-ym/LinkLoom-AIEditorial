import { describe, expect, it } from 'vitest';
import { buildLocalContextSnapshot } from './buildLocalContextSnapshot';
import { ContextTokenCategory } from '../domain/types/contextUsage';

describe('buildLocalContextSnapshot', () => {
  it('maps 4-bucket breakdown into 8 categories', () => {
    const snap = buildLocalContextSnapshot(
      {
        systemRoleToken: 100,
        toolsToken: 200,
        historySummaryToken: 50,
        chatsToken: 500,
        totalToken: 850,
      },
      200_000,
      { driftMultiplier: 1 },
    );
    expect(snap.byCategory[ContextTokenCategory.SystemPrompt]).toBe(100);
    expect(snap.byCategory[ContextTokenCategory.ToolDefinitions]).toBe(200);
    expect(snap.byCategory[ContextTokenCategory.Conversation]).toBe(500);
    expect(snap.byCategory[ContextTokenCategory.SummarizedConversation]).toBe(50);
    expect(snap.byCategory[ContextTokenCategory.Rules]).toBe(0);
    expect(snap.totalTokens).toBe(850);
    expect(snap.source).toBe('estimate');
  });

  it('computes remaining from max context window', () => {
    const snap = buildLocalContextSnapshot(
      { systemRoleToken: 1000, toolsToken: 0, historySummaryToken: 0, chatsToken: 0, totalToken: 1000 },
      200_000,
      { driftMultiplier: 1 },
    );
    expect(snap.maxContextTokens).toBe(200_000);
    expect(snap.remainingTokens).toBeGreaterThan(0);
    expect(snap.usageRatio).toBeGreaterThan(0);
    expect(snap.usageRatio).toBeLessThan(1);
  });
});
