import { describe, expect, it } from 'vitest';
import { matchTags, parseCommaList } from '../src/services/feed/timelineFilters.js';

describe('matchTags', () => {
  it('OR-includes and excludes', () => {
    expect(matchTags(['开源', 'MCP'], ['MCP'], ['公关'])).toBe(true);
    expect(matchTags(['开源', '公关'], ['开源'], ['公关'])).toBe(false);
    expect(matchTags(['行业'], ['MCP'], undefined)).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(matchTags(['MCP'], ['mcp'], undefined)).toBe(true);
    expect(matchTags(['PR'], undefined, ['pr'])).toBe(false);
  });

  it('passes when no include/exclude', () => {
    expect(matchTags(['开源'], undefined, undefined)).toBe(true);
    expect(matchTags(undefined, undefined, undefined)).toBe(true);
  });
});

describe('parseCommaList', () => {
  it('parses and trims', () => {
    expect(parseCommaList('开源, MCP ,公关')).toEqual(['开源', 'MCP', '公关']);
  });

  it('returns undefined for empty', () => {
    expect(parseCommaList(undefined)).toBeUndefined();
    expect(parseCommaList('')).toBeUndefined();
    expect(parseCommaList('  ,  ')).toBeUndefined();
  });
});
