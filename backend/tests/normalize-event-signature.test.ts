import { describe, expect, it } from 'vitest';
import { normalizeEventSignature } from '../src/services/feed/normalizeEventSignature.js';

describe('normalizeEventSignature', () => {
  it('returns null for empty', () => {
    expect(normalizeEventSignature('')).toBeNull();
    expect(normalizeEventSignature(null)).toBeNull();
    expect(normalizeEventSignature(undefined)).toBeNull();
  });

  it('lowercases, unifies separators, strips hype tokens', () => {
    expect(normalizeEventSignature('OpenAI/GPT5 发布')).toBe('openai-gpt5-发布');
    expect(normalizeEventSignature('今日-突发-openai-gpt5')).toBe('openai-gpt5');
  });

  it('collapses repeated dashes', () => {
    expect(normalizeEventSignature('a--b___c')).toBe('a-b-c');
  });
});
