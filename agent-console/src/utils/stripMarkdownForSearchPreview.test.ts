import { describe, expect, it } from 'vitest';

import { stripMarkdownForSearchPreview } from './stripMarkdownForSearchPreview';

describe('stripMarkdownForSearchPreview', () => {
  it('strips common markdown syntax', () => {
    expect(stripMarkdownForSearchPreview('**bold** and `code`')).toBe('bold and code');
    expect(stripMarkdownForSearchPreview('[link](https://example.com)')).toBe('link');
    expect(stripMarkdownForSearchPreview('# heading\n\nparagraph')).toBe('heading paragraph');
  });
});
