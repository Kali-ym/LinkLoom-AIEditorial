import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../stores/topicStore', () => ({
  useTopicStore: {
    getState: vi.fn(() => ({ activeTopicId: 'topic-a' })),
  },
}));

import { useChatStore } from '../../stores/chatStore';
import { useStreamingStore } from '../../stores/streamingStore';
import { useTopicStore } from '../../stores/topicStore';
import {
  isActiveTopicStreaming,
  isTopicStreaming,
} from './streamingScope';

describe('streamingScope', () => {
  beforeEach(() => {
    useStreamingStore.setState({
      streamsByTopicId: {},
      messageQueueByTopicId: {},
    });
    useChatStore.setState({
      streamingByTopicId: {},
      streamTimingMetaByTopicId: {},
      streamUserTextByTopicId: {},
    });
    vi.mocked(useTopicStore.getState).mockReturnValue({ activeTopicId: 'topic-a' } as never);
  });

  it('scopes streaming to the owning topic', () => {
    useStreamingStore.setState({
      streamsByTopicId: {
        'topic-a': { ...useStreamingStore.getState().getStreamRuntime('topic-a'), isStreaming: true },
      },
    });

    expect(isTopicStreaming('topic-a')).toBe(true);
    expect(isTopicStreaming('topic-b')).toBe(false);
    expect(isActiveTopicStreaming()).toBe(true);

    vi.mocked(useTopicStore.getState).mockReturnValue({ activeTopicId: 'topic-b' } as never);
    expect(isActiveTopicStreaming()).toBe(false);
  });

  it('allows concurrent streams on different topics', () => {
    useStreamingStore.setState({
      streamsByTopicId: {
        'topic-a': { ...useStreamingStore.getState().getStreamRuntime('topic-a'), isStreaming: true },
        'topic-b': { ...useStreamingStore.getState().getStreamRuntime('topic-b'), isStreaming: true },
      },
    });

    expect(isTopicStreaming('topic-a')).toBe(true);
    expect(isTopicStreaming('topic-b')).toBe(true);
  });
});
