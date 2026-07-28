import { describe, expect, it } from 'vitest';

import {
  mapImportMessagesToRunContext,
  resolveImportRunInput,
  resolveImportTitle,
} from './topicImport';

describe('mapImportMessagesToRunContext', () => {
  it('maps user and assistant messages', () => {
    const result = mapImportMessagesToRunContext([
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi there' },
      { role: 'tool', content: 'ignored' },
    ]);
    expect(result).toEqual([
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi there' },
    ]);
  });

  it('resolves import title and input', () => {
    const messages = mapImportMessagesToRunContext([{ role: 'user', content: 'first turn' }]);
    expect(resolveImportTitle({ title: '  Daily  ' }, 'file.json')).toBe('Daily');
    expect(resolveImportRunInput(messages, 'fallback')).toBe('first turn');
  });
});
