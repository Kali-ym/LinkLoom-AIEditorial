import { describe, expect, it } from 'vitest';

import { parseInlineLink } from './parseInlineLink';

describe('parseInlineLink', () => {
  it('parses generic http links', () => {
    expect(parseInlineLink('https://cursor.com')).toEqual({
      canonicalLabel: 'https://cursor.com',
      domain: 'cursor.com',
      kind: 'generic',
    });
  });

  it('parses github repo links', () => {
    expect(parseInlineLink('https://github.com/example/ui-lib')).toEqual({
      canonicalLabel: 'example/ui-lib',
      kind: 'github',
    });
  });
});
