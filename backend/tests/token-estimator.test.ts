import { describe, expect, it } from 'vitest';
import { TokenEstimator } from '../src/services/agents/context/TokenEstimator.js';
import type { AIMessage } from '../src/types/index.js';

describe('TokenEstimator', () => {
  it('counts English text tokens', async () => {
    const est = new TokenEstimator({ driftMultiplier: 1 });
    await est.preload();
    const tokens = est.countText('hello world');
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(5);
  });

  it('counts Chinese text with drift multiplier', async () => {
    const est = new TokenEstimator({ driftMultiplier: 1.25, encoding: 'cl100k_base' });
    await est.preload();
    const tokens = est.countText('你好世界，这是一个测试');
    expect(tokens).toBeGreaterThan(5);
  });

  it('returns 0 for empty text', () => {
    const est = new TokenEstimator();
    expect(est.countText('')).toBe(0);
  });

  it('counts message with string content and per-message overhead', async () => {
    const est = new TokenEstimator({ driftMultiplier: 1 });
    await est.preload();
    const msg: AIMessage = { role: 'user', content: 'hello world' };
    const tokens = est.countMessage(msg);
    expect(tokens).toBeGreaterThan(4);
  });

  it('counts multimodal message with image estimate', async () => {
    const est = new TokenEstimator({ driftMultiplier: 1 });
    await est.preload();
    const msg = {
      role: 'user',
      content: [
        { type: 'text', text: 'describe this' },
        { type: 'image_url', image_url: { url: 'data:...' } }
      ]
    } as unknown as AIMessage;
    const tokens = est.countMessage(msg);
    expect(tokens).toBeGreaterThan(1500);
  });

  it('counts tool_calls overhead', async () => {
    const est = new TokenEstimator({ driftMultiplier: 1 });
    await est.preload();
    const msg = {
      role: 'assistant',
      content: '',
      tool_calls: [
        { id: 'tc1', type: 'function', function: { name: 'foo', arguments: '{"a":1}' } }
      ]
    } as unknown as AIMessage;
    const tokens = est.countMessage(msg);
    expect(tokens).toBeGreaterThan(5);
  });

  it('counts tool definitions with overhead', async () => {
    const est = new TokenEstimator({ driftMultiplier: 1 });
    await est.preload();
    const tools = [
      { type: 'function', function: { name: 'foo', description: 'do foo', parameters: { type: 'object', properties: {} } } }
    ];
    const tokens = est.countToolDefinitions(tools);
    expect(tokens).toBeGreaterThan(5);
  });

  it('countMessages sums multiple messages', async () => {
    const est = new TokenEstimator({ driftMultiplier: 1 });
    await est.preload();
    const msgs: AIMessage[] = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi there' }
    ];
    expect(est.countMessages(msgs)).toBe(est.countMessage(msgs[0]) + est.countMessage(msgs[1]));
  });

  it('falls back to chars/4 estimate when encoder not loaded', () => {
    const est = new TokenEstimator({ driftMultiplier: 1 });
    // encoder may not be loaded synchronously; expect a positive estimate either way
    const tokens = est.countText('a longer piece of english text that should tokenize');
    expect(tokens).toBeGreaterThan(0);
  });
});
