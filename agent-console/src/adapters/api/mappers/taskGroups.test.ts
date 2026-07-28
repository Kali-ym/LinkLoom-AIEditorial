import { describe, expect, it } from 'vitest';

import {
  classifyRunTaskGroup,
  mapAgentRunsToTaskGroups,
  mapRunToSidebarTask,
  resolveTaskName,
} from './taskGroups';

const baseRun = {
  runId: 'run_test_1',
  sessionId: 'session_abc',
  status: 'running',
  createdAt: '2026-06-20T10:00:00Z',
  updatedAt: '2026-06-20T10:05:00Z',
};

describe('mapAgentRunsToTaskGroups', () => {
  it('groups pending permission runs under needsInput', () => {
    const groups = mapAgentRunsToTaskGroups([
      {
        ...baseRun,
        status: 'paused',
        agentId: 'agent-1',
        pendingPermission: {
          subject: { toolName: 'm2_seed_echo' },
        },
      },
      {
        ...baseRun,
        runId: 'run_test_2',
        status: 'running',
        agentId: 'agent-1',
      },
    ]);

    expect(groups.map((g) => g.key)).toEqual(['needsInput', 'running']);
    expect(groups[0].tasks[0].status).toBe('paused');
    expect(resolveTaskName({
      ...baseRun,
      pendingPermission: { subject: { toolName: 'm2_seed_echo' } },
    })).toContain('m2_seed_echo');
  });

  it('maps failed runs to needsInput', () => {
    expect(classifyRunTaskGroup({ ...baseRun, status: 'failed' })).toBe('needsInput');
  });

  it('skips archived and succeeded runs', () => {
    expect(classifyRunTaskGroup({ ...baseRun, status: 'archived' })).toBeNull();
    expect(classifyRunTaskGroup({ ...baseRun, status: 'succeeded' })).toBeNull();
  });

  it('maps sidebar task topicId from sessionId', () => {
    const task = mapRunToSidebarTask({ ...baseRun, status: 'running' });
    expect(task.topicId).toBe('session_abc');
    expect(task.id).toBe('run_test_1');
  });
});
