import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FEED_CATEGORIES } from '../src/config/feedCategories.js';

describe('feed_scoring prompt contract', () => {
  const md = readFileSync(new URL('../src/prompts/feed.md', import.meta.url), 'utf8');
  const section = md.slice(md.indexOf('## [feed_scoring]'));

  it('requires ai_category with six ids', () => {
    expect(section).toMatch(/"ai_category"/);
    for (const c of FEED_CATEGORIES) {
      expect(section).toContain(c.id);
    }
  });

  it('documents event_signature for hot clustering', () => {
    expect(section).toMatch(/event_signature/);
    expect(section).toMatch(/同事件/);
  });
});
