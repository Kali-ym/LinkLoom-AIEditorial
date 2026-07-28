import { describe, expect, it } from 'vitest';

import {
  countWorkspaceDocumentFiles,
  flattenVisibleDocumentPaths,
  pruneDescendantWorkspacePaths,
  resolveDocumentCategoryId,
} from './documentTree';

describe('resolveDocumentCategoryId', () => {
  const documents = [
    {
      id: 'cat-1',
      name: 'Notes',
      children: [{ id: 'doc-1', name: 'a.md', path: 'Notes/a.md' }],
    },
    {
      id: 'cat-2',
      name: 'Empty',
      children: [],
    },
  ];

  it('returns selected category id', () => {
    expect(resolveDocumentCategoryId(documents, 'cat-2')).toBe('cat-2');
  });

  it('returns parent category when a document is selected', () => {
    expect(resolveDocumentCategoryId(documents, 'doc-1')).toBe('cat-1');
  });

  it('falls back to first category', () => {
    expect(resolveDocumentCategoryId(documents, null)).toBe('cat-1');
  });
});

describe('pruneDescendantWorkspacePaths', () => {
  it('keeps only ancestor paths when parent and child are both selected', () => {
    expect(pruneDescendantWorkspacePaths(['docs', 'docs/welcome.md', 'notes/a.md'])).toEqual([
      'docs',
      'notes/a.md',
    ]);
  });

  it('deduplicates identical paths', () => {
    expect(pruneDescendantWorkspacePaths(['a.md', 'a.md'])).toEqual(['a.md']);
  });
});

describe('countWorkspaceDocumentFiles', () => {
  it('counts leaf files recursively', () => {
    const tree = [
      {
        id: 'docs',
        name: 'docs',
        children: [
          { id: 'docs/a.md', name: 'a.md' },
          { id: 'docs/b.md', name: 'b.md' },
        ],
      },
      { id: 'readme.md', name: 'readme.md' },
    ];
    expect(countWorkspaceDocumentFiles(tree)).toBe(3);
  });
});

describe('flattenVisibleDocumentPaths', () => {
  it('includes expanded folder children in order', () => {
    const tree = [
      {
        id: 'docs',
        name: 'docs',
        path: 'docs',
        children: [{ id: 'docs/a.md', name: 'a.md', path: 'docs/a.md' }],
      },
    ];
    expect(flattenVisibleDocumentPaths(tree, { docs: true })).toEqual(['docs', 'docs/a.md']);
    expect(flattenVisibleDocumentPaths(tree, {})).toEqual(['docs']);
  });
});
