import { describe, expect, it } from 'vitest';
import { sanitizeXml, wrapTag } from '../src/services/agents/prompt/sanitize.js';

describe('sanitizeXml', () => {
  it("escapes <>&\"'", () => {
    expect(sanitizeXml('a<b>c&d"e\'f')).toBe('a&lt;b&gt;c&amp;d&quot;e&#39;f');
  });
  it('leaves plain text unchanged', () => {
    expect(sanitizeXml('hello world')).toBe('hello world');
  });
  it('handles empty string', () => {
    expect(sanitizeXml('')).toBe('');
  });
  it('escapes ampersand first to avoid double-escape', () => {
    expect(sanitizeXml('a&b<c')).toBe('a&amp;b&lt;c');
  });
});

describe('wrapTag', () => {
  it('wraps content in tag', () => {
    expect(wrapTag('role', 'You are X')).toBe('<role>You are X</role>');
  });
  it('sanitizes content', () => {
    expect(wrapTag('role', 'a<b')).toBe('<role>a&lt;b</role>');
  });
  it('returns empty string for empty content', () => {
    expect(wrapTag('role', '')).toBe('');
  });
  it('supports attributes', () => {
    expect(wrapTag('tools', 'body', { description: 'x' })).toBe(
      '<tools description="x">body</tools>'
    );
  });
  it('sanitizes attribute values', () => {
    expect(wrapTag('tools', 'body', { description: 'a<b' })).toBe(
      '<tools description="a&lt;b">body</tools>'
    );
  });
});
