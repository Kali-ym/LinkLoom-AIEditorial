import { describe, expect, it } from 'vitest';

import type { AgentSession } from '../src/services/agents/engine/AgentSession.js';
import { WorkspaceStateService } from '../src/services/agents/workspace/WorkspaceStateService.js';

function createService(initial?: AgentSession) {
  let session = initial;
  const service = new WorkspaceStateService(
    async (runId) => (session?.runId === runId ? session : null),
    async (next) => {
      session = next;
    },
  );
  return {
    service,
    getSession: () => session,
  };
}

const baseSession: AgentSession = {
  sessionId: 'session-1',
  runId: 'run-1',
  threadId: 'thread-1',
  source: 'agent',
  status: 'running',
  messages: [],
  events: [],
  checkpoints: [],
  artifacts: [],
  createdAt: '2026-06-23T00:00:00.000Z',
  updatedAt: '2026-06-23T00:00:00.000Z',
};

describe('WorkspaceStateService', () => {
  it('creates todos and persists them on the session', async () => {
    const { service, getSession } = createService({ ...baseSession });

    const result = await service.createTodos('run-1', {
      todos: [
        { content: '整理素材', completed: false },
        { content: '生成选题', completed: false },
      ],
    });

    expect(result.count).toBe(2);
    expect(result.todos).toEqual([
      { id: 'todo-1', content: '整理素材', completed: false },
      { id: 'todo-2', content: '生成选题', completed: false },
    ]);
    expect(getSession()?.workspaceState?.todos).toHaveLength(2);
  });

  it('updates todos by id and clears them', async () => {
    const { service, getSession } = createService({
      ...baseSession,
      workspaceState: {
        todos: [
          { id: 'todo-1', content: 'A', completed: false },
          { id: 'todo-2', content: 'B', completed: false },
        ],
      },
    });

    await service.updateTodos('run-1', {
      updates: [{ id: 'todo-1', completed: true }],
    });

    expect(getSession()?.workspaceState?.todos?.[0]).toMatchObject({
      id: 'todo-1',
      completed: true,
    });

    await service.clearTodos('run-1');
    expect(getSession()?.workspaceState?.todos).toEqual([]);
  });

  it('creates and updates plan state', async () => {
    const { service, getSession } = createService({ ...baseSession });

    const created = await service.createPlan('run-1', {
      goal: '完成选题建议',
      context: '1. 查素材\n2. 查知识库',
    });

    expect(created.goal).toBe('完成选题建议');
    expect(getSession()?.workspaceState?.plan?.goal).toBe('完成选题建议');

    const updated = await service.updatePlan('run-1', { context: '补充竞品分析' });
    expect(updated.plan).toMatchObject({
      goal: '完成选题建议',
      context: '补充竞品分析',
    });
  });
});
