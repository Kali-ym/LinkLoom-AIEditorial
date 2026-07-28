import { describe, expect, it } from 'vitest';
import { normalizeSystemPrompt } from '../src/services/agents/prompt/normalizeSystemPrompt.js';

describe('normalizeSystemPrompt', () => {
  it('wraps string into { identity }', () => {
    expect(normalizeSystemPrompt('You are X')).toEqual({ identity: 'You are X' });
  });
  it('returns empty object for undefined', () => {
    expect(normalizeSystemPrompt(undefined)).toEqual({});
  });
  it('returns empty object for empty string', () => {
    expect(normalizeSystemPrompt('')).toEqual({});
  });
  it('trims whitespace before wrapping', () => {
    expect(normalizeSystemPrompt('  You are X  ')).toEqual({ identity: 'You are X' });
  });
  it('returns object as-is', () => {
    const obj = { role: 'r', constraints: 'c' };
    expect(normalizeSystemPrompt(obj)).toEqual(obj);
  });
  it('preserves all seven fields', () => {
    const obj = {
      role: 'r',
      identity: 'i',
      capabilities: 'c',
      constraints: 'cn',
      outputFormat: 'o',
      examples: [{ input: 'a', output: 'b' }],
      modelHints: { google: 'g' }
    };
    expect(normalizeSystemPrompt(obj)).toEqual(obj);
  });
  it('preserves docRef identity', () => {
    expect(normalizeSystemPrompt({ identity: { docRef: 'p.md' } })).toEqual({
      identity: { docRef: 'p.md' }
    });
  });
});
