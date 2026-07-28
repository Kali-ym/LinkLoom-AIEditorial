import { describe, expect, it } from 'vitest';
import { feedHrefFromQuery } from './feedQueryMemory';

describe('feedHrefFromQuery', () => {
  it('returns bare /feed for empty query', () => {
    expect(feedHrefFromQuery('')).toBe('/feed');
    expect(feedHrefFromQuery(null)).toBe('/feed');
    expect(feedHrefFromQuery(undefined)).toBe('/feed');
  });

  it('builds /feed?… and strips leading ?', () => {
    expect(feedHrefFromQuery('picked=1&q=ai')).toBe('/feed?picked=1&q=ai');
    expect(feedHrefFromQuery('?picked=1')).toBe('/feed?picked=1');
  });
});
