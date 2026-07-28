import { describe, expect, it } from 'vitest';
import { mergeSnapshotWithDraft } from './useContextUsageSnapshot';
import type { TopicContextUsage } from '../domain/types/contextUsage';

const baseApiUsage: TopicContextUsage = {
  promptTokens: 38000,
  completionTokens: 0,
  totalTokens: 38000,
  byCategory: {
    system_prompt: 2900,
    tool_definitions: 14400,
    rules: 107,
    skills: 2500,
    mcp: 1900,
    subagent_definitions: 1100,
    conversation: 15000,
    summarized_conversation: 0,
  },
  adjustedTotal: 43700,
  driftMultiplier: 1.15,
  maxContextTokens: 200000,
  reserveOutputTokens: 8192,
  compactionBuffer: 20000,
  remainingTokens: 128108,
  usageRatio: 0.34,
  source: 'counter',
  round: 1,
};

describe('mergeSnapshotWithDraft', () => {
  it('returns null when apiUsage has no breakdown', () => {
    const snap = mergeSnapshotWithDraft(
      { promptTokens: 100, completionTokens: 0, totalTokens: 100 },
      '',
      0
    );
    expect(snap).toBeNull();
  });

  it('merges draft tokens into conversation category', () => {
    const snap = mergeSnapshotWithDraft(baseApiUsage, 'hello world', 3)!;
    expect(snap.byCategory.conversation).toBeGreaterThan(baseApiUsage.byCategory!.conversation);
    expect(snap.byCategory.system_prompt).toBe(baseApiUsage.byCategory!.system_prompt);
  });

  it('computes remaining and ratio with draft included', () => {
    const snap = mergeSnapshotWithDraft(baseApiUsage, 'some draft text', 5)!;
    const usable = 200000 - 8192 - 20000;
    expect(snap.remainingTokens).toBeLessThanOrEqual(usable);
    expect(snap.usageRatio).toBeGreaterThan(0);
    expect(snap.maxContextTokens).toBe(200000);
  });

  it('preserves source and round from apiUsage', () => {
    const snap = mergeSnapshotWithDraft(baseApiUsage, '', 0)!;
    expect(snap.source).toBe('counter');
    expect(snap.round).toBe(1);
  });
});
