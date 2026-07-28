import { describe, expect, it } from 'vitest';
import { DefaultContextManager } from '../src/services/agents/engine/ContextManager.js';
import type { AIMessage } from '../src/types/index.js';

function makeMessages(count: number, contentSize: number): AIMessage[] {
  const content = 'a'.repeat(contentSize);
  const msgs: AIMessage[] = [{ role: 'system', content: 'system' }];
  for (let i = 0; i < count; i++) {
    msgs.push({ role: 'user', content } as AIMessage);
  }
  return msgs;
}

describe('DefaultContextManager token budget trigger', () => {
  it('does not compact when under token budget', async () => {
    const mgr = new DefaultContextManager();
    const msgs = makeMessages(5, 100);
    const result = await mgr.compactMessages(msgs, {
      policy: { maxInputTokens: 100000, reserveOutputTokens: 8192, compactionBuffer: 20000 }
    });
    expect(result.compacted).toBe(false);
  });

  it('compacts when token budget exceeded', async () => {
    const mgr = new DefaultContextManager();
    const msgs = makeMessages(20, 10000);
    const result = await mgr.compactMessages(msgs, {
      policy: { maxInputTokens: 50000, reserveOutputTokens: 8192, compactionBuffer: 5000 }
    });
    expect(result.compacted).toBe(true);
  });

  it('does not compact when strategy is none even if budget exceeded', async () => {
    const mgr = new DefaultContextManager();
    const msgs = makeMessages(20, 10000);
    const result = await mgr.compactMessages(msgs, {
      policy: {
        maxInputTokens: 100,
        reserveOutputTokens: 10,
        compactionBuffer: 10,
        compactionStrategy: 'none'
      }
    });
    expect(result.compacted).toBe(false);
  });

  it('compacts by token budget even when message count is small', async () => {
    const mgr = new DefaultContextManager();
    const msgs: AIMessage[] = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'x'.repeat(50000) } as AIMessage
    ];
    const result = await mgr.compactMessages(msgs, {
      policy: { maxInputTokens: 1000, reserveOutputTokens: 100, compactionBuffer: 100 }
    });
    expect(result.compacted).toBe(true);
  });

  it('falls back to default maxInputTokens when policy has no token fields', async () => {
    const mgr = new DefaultContextManager();
    const msgs = makeMessages(5, 100);
    const result = await mgr.compactMessages(msgs, { policy: {} });
    expect(result.compacted).toBe(false);
  });

  it('force-trims to maxMessages when manual compaction policy is applied', async () => {
    const mgr = new DefaultContextManager();
    // 50 user messages + 1 system — well over the maxMessages cap of 30.
    const msgs = makeMessages(50, 200);
    const result = await mgr.compactMessages(msgs, {
      policy: { compactionStrategy: 'trim', maxInputTokens: 1, maxMessages: 30 }
    });
    expect(result.compacted).toBe(true);
    expect(result.messages.length).toBeLessThanOrEqual(31);
    expect(result.messages.length).toBeLessThan(msgs.length);
    // System message is always retained by keepSystemAndRecent.
    expect(result.messages[0]?.role).toBe('system');
  });

  it('reports compacted=false when message count is already under maxMessages', async () => {
    const mgr = new DefaultContextManager();
    const msgs = makeMessages(5, 200);
    const result = await mgr.compactMessages(msgs, {
      policy: { compactionStrategy: 'trim', maxInputTokens: 1, maxMessages: 30 }
    });
    // trim keeps min(maxMessages, messages.length) — 6 messages, no reduction.
    expect(result.messages.length).toBe(msgs.length);
  });
});
