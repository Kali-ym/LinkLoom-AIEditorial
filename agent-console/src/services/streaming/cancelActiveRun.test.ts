import { beforeEach, describe, expect, it, vi } from 'vitest';

const { cancelAgentRun } = vi.hoisted(() => ({
  cancelAgentRun: vi.fn().mockResolvedValue({ status: 'cancelled' }),
}));

vi.mock('../../adapters/registry', () => ({
  isAgentConsoleApiMode: () => true,
}));

vi.mock('../../adapters/api/agentRun', () => ({
  cancelAgentRun,
}));

import { requestCancelActiveAgentRun } from './cancelActiveRun';

describe('requestCancelActiveAgentRun', () => {
  beforeEach(() => {
    cancelAgentRun.mockClear();
  });

  it('posts cancel for the active run id', async () => {
    requestCancelActiveAgentRun('run_topic_copilot_test');
    await vi.waitFor(() => {
      expect(cancelAgentRun).toHaveBeenCalledWith('run_topic_copilot_test');
    });
  });

  it('ignores empty run ids', () => {
    requestCancelActiveAgentRun('');
    expect(cancelAgentRun).not.toHaveBeenCalled();
  });
});
