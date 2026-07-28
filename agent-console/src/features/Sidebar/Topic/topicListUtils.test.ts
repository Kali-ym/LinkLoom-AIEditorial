import { describe, expect, it } from 'vitest';

import type { Topic } from '../../../domain/types';
import { mergeTopicListWithOptimistic, splitTempTopics } from './topicListUtils';

describe('topicListUtils', () => {
  it('splitTempTopics separates draft topics from persisted ones', () => {
    const topics: Topic[] = [
      { id: 'tpc_draft', title: '新话题', status: 'temp' },
      { id: 'tpc_old', title: '旧话题', status: 'completed' },
    ];

    expect(splitTempTopics(topics)).toEqual({
      tempTopics: [{ id: 'tpc_draft', title: '新话题', status: 'temp' }],
      rest: [{ id: 'tpc_old', title: '旧话题', status: 'completed' }],
    });
  });

  it('mergeTopicListWithOptimistic keeps local running topics before server list', () => {
    const now = '2026-06-25T12:00:00.000Z';
    const localTopics: Topic[] = [
      {
        id: 'tpc_new',
        title: '帮我写脚本',
        status: 'running',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'tpc_old',
        title: '旧话题',
        status: 'completed',
        createdAt: '2026-06-24T12:00:00.000Z',
        updatedAt: '2026-06-24T12:00:00.000Z',
      },
    ];
    const serverTopics: Topic[] = [
      {
        id: 'tpc_old',
        title: '旧话题',
        status: 'completed',
        createdAt: '2026-06-24T12:00:00.000Z',
        updatedAt: '2026-06-24T12:00:00.000Z',
      },
    ];

    const merged = mergeTopicListWithOptimistic(localTopics, serverTopics, 'tpc_new');

    expect(merged.map((topic) => topic.id)).toEqual(['tpc_new', 'tpc_old']);
    expect(merged[0]?.active).toBe(true);
  });
});
