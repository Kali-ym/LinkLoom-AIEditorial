import { describe, expect, it } from 'vitest';

import {
  mapAgentFilesToMentionFiles,
  mapKbDocumentsToMentionFiles,
  mergeMentionFiles,
} from './inputMenu';

describe('inputMenu mappers', () => {
  it('maps enabled agent files to mention file items', () => {
    expect(
      mapAgentFilesToMentionFiles(
        [
          { id: 'f1', name: 'README.md', enabled: true },
          { id: 'f2', name: 'src/App.tsx', enabled: false },
        ],
        { enabledOnly: true },
      ),
    ).toEqual([
      { kind: 'file', label: 'README.md', type: 'f1', path: 'README.md' },
    ]);
  });

  it('maps kb documents with kb-doc type prefix', () => {
    expect(
      mapKbDocumentsToMentionFiles([
        { id: 'doc-1', name: 'Runbook.md', path: 'Ops/Runbook.md' },
      ]),
    ).toEqual([
      {
        kind: 'file',
        label: 'Runbook.md',
        type: 'kb-doc-doc-1',
        path: 'Ops/Runbook.md',
      },
    ]);
  });

  it('merges agent files and kb docs without duplicates', () => {
    const merged = mergeMentionFiles(
      mapAgentFilesToMentionFiles([{ id: 'f1', name: 'README.md', enabled: true }]),
      mapKbDocumentsToMentionFiles([
        { id: 'doc-1', name: 'README.md', path: 'README.md' },
        { id: 'doc-2', name: 'Guide.md', path: 'Docs/Guide.md' },
      ]),
    );

    expect(merged).toHaveLength(2);
    expect(merged.map((item) => item.label)).toEqual(['README.md', 'Guide.md']);
  });
});
