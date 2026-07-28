import { describe, expect, it } from 'vitest';

import {
  isStructuredPrompt,
  structuredPromptToPreviewString,
  type StructuredPrompt
} from './structuredPrompt';

describe('isStructuredPrompt', () => {
  it('returns true for object with known StructuredPrompt fields', () => {
    expect(isStructuredPrompt({ role: 'r' })).toBe(true);
    expect(isStructuredPrompt({ constraints: 'c' })).toBe(true);
    expect(isStructuredPrompt({ role: 'r', identity: 'i', examples: [] })).toBe(true);
  });

  it('returns false for plain strings', () => {
    expect(isStructuredPrompt('you are x')).toBe(false);
    expect(isStructuredPrompt('')).toBe(false);
  });

  it('returns false for arrays and null', () => {
    expect(isStructuredPrompt([])).toBe(false);
    expect(isStructuredPrompt(null)).toBe(false);
    expect(isStructuredPrompt(undefined)).toBe(false);
  });

  it('returns false for objects without any known field', () => {
    expect(isStructuredPrompt({ foo: 'bar' })).toBe(false);
    expect(isStructuredPrompt({ id: 1, name: 'x' })).toBe(false);
  });
});

describe('structuredPromptToPreviewString', () => {
  it('joins role and string identity with double newline', () => {
    const p: StructuredPrompt = { role: '选题 Copilot', identity: '详细人设' };
    expect(structuredPromptToPreviewString(p)).toBe('选题 Copilot\n\n详细人设');
  });

  it('returns role only when identity is missing or docRef', () => {
    expect(structuredPromptToPreviewString({ role: 'r' })).toBe('r');
    expect(structuredPromptToPreviewString({ role: 'r', identity: { docRef: 'x' } })).toBe('r');
  });

  it('returns empty string when no role and no string identity', () => {
    expect(structuredPromptToPreviewString({ constraints: 'c' })).toBe('');
  });
});
