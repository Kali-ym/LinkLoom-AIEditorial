import { describe, expect, it } from 'vitest';

import {
  mergeBindingsIntoPlusState,
  resolveBindingResourceTypeForKnowledge,
  resolveBindingResourceTypeForFile,
} from './agentBindings';

describe('agentBindings mappers', () => {
  const baseState = {
    knowledgeBases: [
      { id: 'cat-a', name: 'Cat A', enabled: false },
      { id: 'cat-b', name: 'Cat B', enabled: false },
    ],
    files: [{ id: 'file-1', name: 'readme.md', enabled: false }],
  } as any;

  it('marks kb_category bindings as enabled', () => {
    const merged = mergeBindingsIntoPlusState(baseState, [
      {
        id: 'b1',
        agentId: 'agent-1',
        resourceType: 'kb_category',
        resourceId: 'cat-a',
        createdAt: 1,
      },
    ]);
    expect(merged.knowledgeBases.find((kb) => kb.id === 'cat-a')?.enabled).toBe(true);
    expect(merged.knowledgeBases.find((kb) => kb.id === 'cat-b')?.enabled).toBe(false);
  });

  it('marks file bindings as enabled', () => {
    const merged = mergeBindingsIntoPlusState(baseState, [
      {
        id: 'b2',
        agentId: 'agent-1',
        resourceType: 'file',
        resourceId: 'file-1',
        createdAt: 1,
      },
    ]);
    expect(merged.files[0]?.enabled).toBe(true);
  });

  it('maps knowledge and file resource types for port calls', () => {
    expect(resolveBindingResourceTypeForKnowledge()).toBe('kb_category');
    expect(resolveBindingResourceTypeForFile()).toBe('file');
  });
});
