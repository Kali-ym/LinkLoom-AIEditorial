import { describe, expect, it } from 'vitest';

import { TOOLSET_IDS } from '../../../domain/constants/toolsetIdentifiers';
import type { ToolPayload } from '../../../domain/types';
import {
  deriveWebPagesFromTools,
  enrichWebBrowsingPluginState,
} from './webBrowsingState';

describe('webBrowsingState', () => {
  it('derives pages array from crawl results when pages missing', () => {
    expect(
      enrichWebBrowsingPluginState(
        'crawl_single_page',
        {
          results: [{ url: 'https://example.com', title: 'Example', content: 'Body' }],
        },
        { url: 'https://example.com' },
      ),
    ).toEqual({
      results: [{ url: 'https://example.com', title: 'Example', content: 'Body' }],
      pages: [{ url: 'https://example.com', title: 'Example' }],
    });
  });

  it('syncs search and crawl tools into workspace web pages', () => {
    const tools: ToolPayload[] = [
      {
        identifier: TOOLSET_IDS.WEB_BROWSING,
        apiName: 'search',
        state: 'success',
        pluginState: {
          results: [{ title: 'Hit A', url: 'https://a.example' }],
        },
      },
      {
        identifier: TOOLSET_IDS.WEB_BROWSING,
        apiName: 'crawlMultiPages',
        state: 'success',
        pluginState: {
          pages: [{ title: 'Page B', url: 'https://b.example' }],
        },
      },
    ];

    expect(deriveWebPagesFromTools(tools)).toEqual([
      expect.objectContaining({ title: 'Hit A', url: 'https://a.example' }),
      expect.objectContaining({ title: 'Page B', url: 'https://b.example' }),
    ]);
  });
});
