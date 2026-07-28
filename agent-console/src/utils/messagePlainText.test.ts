import { describe, expect, it } from 'vitest';

import type { Message } from '../domain/types';
import { getMessagePlainText } from './messagePlainText';

describe('getMessagePlainText', () => {
  it('extracts user message text with link line', () => {
    const message = {
      role: 'user',
      content: 'body',
      text: 'body',
      linkLine: { url: 'https://example.com', label: 'Example' },
    } satisfies Pick<Message, 'role' | 'content' | 'text' | 'linkLine'>;

    expect(getMessagePlainText(message)).toBe('[Example](https://example.com) body');
  });

  it('extracts assistant content', () => {
    const message = {
      role: 'assistant',
      content: 'Hello from assistant',
    } satisfies Pick<Message, 'role' | 'content'>;

    expect(getMessagePlainText(message)).toBe('Hello from assistant');
  });
});
