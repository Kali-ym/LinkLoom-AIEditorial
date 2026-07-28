import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CommandSearchResult } from '../../domain/types/commandSearch';
import {
  applyCommandSearchSelection,
  isStaticSearchAction,
} from './commandSearchNavigation';

const openPortalView = vi.hoisted(() => vi.fn());

vi.mock('../Portal/portalActions', () => ({
  openPortalView,
}));

function result(partial: CommandSearchResult): CommandSearchResult {
  return partial;
}

function createDeps() {
  return {
    navigate: vi.fn(),
    newTopic: vi.fn(),
    onFallback: vi.fn(),
    openWorkingSidebar: vi.fn(),
    selectTopic: vi.fn(),
    setActiveAgentId: vi.fn(),
  };
}

describe('commandSearchNavigation', () => {
  beforeEach(() => {
    openPortalView.mockClear();
  });

  it('recognizes static console search actions', () => {
    expect(isStaticSearchAction({ id: 'action-new-topic' })).toBe(true);
    expect(isStaticSearchAction({ id: 'kb-doc-1' })).toBe(false);
  });

  it('opens KB document portal for knowledgeBase hits', () => {
    const deps = createDeps();
    applyCommandSearchSelection(
      result({
        id: 'kb_abc',
        title: 'Runbook',
        description: 'ops/runbook.md',
        type: 'knowledgeBase',
      }),
      deps,
    );

    expect(openPortalView).toHaveBeenCalledWith('Document', {
      documentId: 'kb_abc',
      title: 'Runbook',
      path: 'ops/runbook.md',
    });
    expect(deps.onFallback).not.toHaveBeenCalled();
  });

  it('navigates to knowledge for static resource action', () => {
    const deps = createDeps();
    applyCommandSearchSelection(
      result({
        id: 'action-resource',
        title: '资源',
        type: 'knowledgeBase',
      }),
      deps,
    );

    expect(deps.navigate).toHaveBeenCalledWith('/knowledge');
    expect(openPortalView).not.toHaveBeenCalled();
  });

  it('creates topic for static new-topic action', () => {
    const deps = createDeps();
    applyCommandSearchSelection(
      result({
        id: 'action-new-topic',
        title: '新建话题',
        type: 'plugin',
      }),
      deps,
    );

    expect(deps.newTopic).toHaveBeenCalled();
  });

  it('opens file preview for file hits', () => {
    openPortalView.mockClear();
    const deps = createDeps();
    applyCommandSearchSelection(
      result({
        id: 'file-app',
        title: 'App.tsx',
        description: 'studio/src/App.tsx',
        type: 'file',
      }),
      deps,
    );

    expect(openPortalView).toHaveBeenCalledWith('FilePreview', {
      name: 'App.tsx',
      path: 'studio/src/App.tsx',
    });
  });

  it('opens working sidebar for plugin skill hits', () => {
    const deps = createDeps();
    applyCommandSearchSelection(
      result({
        id: 'skill-web',
        title: '网页浏览',
        type: 'plugin',
      }),
      deps,
    );

    expect(deps.openWorkingSidebar).toHaveBeenCalledWith({
      tab: 'space',
      resourceFilter: 'skills',
    });
  });

  it('falls back for unsupported community hits', () => {
    const deps = createDeps();
    const hit = result({
      id: 'community-coder',
      title: 'Coder Agent',
      type: 'communityAgent',
    });
    applyCommandSearchSelection(hit, deps);

    expect(deps.onFallback).toHaveBeenCalledWith(hit);
  });
});
