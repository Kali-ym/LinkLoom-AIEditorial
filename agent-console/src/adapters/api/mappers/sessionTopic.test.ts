import { describe, expect, it } from 'vitest';

import { aggregateSessionsFromRuns, mapRunStatusToTopicStatus } from './sessionTopic';
import type { BackendAgentRunDto } from '../types/session';

function run(partial: Partial<BackendAgentRunDto> & Pick<BackendAgentRunDto, 'sessionId' | 'runId'>): BackendAgentRunDto {
  return {
    agentId: 'agent-1',
    status: 'succeeded',
    createdAt: '2026-06-20T08:00:00.000Z',
    updatedAt: '2026-06-20T08:01:00.000Z',
    ...partial,
  };
}

describe('mapRunStatusToTopicStatus', () => {
  it('maps terminal run statuses to sidebar topic icons source states', () => {
    expect(mapRunStatusToTopicStatus(run({ sessionId: 's1', runId: 'r1', status: 'failed' }))).toBe('failed');
    expect(mapRunStatusToTopicStatus(run({ sessionId: 's1', runId: 'r1', status: 'succeeded' }))).toBe('completed');
    expect(mapRunStatusToTopicStatus(run({ sessionId: 's1', runId: 'r1', status: 'cancelled' }))).toBe('completed');
    expect(mapRunStatusToTopicStatus(run({ sessionId: 's1', runId: 'r1', status: 'running' }))).toBe('running');
    expect(mapRunStatusToTopicStatus(run({ sessionId: 's1', runId: 'r1', status: 'paused' }))).toBe('waiting');
    expect(
      mapRunStatusToTopicStatus(
        run({ sessionId: 's1', runId: 'r1', status: 'running', pendingPermission: { id: 'p1' } as any }),
      ),
    ).toBe('waiting');
  });
});

describe('aggregateSessionsFromRuns', () => {
  it('omits sessions whose runs are all archived', () => {
    const aggregates = aggregateSessionsFromRuns([
      run({
        sessionId: 'session-visible',
        runId: 'run-visible',
        outputPreview: '可见话题',
      }),
      run({
        sessionId: 'session-hidden',
        runId: 'run-hidden',
        status: 'archived',
        outputPreview: '已删除话题',
      }),
    ]);

    expect(aggregates.map((item) => item.sessionId)).toEqual(['session-visible']);
  });

  it('omits sessions marked topicDeleted in metadata', () => {
    const aggregates = aggregateSessionsFromRuns([
      run({
        sessionId: 'session-visible',
        runId: 'run-visible',
        outputPreview: '可见话题',
      }),
      run({
        sessionId: 'session-hidden',
        runId: 'run-hidden',
        metadata: { topicDeleted: true },
        outputPreview: '软删除话题',
      }),
    ]);

    expect(aggregates.map((item) => item.sessionId)).toEqual(['session-visible']);
  });
});
