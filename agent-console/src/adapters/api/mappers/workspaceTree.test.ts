import { describe, expect, it } from 'vitest';

import { mapWorkspaceTreeToDocumentNodes } from './workspaceTree';

describe('mapWorkspaceTreeToDocumentNodes', () => {
  it('maps directory with file child correctly', () => {
    const nodes = mapWorkspaceTreeToDocumentNodes([
      {
        path: 'docs',
        name: 'docs',
        type: 'directory',
        children: [
          {
            path: 'docs/readme.md',
            name: 'readme.md',
            type: 'file',
            size: 42,
          },
        ],
      },
    ]);

    expect(nodes).toEqual([
      {
        id: 'docs',
        name: 'docs',
        path: 'docs',
        badge: '1',
        children: [
          {
            id: 'docs/readme.md',
            name: 'readme.md',
            path: 'docs/readme.md',
          },
        ],
      },
    ]);
  });
});
