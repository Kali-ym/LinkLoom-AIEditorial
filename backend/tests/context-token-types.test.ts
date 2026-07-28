import { describe, expect, it } from 'vitest';
import { ContextTokenCategory, emptyBreakdown } from '../src/services/agents/context/ContextTokenTypes.js';

describe('ContextTokenTypes', () => {
  it('exposes 8 categories', () => {
    const categories = Object.values(ContextTokenCategory);
    expect(categories).toHaveLength(8);
    expect(categories).toContain(ContextTokenCategory.SystemPrompt);
    expect(categories).toContain(ContextTokenCategory.ToolDefinitions);
    expect(categories).toContain(ContextTokenCategory.Rules);
    expect(categories).toContain(ContextTokenCategory.Skills);
    expect(categories).toContain(ContextTokenCategory.Mcp);
    expect(categories).toContain(ContextTokenCategory.SubagentDefinitions);
    expect(categories).toContain(ContextTokenCategory.Conversation);
    expect(categories).toContain(ContextTokenCategory.SummarizedConversation);
  });

  it('emptyBreakdown initializes all categories to 0', () => {
    const b = emptyBreakdown(1.15);
    expect(b.totalTokens).toBe(0);
    expect(b.adjustedTotal).toBe(0);
    expect(b.driftMultiplier).toBe(1.15);
    for (const cat of Object.values(ContextTokenCategory)) {
      expect(b.byCategory[cat]).toBe(0);
    }
  });
});
