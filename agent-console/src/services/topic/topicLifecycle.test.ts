// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';

import { useTopicStore } from '../../stores/topicStore';
import {
  applyTopicStatusAfterStream,
  markTopicRunning,
} from './topicLifecycle';

describe('topicLifecycle', () => {
  beforeEach(() => {
    useTopicStore.setState({
      topics: [
        {
          id: 'tpc_run00001',
          title: '旧标题',
          status: 'completed',
          agentId: 'agent_a',
        },
      ],
      activeTopicId: 'tpc_run00001',
      elapsedByTopicId: {},
    });
  });

  it('markTopicRunning sets running and seeds elapsed', () => {
    markTopicRunning('tpc_run00001', { titleHint: '你好世界' });
    const topic = useTopicStore.getState().topics[0];
    expect(topic).toMatchObject({
      id: 'tpc_run00001',
      status: 'running',
      title: '你好世界',
      active: true,
    });
    expect(useTopicStore.getState().elapsedByTopicId['tpc_run00001']).toBe('00:00');
  });

  it('applyTopicStatusAfterStream writes terminal sidebar statuses', () => {
    markTopicRunning('tpc_run00001');

    applyTopicStatusAfterStream('tpc_run00001', {
      keepForApproval: false,
      turnFailed: false,
      aborted: false,
    });
    expect(useTopicStore.getState().topics[0]?.status).toBe('completed');

    markTopicRunning('tpc_run00001');
    applyTopicStatusAfterStream('tpc_run00001', {
      keepForApproval: false,
      turnFailed: true,
      aborted: false,
    });
    expect(useTopicStore.getState().topics[0]?.status).toBe('failed');

    markTopicRunning('tpc_run00001');
    applyTopicStatusAfterStream('tpc_run00001', {
      keepForApproval: true,
      turnFailed: false,
      aborted: false,
    });
    expect(useTopicStore.getState().topics[0]?.status).toBe('waiting');
  });
});
