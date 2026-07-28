import { describe, expect, it } from 'vitest';

import type { Topic } from './types';
import {
  filterTopicsForAgent,
  resolveActiveTopicIdForAgent,
  topicBelongsToAgent,
} from './topicAgentScope';

const topic = (partial: Partial<Topic> & Pick<Topic, 'id'>): Topic => ({
  title: partial.title ?? partial.id,
  status: partial.status ?? 'completed',
  ...partial,
});

describe('topicAgentScope', () => {
  it('isolates topics by agentId', () => {
    const topics = [
      topic({ id: 'a1', agentId: 'topic_copilot' }),
      topic({ id: 'a2', agentId: 'super_admin' }),
      topic({ id: 'a3', status: 'temp' }),
    ];

    expect(filterTopicsForAgent(topics, 'topic_copilot').map((item) => item.id)).toEqual([
      'a1',
      'a3',
    ]);
    expect(topicBelongsToAgent(topics[1]!, 'super_admin')).toBe(true);
    expect(topicBelongsToAgent(topics[1]!, 'topic_copilot')).toBe(false);
  });

  it('uses clientAgentId when topic.agentId is unset', () => {
    const orphan = topic({ id: 'draft-1', status: 'completed' });
    expect(topicBelongsToAgent(orphan, 'topic_copilot', 'topic_copilot')).toBe(true);
    expect(topicBelongsToAgent(orphan, 'super_admin', 'topic_copilot')).toBe(false);
  });

  it('restores preferred active topic when present', () => {
    const topics = [
      topic({ id: 't1', agentId: 'topic_copilot' }),
      topic({ id: 't2', agentId: 'topic_copilot' }),
    ];

    expect(resolveActiveTopicIdForAgent(topics, { preferredId: 't2' })).toBe('t2');
    expect(resolveActiveTopicIdForAgent(topics, { preferredId: 'missing' })).toBe('');
  });

  it('skips temp fallback when switching agents', () => {
    const topics = [
      topic({ id: 'real', agentId: 'topic_copilot' }),
      topic({ id: 'draft', status: 'temp', agentId: 'topic_copilot' }),
    ];

    expect(resolveActiveTopicIdForAgent(topics)).toBe('draft');
    expect(resolveActiveTopicIdForAgent(topics, { skipTempFallback: true })).toBe('');
  });
});
