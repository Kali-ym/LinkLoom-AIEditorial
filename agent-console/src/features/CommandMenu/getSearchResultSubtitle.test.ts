import { describe, expect, it } from 'vitest';

import { getSearchResultSubtitle } from './getSearchResultSubtitle';

describe('getSearchResultSubtitle', () => {
  it('formats topic subtitle with agent name and relative time', () => {
    const subtitle = getSearchResultSubtitle({
      id: 't1',
      title: 'Deploy',
      type: 'topic',
      agentName: 'Copilot',
      updatedAt: '2020-01-01T00:00:00.000Z',
    });
    expect(subtitle).toContain('Copilot');
    expect(subtitle).toContain('·');
  });

  it('formats message subtitle with topic title and preview', () => {
    const subtitle = getSearchResultSubtitle({
      id: 'm1',
      title: 'hello',
      type: 'message',
      topicTitle: 'RSS 整理',
      description: '请帮我整理 RSS 订阅',
    });
    expect(subtitle).toBe('RSS 整理 · 请帮我整理 RSS 订阅');
  });

  it('prefers explicit subtitle when provided', () => {
    const subtitle = getSearchResultSubtitle({
      id: 'x',
      title: 'Title',
      type: 'agent',
      subtitle: '自定义副标题',
      description: 'ignored',
    });
    expect(subtitle).toBe('自定义副标题');
  });
});
