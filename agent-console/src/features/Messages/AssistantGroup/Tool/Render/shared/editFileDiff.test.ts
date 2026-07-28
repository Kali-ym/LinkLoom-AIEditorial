import { describe, expect, it } from 'vitest';

import { resolveEditFileDiff } from './editFileDiff';

describe('resolveEditFileDiff', () => {
  it('uses search/replace args for linkloom edit_workspace_file', () => {
    expect(
      resolveEditFileDiff({
        path: '/workspace/prime.py',
        search: 'def is_prime(n):',
        replace: 'def is_prime(n: int) -> bool:',
      }),
    ).toEqual({
      filePath: '/workspace/prime.py',
      oldContent: 'def is_prime(n):',
      newContent: 'def is_prime(n: int) -> bool:',
    });
  });

  it('uses old_string/new_string for cursor-style edits', () => {
    expect(
      resolveEditFileDiff({
        file_path: 'src/a.ts',
        old_string: 'foo',
        new_string: 'bar',
      }),
    ).toEqual({
      filePath: 'src/a.ts',
      oldContent: 'foo',
      newContent: 'bar',
    });
  });

  it('ignores JSON tool result content', () => {
    expect(
      resolveEditFileDiff(
        { path: '/workspace/prime.py' },
        '{"path":"/workspace/prime.py","replacements":1,"bytesWritten":1313}',
      ),
    ).toEqual({
      filePath: '/workspace/prime.py',
      oldContent: '',
      newContent: '',
    });
  });
});
