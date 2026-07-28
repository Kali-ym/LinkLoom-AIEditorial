import { describe, expect, it } from 'vitest';

import { TOOLSET_IDS } from '../../../domain/constants/toolsetIdentifiers';
import type { ToolPayload } from '../../../domain/types';
import {
  deriveWorkspacePatchFromTools,
  extractMutatedWorkspacePathsFromTools,
  mapBackendTodosToDomain,
  mapPluginStatePlanToDomain,
  mapRenderTodosToDomain,
  normalizeWorkspaceRelativePath,
} from './workspaceState';

describe('workspaceState mapper', () => {
  it('maps backend todos with ids to domain TodoItem', () => {
    expect(
      mapBackendTodosToDomain([
        { id: 'todo-1', content: '查素材', completed: false },
        { id: 'todo-2', content: '写提纲', completed: true },
      ]),
    ).toEqual([
      { id: 'todo-1', label: '查素材', done: false, status: 'todo' },
      { id: 'todo-2', label: '写提纲', done: true, status: 'completed' },
    ]);
  });

  it('maps render todos without ids', () => {
    expect(
      mapRenderTodosToDomain([
        { content: 'A', completed: true },
        { content: 'B' },
      ]),
    ).toEqual([
      { id: 'todo-1', label: 'A', done: true, status: 'completed' },
      { id: 'todo-2', label: 'B', done: false, status: 'todo' },
    ]);
  });

  it('extracts plan from pluginState', () => {
    expect(mapPluginStatePlanToDomain({ goal: 'G', context: 'C' })).toEqual({
      goal: 'G',
      context: 'C',
    });
    expect(mapPluginStatePlanToDomain({ plan: { goal: 'Nested' } })).toEqual({
      goal: 'Nested',
    });
  });
});

describe('deriveWorkspacePatchFromTools', () => {
  it('builds patch from successful workspace tools', () => {
    const tools: ToolPayload[] = [
      {
        identifier: TOOLSET_IDS.AGENT,
        apiName: 'createTodos',
        state: 'success',
        pluginState: {
          todos: [{ content: '查知识库', completed: false }],
        },
      },
      {
        identifier: TOOLSET_IDS.AGENT,
        apiName: 'createPlan',
        state: 'success',
        pluginState: { goal: '完成选题' },
      },
    ];

    expect(deriveWorkspacePatchFromTools(tools)).toEqual({
      todos: [{ id: 'todo-1', label: '查知识库', done: false, status: 'todo' }],
      plan: { goal: '完成选题' },
    });
  });

  it('returns null when no workspace tools succeeded', () => {
    expect(
      deriveWorkspacePatchFromTools([
        {
          identifier: TOOLSET_IDS.AGENT,
          apiName: 'createTodos',
          state: 'executing',
        },
      ]),
    ).toBeNull();
  });

  it('clears todos on clearTodos', () => {
    expect(
      deriveWorkspacePatchFromTools([
        {
          identifier: TOOLSET_IDS.AGENT,
          apiName: 'clearTodos',
          state: 'success',
        },
      ]),
    ).toEqual({ todos: [] });
  });
});

describe('normalizeWorkspaceRelativePath', () => {
  it('strips /workspace prefix', () => {
    expect(normalizeWorkspaceRelativePath('/workspace/docs/a.md')).toBe('docs/a.md');
    expect(normalizeWorkspaceRelativePath('notes/b.md')).toBe('notes/b.md');
  });
});

describe('extractMutatedWorkspacePathsFromTools', () => {
  it('collects paths from successful local file mutations', () => {
    const tools: ToolPayload[] = [
      {
        identifier: TOOLSET_IDS.LOCAL_SYSTEM,
        apiName: 'writeFile',
        state: 'success',
        arguments: { path: '/workspace/docs/a.md', content: 'hi' },
      },
      {
        identifier: TOOLSET_IDS.LOCAL_SYSTEM,
        apiName: 'deleteFile',
        state: 'success',
        arguments: { path: 'old.txt' },
      },
      {
        identifier: TOOLSET_IDS.LOCAL_SYSTEM,
        apiName: 'writeFile',
        state: 'executing',
        arguments: { path: 'skip.md' },
      },
    ];

    expect(extractMutatedWorkspacePathsFromTools(tools)).toEqual(['docs/a.md', 'old.txt']);
  });
});
