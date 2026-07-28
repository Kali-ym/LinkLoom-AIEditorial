import { describe, expect, it } from 'vitest';
import { TokenCounter } from '../src/services/agents/context/TokenCounter.js';
import { TokenEstimator } from '../src/services/agents/context/TokenEstimator.js';
import { ContextTokenCategory, type ClassifiedModelInput } from '../src/services/agents/context/ContextTokenTypes.js';
import type { ModelContextProfile } from '../src/services/agents/context/ModelContextProfile.js';

const profile: ModelContextProfile = {
  providerId: 'openai',
  modelId: 'gpt-4o',
  theoreticalMax: 128000,
  maxOutput: 16384,
  encoding: 'o200k_base',
  driftMultiplier: 1.1
};

function makeInput(overrides: Partial<ClassifiedModelInput> = {}): ClassifiedModelInput {
  return {
    systemMessages: [
      { message: { role: 'system', content: 'You are helpful.' }, category: ContextTokenCategory.SystemPrompt }
    ],
    conversationMessages: [
      { message: { role: 'user', content: 'hello' }, category: ContextTokenCategory.Conversation }
    ],
    toolDefinitions: [],
    metadata: { compacted: false, summaryPresent: false, assembledAt: new Date().toISOString() },
    ...overrides
  };
}

describe('TokenCounter', () => {
  it('counts system + conversation into separate categories', async () => {
    const est = new TokenEstimator({ driftMultiplier: 1.1, encoding: 'o200k_base' });
    await est.preload();
    const counter = new TokenCounter(est, profile);
    const b = counter.count(makeInput());
    expect(b.byCategory[ContextTokenCategory.SystemPrompt]).toBeGreaterThan(0);
    expect(b.byCategory[ContextTokenCategory.Conversation]).toBeGreaterThan(0);
    expect(b.byCategory[ContextTokenCategory.ToolDefinitions]).toBe(0);
    expect(b.totalTokens).toBe(
      b.byCategory[ContextTokenCategory.SystemPrompt] + b.byCategory[ContextTokenCategory.Conversation]
    );
    expect(b.adjustedTotal).toBe(Math.ceil(b.totalTokens * 1.1));
  });

  it('counts tool definitions into ToolDefinitions category', async () => {
    const est = new TokenEstimator({ driftMultiplier: 1.1, encoding: 'o200k_base' });
    await est.preload();
    const counter = new TokenCounter(est, profile);
    const input = makeInput({
      toolDefinitions: [
        {
          tools: [{ type: 'function', function: { name: 'foo', parameters: {} } }],
          category: ContextTokenCategory.ToolDefinitions
        }
      ]
    });
    const b = counter.count(input);
    expect(b.byCategory[ContextTokenCategory.ToolDefinitions]).toBeGreaterThan(0);
  });

  it('separates MCP tools from local tools', async () => {
    const est = new TokenEstimator({ driftMultiplier: 1.1, encoding: 'o200k_base' });
    await est.preload();
    const counter = new TokenCounter(est, profile);
    const input = makeInput({
      toolDefinitions: [
        { tools: [{ name: 'local_foo' }], category: ContextTokenCategory.ToolDefinitions },
        { tools: [{ name: 'mcp_bar' }], category: ContextTokenCategory.Mcp }
      ]
    });
    const b = counter.count(input);
    expect(b.byCategory[ContextTokenCategory.ToolDefinitions]).toBeGreaterThan(0);
    expect(b.byCategory[ContextTokenCategory.Mcp]).toBeGreaterThan(0);
  });

  it('toSnapshot computes remaining and ratio', async () => {
    const est = new TokenEstimator({ driftMultiplier: 1.1, encoding: 'o200k_base' });
    await est.preload();
    const counter = new TokenCounter(est, profile);
    const b = counter.count(makeInput());
    const snap = counter.toSnapshot(b, { round: 1 });
    expect(snap.maxContextTokens).toBe(128000);
    expect(snap.reserveOutputTokens).toBe(16384);
    expect(snap.compactionBuffer).toBe(12800);
    const usable = 128000 - 16384 - 12800;
    expect(snap.remainingTokens).toBe(Math.max(usable - b.adjustedTotal, 0));
    expect(snap.usageRatio).toBeCloseTo(b.adjustedTotal / usable, 5);
    expect(snap.round).toBe(1);
    expect(snap.source).toBe('counter');
  });

  it('toSnapshot marks compacted flag', async () => {
    const est = new TokenEstimator({ driftMultiplier: 1.1, encoding: 'o200k_base' });
    await est.preload();
    const counter = new TokenCounter(est, profile);
    const b = counter.count(makeInput());
    const snap = counter.toSnapshot(b, { compacted: true });
    expect(snap.compacted).toBe(true);
  });
});
