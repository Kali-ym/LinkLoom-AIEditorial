// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../adapters/registry', () => ({
  getAgentConsolePorts: vi.fn(() => ({
    runtime: { getQueueDemoItems: vi.fn(async () => []) },
  })),
}));

vi.mock('../services/streaming/cancelActiveRun', () => ({
  requestCancelActiveAgentRun: vi.fn(),
}));

import { useStreamingStore } from './streamingStore';

describe('streamingStore.beginStreaming', () => {
  const topicId = 'topic-stream-metrics';

  beforeEach(() => {
    useStreamingStore.setState({
      streamsByTopicId: {},
      messageQueueByTopicId: {},
      pendingApprovalContextByTopicId: {},
      lastEventSeqByRunId: {},
    });
  });

  it('resets token and elapsed metrics on a fresh stream', () => {
    const store = useStreamingStore.getState();
    store.beginStreaming(topicId);
    store.addTokenCount(topicId, 240);
    store.tickOpElapsed(topicId);
    store.tickOpElapsed(topicId);

    store.beginStreaming(topicId);

    const runtime = useStreamingStore.getState().getStreamRuntime(topicId);
    expect(runtime.tokenCount).toBe(0);
    expect(runtime.opElapsedMs).toBe(0);
  });

  it('preserves token and elapsed metrics when resuming after approval', () => {
    const store = useStreamingStore.getState();
    store.beginStreaming(topicId);
    store.addTokenCount(topicId, 240);
    store.tickOpElapsed(topicId);
    store.tickOpElapsed(topicId);
    store.endStreaming(topicId);

    store.beginStreaming(topicId, { preserveMetrics: true });

    const runtime = useStreamingStore.getState().getStreamRuntime(topicId);
    expect(runtime.tokenCount).toBe(240);
    expect(runtime.opElapsedMs).toBe(500);
    expect(runtime.isStreaming).toBe(true);
  });
});
