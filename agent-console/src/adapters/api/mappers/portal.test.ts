import { describe, expect, it } from 'vitest';

import { mapArtifactResponseToPortalPayload } from './portalArtifact';
import {
  mapKbContentToDocumentPayload,
  resolveKbDocumentId,
} from './portalKbDocument';
import { resolveSearchState } from '../portalToolResolve';

describe('mapArtifactResponseToPortalPayload', () => {
  it('maps artifact content into portal fields', () => {
    const result = mapArtifactResponseToPortalPayload(
      { title: 'Custom' },
      {
        runId: 'run_1',
        artifact: {
          artifactId: 'art_1',
          preview: 'preview text',
          metadata: { title: 'Meta title' },
        },
        content: 'const App = () => null;',
      },
    );

    expect(result.artifactCode).toBe('const App = () => null;');
    expect(result.title).toBe('Custom');
    expect(result.runId).toBe('run_1');
  });
});

describe('mapKbContentToDocumentPayload', () => {
  it('fills document content from kb api', () => {
    const result = mapKbContentToDocumentPayload(
      { documentId: 'kb_abc', title: 'Daily' },
      { content: '# Hello' },
    );
    expect(result.content).toBe('# Hello');
    expect(result.title).toBe('Daily');
  });

  it('resolves kb document id', () => {
    expect(resolveKbDocumentId({ documentId: 'kb_1' })).toBe('kb_1');
    expect(resolveKbDocumentId({ id: 'kb_2' })).toBe('kb_2');
    expect(resolveKbDocumentId({ id: 'other' })).toBeUndefined();
  });
});

describe('api resolveSearchState', () => {
  it('returns empty results without mock fixtures', () => {
    expect(resolveSearchState({ plugin: 'linkloom-web-browsing', api: 'search' })).toEqual({
      loading: false,
      results: [],
    });
  });
});
