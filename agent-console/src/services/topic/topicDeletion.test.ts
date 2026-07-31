// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import type { Topic } from '../../domain/types';
import { saveClientTopic, removeClientTopic } from './clientTopicStorage';
import { collectClientOnlyTopicIds } from './topicDeletion';

const TOPIC_ID = 'tpc_302c5m9lw4';

describe('collectClientOnlyTopicIds', () => {
  it('marks temp tpc drafts as client-only before sessionStorage is cleared', () => {
    saveClientTopic({
      id: TOPIC_ID,
      title: '新话题',
      messages: [],
      createdAt: new Date().toISOString(),
    });

    const topics: Topic[] = [
      { id: TOPIC_ID, title: '新话题', status: 'temp', agentId: 'super_admin' },
    ];

    expect(collectClientOnlyTopicIds([TOPIC_ID], topics).has(TOPIC_ID)).toBe(true);
    removeClientTopic(TOPIC_ID);
    expect(collectClientOnlyTopicIds([TOPIC_ID], topics).has(TOPIC_ID)).toBe(true);
  });

  it('does not mark persisted server topics as client-only', () => {
    const topics: Topic[] = [
      { id: 'tpc_persisted1', title: '已保存', status: 'completed', agentId: 'super_admin' },
    ];

    expect(collectClientOnlyTopicIds(['tpc_persisted1'], topics).size).toBe(0);
  });
});
