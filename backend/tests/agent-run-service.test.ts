import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { describe, expect, it, vi } from 'vitest';

const mockResolveUserTurnFiles = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    fileList: [],
    imageList: [],
  }),
);

const mockDestroySandbox = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ agentId: 'agent-1', status: 'destroyed' }),
);
const mockTryCreateAgentSandboxService = vi.hoisted(() => vi.fn());

vi.mock('../src/services/agents/AgentUploadService.js', () => ({
  AgentUploadService: class MockAgentUploadService {},
}));

vi.mock('../src/services/agents/sandbox/AgentSandboxService.js', () => ({
  tryCreateAgentSandboxService: (...args: unknown[]) => mockTryCreateAgentSandboxService(...args),
}));

vi.mock('../src/services/agents/UserTurnFileResolver.js', () => ({
  UserTurnFileResolver: class MockUserTurnFileResolver {
    async resolve(...args: unknown[]) {
      return mockResolveUserTurnFiles(...args);
    }
  },
}));

import { AGENT_EVENT_SCHEMA_VERSION } from '../src/services/agents/engine/AgentEvent.js';
import { AgentService } from '../src/services/agents/AgentService.js';
import { AgentRunService } from '../src/services/api/AgentRunService.js';

function createStore(agent: any = { id: 'agent-1', streaming: false }) {
  return {
    listAgents: vi.fn().mockResolvedValue([agent, { id: 'hidden', isHidden: true }]),
    getAgent: vi.fn().mockResolvedValue(agent),
    listMCPConfigs: vi.fn().mockResolvedValue([]),
    saveAgent: vi.fn().mockResolvedValue(undefined),
    listWorkflows: vi.fn().mockResolvedValue([]),
    deleteAgent: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(undefined)
  };
}

function createContext(agentService?: Record<string, unknown>) {
  if (agentService === undefined) {
    return {
      agentService: undefined,
      reload: vi.fn().mockResolvedValue(undefined),
      aiProvider: undefined,
      proxyAgent: undefined
    };
  }

  return {
    agentService: {
      assertConversationCanAcceptNewRun: vi.fn().mockResolvedValue(undefined),
      ...agentService,
    },
    reload: vi.fn().mockResolvedValue(undefined),
    aiProvider: undefined,
    proxyAgent: undefined
  };
}

async function collectAsyncIterable(iterable: AsyncIterable<any>) {
  const chunks: any[] = [];
  for await (const chunk of iterable) chunks.push(chunk);
  return chunks;
}

describe('AgentRunService', () => {
  it('decides streaming from request override and agent default', async () => {
    const store = createStore({ id: 'agent-1', streaming: true });
    const service = new AgentRunService(store as any, createContext({}) as any);

    await expect(service.shouldStreamAgent('agent-1', undefined)).resolves.toBe(true);
    await expect(service.shouldStreamAgent('agent-1', true)).resolves.toBe(true);
    await expect(service.shouldStreamAgent('agent-1', false)).resolves.toBe(false);

    expect(store.getAgent).toHaveBeenCalledTimes(3);
  });

  it('falls back to non-streaming when agent has no streaming default', async () => {
    const service = new AgentRunService(
      createStore({ id: 'agent-1' }) as any,
      createContext({}) as any
    );

    await expect(service.shouldStreamAgent('agent-1', undefined)).resolves.toBe(false);
  });

  it('destroys sandbox before deleting agent when sandbox runtime is available', async () => {
    const store = createStore({ id: 'agent-1' });
    mockTryCreateAgentSandboxService.mockReturnValue({
      destroySandbox: mockDestroySandbox,
    });
    const service = new AgentRunService(store as any, createContext({}) as any);

    await expect(service.deleteAgent('agent-1')).resolves.toEqual({ status: 'success' });

    expect(mockDestroySandbox).toHaveBeenCalledWith('agent-1', { clearVolume: true });
    expect(store.deleteAgent).toHaveBeenCalledWith('agent-1');
  });

  it('passes through non-stream run result with stopReason and trace', async () => {
    const result = {
      content: 'answer',
      stopReason: 'final',
      trace: {
        runId: 'run-1',
        mode: 'react',
        startedAt: '2026-01-01T00:00:00.000Z',
        rounds: []
      }
    };
    const agentService = {
      runAgent: vi.fn().mockResolvedValue(result)
    };
    const service = new AgentRunService(createStore() as any, createContext(agentService) as any);

    await expect(service.runAgent('agent-1', 'hello', '2026-01-01')).resolves.toBe(result);
    expect(agentService.runAgent).toHaveBeenCalledWith('agent-1', 'hello', '2026-01-01');
  });

  it('passes through stream chunks including final_trace', async () => {
    const chunks = [
      { type: 'content', content: 'partial' },
      { type: 'final_trace', stopReason: 'final' }
    ];
    const agentService = {
      async *streamAgent() {
        for (const chunk of chunks) yield chunk;
      }
    };
    const service = new AgentRunService(createStore() as any, createContext(agentService) as any);

    await expect(
      collectAsyncIterable(service.streamAgent('agent-1', 'hello', '2026-01-01'))
    ).resolves.toEqual(chunks);
  });

  it('keeps initialization errors explicit', () => {
    const service = new AgentRunService(createStore() as any, createContext(undefined) as any);

    expect(() => service.runAgent('agent-1', 'hello')).toThrow(
      'Agent Service not initialized (check AI Provider)'
    );
    expect(() => service.streamAgent('agent-1', 'hello')).toThrow('Agent Service not initialized');
  });

  it('rejects cancelling already closed runs at API boundary', async () => {
    const agentService = {
      getRunSession: vi.fn().mockResolvedValue({
        runId: 'run-1',
        sessionId: 'session-1',
        status: 'archived',
        metadata: {}
      }),
      cancelRun: vi.fn()
    };
    const service = new AgentRunService(createStore() as any, createContext(agentService) as any);

    await expect(service.cancelRun('run-1')).rejects.toThrow(
      'Only active runs can be cancelled (current: archived)'
    );
    expect(agentService.cancelRun).not.toHaveBeenCalled();
  });

  it('archives only terminal source statuses at API boundary', async () => {
    const agentService = {
      getRunSession: vi.fn().mockResolvedValue({
        runId: 'run-1',
        sessionId: 'session-1',
        status: 'cancelling',
        metadata: {}
      }),
      archiveRun: vi.fn()
    };
    const service = new AgentRunService(createStore() as any, createContext(agentService) as any);

    await expect(service.archiveRun('run-1')).rejects.toThrow(
      'Only terminal runs can be archived (current: cancelling)'
    );
    expect(agentService.archiveRun).not.toHaveBeenCalled();
  });

  it('passes thread and session identity through startAgentRun', async () => {
    const streamAgent = vi.fn(async function* (_agentId, _input, _date, options) {
      options.onRunCreated({
        runId: 'run-1',
        sessionId: 'session-custom',
        threadId: 'thread-custom',
        source: 'agent',
        agentDef: { id: 'agent-1' },
        input: {}
      });
      yield { type: 'content', content: 'ok' };
    });
    const agentService = { streamAgent, runAgent: vi.fn() };
    const context = createContext(agentService);
    const service = new AgentRunService(createStore() as any, context as any);

    await expect(
      service.startAgentRun({
        agentId: 'agent-1',
        message: 'hello',
        threadId: 'thread-custom',
        sessionId: 'session-custom'
      })
    ).resolves.toMatchObject({
      runId: 'run-1',
      sessionId: 'session-custom',
      threadId: 'thread-custom',
      status: 'queued'
    });
    expect(streamAgent).toHaveBeenCalledWith(
      'agent-1',
      'hello',
      undefined,
      expect.objectContaining({ threadId: 'thread-custom', sessionId: 'session-custom' })
    );
    expect(context.agentService.assertConversationCanAcceptNewRun).toHaveBeenCalledWith('session-custom');
    expect(agentService.runAgent).not.toHaveBeenCalled();
  });

  it('rejects startAgentRun when the conversation still awaits tool approval', async () => {
    const agentService = {
      streamAgent: vi.fn(),
      runAgent: vi.fn(),
      assertConversationCanAcceptNewRun: vi.fn().mockRejectedValue(
        new Error('当前会话有未完成的工具审批，请先批准或拒绝后再发送新消息。')
      )
    };
    const service = new AgentRunService(createStore() as any, createContext(agentService) as any);

    await expect(
      service.startAgentRun({
        agentId: 'agent-1',
        message: '你好',
        sessionId: 'session-paused'
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      message: '当前会话有未完成的工具审批，请先批准或拒绝后再发送新消息。'
    });
    expect(agentService.streamAgent).not.toHaveBeenCalled();
  });

  it('injects sandbox workspace policy from agent config into startAgentRun', async () => {
    const streamAgent = vi.fn(async function* (_agentId, _input, _date, options) {
      options.onRunCreated({
        runId: 'run-1',
        sessionId: 'session-1',
        threadId: 'thread-1',
        source: 'agent',
        agentDef: { id: 'agent-1' },
        workspacePolicy: options.workspacePolicy,
        input: {}
      });
      yield { type: 'content', content: 'ok' };
    });
    const agentService = { streamAgent, runAgent: vi.fn() };
    const store = createStore({
      id: 'agent-1',
      streaming: true,
      metadata: {
        agentConsole: {
          executionTarget: 'sandbox',
          sandboxPolicy: { image: 'linkloom-agent:latest' }
        }
      }
    });
    const service = new AgentRunService(store as any, createContext(agentService) as any);

    await expect(
      service.startAgentRun({
        agentId: 'agent-1',
        message: 'hello'
      })
    ).resolves.toMatchObject({
      workspace: {
        mode: 'docker',
        pool: 'per-agent'
      }
    });

    expect(streamAgent).toHaveBeenCalledWith(
      'agent-1',
      'hello',
      undefined,
      expect.objectContaining({
        workspacePolicy: expect.objectContaining({
          mode: 'docker',
          pool: 'per-agent'
        })
      })
    );
  });

  it('accepts message alias and persists userTurnMetadata on the run options', async () => {
    mockResolveUserTurnFiles.mockResolvedValueOnce({
      fileList: [
        {
          fileType: 'application/pdf',
          id: 'file-pdf',
          name: 'report.pdf',
          size: 100,
          url: '/api/agent-uploads/file-pdf',
        },
      ],
      imageList: [
        { alt: 'shot.png', id: 'file-img', url: '/api/agent-uploads/file-img' },
      ],
    });

    const streamAgent = vi.fn(async function* (_agentId, _input, _date, options) {
      options.onRunCreated({
        runId: 'run-1',
        sessionId: 'session-custom',
        threadId: 'thread-custom',
        source: 'agent',
        agentDef: { id: 'agent-1' },
        input: {
          messages: [
            {
              role: 'user',
              content: '**hello**',
              metadata: {
                turnInput: true,
                format: 'markdown',
                imageList: [{ alt: 'shot.png', id: 'file-img', url: '/api/agent-uploads/file-img' }],
              },
            },
          ],
        },
      });
      yield { type: 'content', content: 'ok' };
    });
    const agentService = { streamAgent, runAgent: vi.fn() };
    const service = new AgentRunService(createStore() as any, createContext(agentService) as any);

    await service.startAgentRun({
      agentId: 'agent-1',
      message: '**hello**',
      editorData: {
        root: {
          children: [
            {
              type: 'action-tag',
              actionCategory: 'skill',
              actionType: 'github',
              actionLabel: 'GitHub',
            },
          ],
        },
      },
      files: [{ fileId: 'file-pdf', name: 'report.pdf', mimeType: 'application/pdf', size: 100 }],
    });

    expect(streamAgent).toHaveBeenCalledWith(
      'agent-1',
      '**hello**',
      undefined,
      expect.objectContaining({
        userTurnMetadata: expect.objectContaining({
          format: 'markdown',
          derived: { selectedSkills: ['github'] },
          fileList: [
            expect.objectContaining({ id: 'file-pdf', name: 'report.pdf' }),
          ],
          imageList: [
            expect.objectContaining({ id: 'file-img', alt: 'shot.png' }),
          ],
        }),
      }),
    );
  });

  it('rejects deprecated input and attachments on agent-runs', async () => {
    const service = new AgentRunService(createStore() as any, createContext({}) as any);
    await expect(
      service.startAgentRun({ agentId: 'agent-1', input: 'hello' }),
    ).rejects.toThrow(/`message` instead of `input`/);
    await expect(
      service.startAgentRun({
        agentId: 'agent-1',
        message: 'hello',
        attachments: [{ id: 'file-1' }],
      }),
    ).rejects.toThrow(/`files` instead of `attachments`/);
  });

  it('normalizes run messages and metadata at the API boundary', async () => {
    const streamAgent = vi.fn(async function* (_agentId, _input, _date, options) {
      options.onRunCreated({
        runId: 'run-1',
        sessionId: 'session-custom',
        threadId: 'thread-custom',
        source: 'agent',
        agentDef: { id: 'agent-1' },
        input: {}
      });
      yield { type: 'content', content: 'ok' };
    });
    const agentService = { streamAgent, runAgent: vi.fn() };
    const service = new AgentRunService(createStore() as any, createContext(agentService) as any);

    await expect(
      service.startAgentRun({
        agentId: 'agent-1',
        message: 'latest',
        threadId: 'thread-custom',
        sessionId: 'session-custom',
        messages: [
          { role: 'system', content: 'sys' },
          { role: 'user', content: 'previous' },
          { role: 'assistant', content: 'answer', rawParts: ['part'] },
          { role: 'tool', content: { ok: true }, toolCallId: 'tool-call-1' },
          { role: 'developer', content: 'unsupported runtime role' },
          { role: 'user', content: 'latest' }
        ],
        metadata: { requestKind: 'phase4' }
      })
    ).resolves.toMatchObject({
      runId: 'run-1',
      sessionId: 'session-custom',
      threadId: 'thread-custom',
      status: 'queued'
    });

    expect(streamAgent).toHaveBeenCalledWith(
      'agent-1',
      'latest',
      undefined,
      expect.objectContaining({
        threadId: 'thread-custom',
        sessionId: 'session-custom',
        messages: [
          { role: 'system', content: 'sys', name: undefined, tool_call_id: undefined, tool_calls: undefined, raw_parts: undefined },
          { role: 'user', content: 'previous', name: undefined, tool_call_id: undefined, tool_calls: undefined, raw_parts: undefined },
          { role: 'assistant', content: 'answer', name: undefined, tool_call_id: undefined, tool_calls: undefined, raw_parts: ['part'] },
          { role: 'tool', content: '{"ok":true}', name: undefined, tool_call_id: 'tool-call-1', tool_calls: undefined, raw_parts: undefined },
          { role: 'user', content: 'latest', name: undefined, tool_call_id: undefined, tool_calls: undefined, raw_parts: undefined }
        ],
        metadata: expect.objectContaining({
          requestKind: 'phase4',
          apiSource: 'agent-runs'
        })
      })
    );
  });

  it('returns session and thread message read models', async () => {
    const session = {
      runId: 'run-1',
      sessionId: 'session-1',
      threadId: 'thread-1',
      source: 'agent',
      status: 'succeeded',
      messages: [{ role: 'user', content: 'hello', metadata: { turnInput: true } }],
      events: [],
      checkpoints: [],
      artifacts: [],
      output: { content: 'answer', stopReason: 'final' },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:01.000Z',
      metadata: { agentId: 'agent-1' }
    };
    const sessionMessages = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'answer' }
    ];
    const agentService = {
      getRunSession: vi.fn().mockResolvedValue(session),
      getSession: vi.fn().mockResolvedValue(session),
      getThreadSessions: vi.fn().mockResolvedValue([session]),
      getSessionMessages: vi.fn().mockReturnValue(sessionMessages),
      getThreadMessages: vi.fn().mockResolvedValue(sessionMessages)
    };
    const service = new AgentRunService(createStore() as any, createContext(agentService) as any);

    await expect(service.getRunSessionState('run-1')).resolves.toMatchObject({
      runId: 'run-1',
      sessionId: 'session-1',
      threadId: 'thread-1',
      status: 'succeeded'
    });
    await expect(service.getRunMessages('run-1')).resolves.toMatchObject({
      runId: 'run-1',
      sessionId: 'session-1',
      threadId: 'thread-1',
      messages: sessionMessages
    });
    await expect(service.getThreadState('thread-1')).resolves.toMatchObject({
      threadId: 'thread-1',
      sessionCount: 1,
      runCount: 1,
      lastRunId: 'run-1'
    });
    await expect(service.getThreadMessages('thread-1')).resolves.toMatchObject({
      threadId: 'thread-1',
      sessionIds: ['session-1'],
      runIds: ['run-1'],
      messages: sessionMessages
    });
  });

  it('aggregates multiple runs under one session while keeping run detail scoped', async () => {
    const run1Messages = [
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'first answer' }
    ];
    const run2Messages = [
      { role: 'user', content: 'second' },
      { role: 'assistant', content: 'second answer' }
    ];
    const run1 = {
      runId: 'run-1',
      sessionId: 'session-shared',
      threadId: 'thread-shared',
      source: 'agent',
      status: 'succeeded',
      messages: [{ role: 'user', content: 'first', metadata: { turnInput: true } }],
      events: [
        {
          id: 'run-1:start',
          type: 'run_started',
          runId: 'run-1',
          sessionId: 'session-shared',
          timestamp: '2026-01-01T00:00:00.000Z',
          payload: { source: 'agent', status: 'running', agentId: 'agent-1' }
        },
        {
          id: 'run-1:finish',
          type: 'run_finished',
          runId: 'run-1',
          sessionId: 'session-shared',
          timestamp: '2026-01-01T00:00:01.000Z',
          payload: { status: 'succeeded', output: { content: 'first answer', stopReason: 'final' } }
        }
      ],
      checkpoints: [{ checkpointId: 'checkpoint-1', runId: 'run-1', sessionId: 'session-shared', status: 'succeeded', messages: [], createdAt: '2026-01-01T00:00:00.500Z' }],
      artifacts: [{ artifactId: 'artifact-1', kind: 'model_output', createdAt: '2026-01-01T00:00:01.000Z' }],
      output: { content: 'first answer', stopReason: 'final' },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:01.000Z',
      metadata: { agentId: 'agent-1' }
    };
    const run2 = {
      runId: 'run-2',
      sessionId: 'session-shared',
      threadId: 'thread-shared',
      source: 'agent',
      status: 'succeeded',
      messages: [
        { role: 'user', content: 'first' },
        { role: 'assistant', content: 'first answer' },
        { role: 'user', content: 'second', metadata: { turnInput: true } }
      ],
      events: [
        {
          id: 'run-2:start',
          type: 'run_started',
          runId: 'run-2',
          sessionId: 'session-shared',
          timestamp: '2026-01-01T00:01:00.000Z',
          payload: { source: 'agent', status: 'running', agentId: 'agent-1' }
        },
        {
          id: 'run-2:finish',
          type: 'run_finished',
          runId: 'run-2',
          sessionId: 'session-shared',
          timestamp: '2026-01-01T00:01:01.000Z',
          payload: { status: 'succeeded', output: { content: 'second answer', stopReason: 'final' } }
        }
      ],
      checkpoints: [{ checkpointId: 'checkpoint-2', runId: 'run-2', sessionId: 'session-shared', status: 'succeeded', messages: [], createdAt: '2026-01-01T00:01:00.500Z' }],
      artifacts: [{ artifactId: 'artifact-2', kind: 'model_output', createdAt: '2026-01-01T00:01:01.000Z' }],
      output: { content: 'second answer', stopReason: 'final' },
      createdAt: '2026-01-01T00:01:00.000Z',
      updatedAt: '2026-01-01T00:01:01.000Z',
      metadata: { agentId: 'agent-1' }
    };
    const aggregate = {
      ...run2,
      runId: 'run-2',
      messages: [...run1.messages, ...run2.messages],
      events: [...run1.events, ...run2.events],
      checkpoints: [...run1.checkpoints, ...run2.checkpoints],
      artifacts: [...run1.artifacts, ...run2.artifacts],
      metadata: { agentId: 'agent-1', aggregate: true, runIds: ['run-1', 'run-2'] }
    };
    const agentService = {
      getRunSession: vi.fn(async (runId: string) => (runId === 'run-1' ? run1 : run2)),
      getSession: vi.fn().mockResolvedValue(aggregate),
      getSessionRuns: vi.fn().mockResolvedValue([run1, run2]),
      getThreadSessions: vi.fn().mockResolvedValue([run1, run2]),
      getSessionMessages: vi.fn((session: any) => session.runId === 'run-1' ? run1Messages : run2Messages),
      getSessionTurnMessages: vi.fn((session: any) => session.runId === 'run-1' ? run1Messages : run2Messages),
      getThreadMessages: vi.fn().mockResolvedValue([...run1Messages, ...run2Messages])
    };
    const registry = {
      get: vi.fn(async (runId: string) => ({
        runId,
        sessionId: 'session-shared',
        threadId: 'thread-shared',
        source: 'agent',
        status: 'succeeded',
        createdAt: runId === 'run-1' ? run1.createdAt : run2.createdAt,
        updatedAt: runId === 'run-1' ? run1.updatedAt : run2.updatedAt,
        roundCount: 1,
        toolCallCount: 0,
        artifactCount: 1,
        checkpointCount: 1
      }))
    };
    agentService.getRunRegistryInstance = vi.fn().mockReturnValue(registry);
    const service = new AgentRunService(createStore() as any, createContext(agentService) as any);

    await expect(service.getRun('run-1')).resolves.toMatchObject({
      runId: 'run-1',
      sessionId: 'session-shared',
      eventCount: 2,
      checkpointCount: 1,
      artifactCount: 1,
      output: { content: 'first answer' },
      messages: run1Messages,
      inputMessages: run1.messages
    });
    await expect(service.getRun('run-2')).resolves.toMatchObject({
      runId: 'run-2',
      sessionId: 'session-shared',
      eventCount: 2,
      checkpointCount: 1,
      artifactCount: 1,
      output: { content: 'second answer' },
      messages: run2Messages,
      inputMessages: run2.messages
    });
    await expect(service.getSessionState('session-shared')).resolves.toMatchObject({
      sessionId: 'session-shared',
      runCount: 2,
      runIds: ['run-1', 'run-2'],
      messageCount: run1.messages.length + run2.messages.length,
      eventCount: 4,
      checkpointCount: 2,
      artifactCount: 2,
      lastRunId: 'run-2'
    });
    await expect(service.getSessionMessages('session-shared')).resolves.toMatchObject({
      sessionId: 'session-shared',
      threadId: 'thread-shared',
      runIds: ['run-1', 'run-2'],
      messages: [...run1Messages, ...run2Messages]
    });
    await expect(service.getThreadState('thread-shared')).resolves.toMatchObject({
      threadId: 'thread-shared',
      sessionCount: 1,
      runCount: 2,
      lastRunId: 'run-2',
      lastSessionId: 'session-shared'
    });
  });

  it('returns run-scoped artifact list and persisted artifact content', async () => {
    const artifactDir = await fs.mkdtemp(path.join(os.tmpdir(), 'linkloom-agent-artifact-test-'));
    const artifactPath = path.join(artifactDir, 'artifact.txt');
    await fs.writeFile(artifactPath, 'artifact body', 'utf8');
    const artifact = {
      artifactId: 'artifact-1',
      kind: 'model_output',
      uri: `file://${artifactPath}`,
      preview: 'artifact preview',
      sizeBytes: 13,
      createdAt: '2026-01-01T00:00:00.000Z',
      metadata: { workspacePath: artifactPath, storage: 'platform' }
    };
    const session = {
      runId: 'run-1',
      sessionId: 'session-1',
      threadId: 'thread-1',
      source: 'agent',
      status: 'succeeded',
      messages: [],
      events: [],
      checkpoints: [],
      artifacts: [artifact],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:01.000Z',
      metadata: { agentId: 'agent-1' }
    };
    const agentService = {
      getRunSession: vi.fn().mockResolvedValue(session),
      listRunSessions: vi.fn().mockResolvedValue([session])
    };
    const service = new AgentRunService(createStore() as any, createContext(agentService) as any);

    await expect(service.getRunArtifacts('run-1')).resolves.toMatchObject({
      runId: 'run-1',
      sessionId: 'session-1',
      threadId: 'thread-1',
      artifacts: [artifact]
    });
    await expect(service.getRunArtifact('run-1', 'artifact-1')).resolves.toMatchObject({
      runId: 'run-1',
      sessionId: 'session-1',
      artifact,
      content: 'artifact body'
    });
    await expect(service.getArtifact('artifact-1')).resolves.toMatchObject({
      runId: 'run-1',
      sessionId: 'session-1',
      artifact,
      content: 'artifact body'
    });
    await fs.rm(artifactDir, { recursive: true, force: true });
  });

  it('returns 404 when a run artifact is outside the run scope', async () => {
    const session = {
      runId: 'run-1',
      sessionId: 'session-1',
      source: 'agent',
      status: 'succeeded',
      messages: [],
      events: [],
      checkpoints: [],
      artifacts: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:01.000Z',
      metadata: { agentId: 'agent-1' }
    };
    const agentService = {
      getRunSession: vi.fn().mockResolvedValue(session)
    };
    const service = new AgentRunService(createStore() as any, createContext(agentService) as any);

    await expect(service.getRunArtifact('run-1', 'missing-artifact')).rejects.toThrow(
      'Agent artifact not found: missing-artifact'
    );
  });

  it('does not keep event SSE open when backlog already has a closing event', async () => {
    const closingEvent = {
      id: 'event-1',
      type: 'run_cancelled',
      runId: 'run-1',
      sessionId: 'session-1',
      timestamp: '2026-01-01T00:00:00.000Z',
      payload: { status: 'cancelled', reason: 'manual' }
    };
    const agentService = {
      getRunEvents: vi.fn().mockResolvedValue([closingEvent]),
      getRunSession: vi.fn().mockResolvedValue({
        runId: 'run-1',
        sessionId: 'session-1',
        status: 'running',
        metadata: {}
      }),
      subscribeRunEvents: vi.fn()
    };
    const service = new AgentRunService(createStore() as any, createContext(agentService) as any);

    await expect(collectAsyncIterable(service.streamRunEvents('run-1'))).resolves.toEqual([closingEvent]);
    expect(agentService.subscribeRunEvents).not.toHaveBeenCalled();
  });

  it('replays saved AgentEvent v1 backlog in stable sequence order', async () => {
    const backlog = [
      {
        id: 'event-1',
        type: 'run_started',
        runId: 'run-1',
        sessionId: 'session-1',
        timestamp: '2026-01-01T00:00:00.000Z',
        schemaVersion: AGENT_EVENT_SCHEMA_VERSION,
        sequence: 1,
        payload: { source: 'agent', status: 'running', agentId: 'agent-1' }
      },
      {
        id: 'event-2',
        type: 'model_delta',
        runId: 'run-1',
        sessionId: 'session-1',
        timestamp: '2026-01-01T00:00:01.000Z',
        schemaVersion: AGENT_EVENT_SCHEMA_VERSION,
        sequence: 2,
        payload: { content: 'partial' }
      },
      {
        id: 'event-3',
        type: 'run_finished',
        runId: 'run-1',
        sessionId: 'session-1',
        timestamp: '2026-01-01T00:00:02.000Z',
        schemaVersion: AGENT_EVENT_SCHEMA_VERSION,
        sequence: 3,
        payload: { status: 'succeeded', output: { content: 'answer', stopReason: 'final' } }
      }
    ];
    const agentService = {
      getRunEvents: vi.fn().mockResolvedValue(backlog),
      getRunSession: vi.fn().mockResolvedValue({
        runId: 'run-1',
        sessionId: 'session-1',
        status: 'running',
        metadata: {}
      }),
      subscribeRunEvents: vi.fn()
    };
    const service = new AgentRunService(createStore() as any, createContext(agentService) as any);

    await expect(collectAsyncIterable(service.streamRunEvents('run-1'))).resolves.toEqual(backlog);
    expect(agentService.subscribeRunEvents).not.toHaveBeenCalled();
  });

  it('merges DB backlog with live bus deltas in real publish order, not seq order', async () => {
    // Simulate: a reasoning delta was published (ephemeral, negative seq, busOrder 1),
    // then tool_call_requested (persisted, seq 5, busOrder 2). DB only has the
    // persisted event; bus has both. SSE must yield reasoning BEFORE tool_call_requested
    // (real order), not tool_call_requested first (seq order).
    const reasoningDelta = {
      id: 'run-1:stream:reasoning_delta:1',
      type: 'reasoning_delta',
      runId: 'run-1',
      sessionId: 'session-1',
      timestamp: '2026-01-01T00:00:00.100Z',
      sequence: -1,
      metadata: { _busOrder: 1 },
      payload: { content: 'think', round: 1 }
    };
    const toolCallRequested = {
      id: 'run-1:tool_call_requested:5',
      type: 'tool_call_requested',
      runId: 'run-1',
      sessionId: 'session-1',
      timestamp: '2026-01-01T00:00:00.200Z',
      sequence: 5,
      metadata: { _busOrder: 2 },
      payload: { toolCallId: 'call-1', name: 'runCommand', arguments: {} }
    };
    const agentService = {
      getRunEvents: vi.fn().mockResolvedValue([toolCallRequested]),
      getRunLiveEvents: vi.fn().mockReturnValue([reasoningDelta, toolCallRequested]),
      getRunSession: vi.fn().mockResolvedValue({
        runId: 'run-1',
        sessionId: 'session-1',
        status: 'succeeded',
        metadata: {}
      }),
      subscribeRunEvents: vi.fn()
    };
    const service = new AgentRunService(createStore() as any, createContext(agentService) as any);

    const events = await collectAsyncIterable(service.streamRunEvents('run-1'));
    const ids = events.map((event: any) => event.id);
    expect(ids).toContain(reasoningDelta.id);
    expect(ids).toContain(toolCallRequested.id);
    // Real publish order: reasoning delta first, tool_call_requested second.
    expect(ids.indexOf(reasoningDelta.id)).toBeLessThan(ids.indexOf(toolCallRequested.id));
  });

  it('stops event SSE wait when the stream signal is aborted', async () => {
    const controller = new AbortController();
    const unsubscribe = vi.fn();
    const agentService = {
      getRunEvents: vi.fn().mockResolvedValue([]),
      getRunSession: vi.fn().mockResolvedValue({
        runId: 'run-1',
        sessionId: 'session-1',
        status: 'running',
        metadata: {}
      }),
      subscribeRunEvents: vi.fn().mockReturnValue(unsubscribe)
    };
    const service = new AgentRunService(createStore() as any, createContext(agentService) as any);
    const events: any[] = [];
    const collectPromise = (async () => {
      for await (const event of service.streamRunEvents('run-1', { signal: controller.signal })) {
        events.push(event);
      }
    })();

    await vi.waitFor(() => expect(agentService.subscribeRunEvents).toHaveBeenCalledTimes(1));
    controller.abort('client_disconnect');
    await collectPromise;

    expect(events).toEqual([]);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('returns and resolves pending HITL through the service boundary', async () => {
    const pendingHitl = {
      requestId: 'hitl-1',
      kind: 'needs_input',
      status: 'pending',
      prompt: 'Need input',
      allowedActions: ['provide_input'],
      createdAt: '2026-01-01T00:00:00.000Z'
    };
    const session = {
      runId: 'run-1',
      sessionId: 'session-1',
      threadId: 'thread-1',
      source: 'agent',
      status: 'paused',
      pendingHitl,
      messages: [],
      events: [],
      checkpoints: [],
      artifacts: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:01.000Z',
      metadata: { agentId: 'agent-1' }
    };
    const agentService = {
      getRunSession: vi.fn().mockResolvedValue(session),
      getRunHitl: vi.fn().mockResolvedValue(pendingHitl),
      listPendingHitl: vi.fn().mockResolvedValue([{ ...pendingHitl, runId: 'run-1', sessionId: 'session-1', runStatus: 'paused' }]),
      resolveRunHitl: vi.fn().mockResolvedValue({ content: 'HITL decision recorded: provide_input', stopReason: 'hitl_resolved' })
    };
    const service = new AgentRunService(createStore() as any, createContext(agentService) as any);

    await expect(service.getRunHitl('run-1')).resolves.toMatchObject({
      runId: 'run-1',
      sessionId: 'session-1',
      pendingHitl
    });
    await expect(service.listPendingHitl()).resolves.toEqual([
      expect.objectContaining({ requestId: 'hitl-1', runId: 'run-1' })
    ]);
    await expect(
      service.resolveRunHitl('run-1', 'hitl-1', { action: 'provide_input', input: 'answer' })
    ).resolves.toMatchObject({ stopReason: 'hitl_resolved' });
    expect(agentService.resolveRunHitl).toHaveBeenCalledWith({
      runId: 'run-1',
      requestId: 'hitl-1',
      action: 'provide_input',
      kind: undefined,
      reason: undefined,
      editedArguments: undefined,
      input: 'answer',
      externalResult: undefined,
      metadata: undefined
    });
  });

  it('rejects invalid HITL action and payload combinations before service resolution', async () => {
    const pendingHitl = {
      requestId: 'hitl-invalid-1',
      kind: 'needs_input',
      status: 'pending',
      prompt: 'Need input',
      allowedActions: ['provide_input'],
      createdAt: '2026-01-01T00:00:00.000Z'
    };
    const session = {
      runId: 'run-1',
      sessionId: 'session-1',
      source: 'agent',
      status: 'paused',
      pendingHitl,
      messages: [],
      events: [],
      checkpoints: [],
      artifacts: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:01.000Z',
      metadata: { agentId: 'agent-1' }
    };
    const agentService = {
      getRunSession: vi.fn().mockResolvedValue(session),
      resolveRunHitl: vi.fn()
    };
    const service = new AgentRunService(createStore() as any, createContext(agentService) as any);

    await expect(
      service.resolveRunHitl('run-1', 'hitl-invalid-1', {
        action: 'provide_input',
        editedArguments: { text: 'wrong channel' }
      })
    ).rejects.toThrow('editedArguments is only allowed for HITL edit_arguments');
    await expect(
      service.resolveRunHitl('run-1', 'hitl-invalid-1', {
        action: 'edit_arguments',
        editedArguments: { text: 'wrong action' }
      })
    ).rejects.toThrow('HITL action is not allowed for pending request: edit_arguments');
    expect(agentService.resolveRunHitl).not.toHaveBeenCalled();
  });

  it('builds thread messages from turn input and assistant output without replay duplication', async () => {
    const service = new AgentService({} as any, {} as any, {} as any, {} as any);
    const sessions = [
      {
        runId: 'run-1',
        sessionId: 'session-1',
        threadId: 'thread-1',
        source: 'agent',
        status: 'succeeded',
        messages: [{ role: 'user', content: 'first', metadata: { turnInput: true } }],
        events: [
          {
            id: 'event-1',
            type: 'message_delta',
            runId: 'run-1',
            sessionId: 'session-1',
            timestamp: '2026-01-01T00:00:00.000Z',
            payload: { role: 'assistant', content: 'hel' }
          },
          {
            id: 'event-2',
            type: 'model_delta',
            runId: 'run-1',
            sessionId: 'session-1',
            timestamp: '2026-01-01T00:00:00.001Z',
            payload: { content: '' }
          },
          {
            id: 'event-3',
            type: 'message_delta',
            runId: 'run-1',
            sessionId: 'session-1',
            timestamp: '2026-01-01T00:00:00.002Z',
            payload: { role: 'assistant', content: 'lo' }
          }
        ],
        checkpoints: [],
        artifacts: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:01.000Z'
      },
      {
        runId: 'run-2',
        sessionId: 'session-2',
        threadId: 'thread-1',
        source: 'agent',
        status: 'succeeded',
        messages: [
          { role: 'system', content: 'sys' },
          { role: 'user', content: 'first' },
          { role: 'assistant', content: 'hello' },
          { role: 'user', content: 'second', metadata: { turnInput: true } }
        ],
        events: [],
        checkpoints: [],
        artifacts: [],
        output: { content: 'world', stopReason: 'final' },
        createdAt: '2026-01-01T00:01:00.000Z',
        updatedAt: '2026-01-01T00:01:01.000Z'
      }
    ];
    vi.spyOn(service, 'getThreadSessions').mockResolvedValue(sessions as any);

    await expect(service.getThreadMessages('thread-1')).resolves.toEqual([
      expect.objectContaining({ role: 'user', content: 'first' }),
      expect.objectContaining({ role: 'assistant', content: 'hello' }),
      expect.objectContaining({ role: 'user', content: 'second' }),
      expect.objectContaining({ role: 'assistant', content: 'world' })
    ]);
  });

  it('saveAgent returns before background reload finishes', async () => {
    let resolveReload!: () => void;
    const reloadPromise = new Promise<void>((resolve) => {
      resolveReload = resolve;
    });
    const store = createStore({ id: 'agent-1', toolIds: [] });
    const context = {
      reload: vi.fn().mockReturnValue(reloadPromise)
    };
    const service = new AgentRunService(store as any, context as any);

    await expect(service.saveAgent({ id: 'agent-1', toolIds: ['web_search'] })).resolves.toEqual({
      status: 'success'
    });
    expect(store.saveAgent).toHaveBeenCalled();
    expect(context.reload).toHaveBeenCalled();
    resolveReload();
    await reloadPromise;
  });
});

describe('AgentRunService.compactSessionContext', () => {
  function createLongMessageSession() {
    const messages: any[] = [{ role: 'user', content: '系统初始消息' }];
    for (let i = 0; i < 50; i++) {
      messages.push({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `消息 ${i}：${'x'.repeat(500)}`,
      });
    }
    return {
      runId: 'run-compact',
      sessionId: 'session-compact',
      threadId: 'thread-1',
      status: 'succeeded',
      source: 'api',
      createdAt: '2026-06-26T00:00:00.000Z',
      updatedAt: '2026-06-26T00:00:01.000Z',
      messages,
      events: [],
      checkpoints: [],
      artifacts: [],
      metadata: { agentId: 'agent-1' },
    };
  }

  it('throws 404 when session does not exist', async () => {
    const store = createStore({ id: 'agent-1' });
    const service = new AgentRunService(
      store as any,
      createContext({
        getSession: vi.fn().mockResolvedValue(null),
      }) as any,
    );

    await expect(service.compactSessionContext('missing')).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('compacts long session and persists trimmed messages', async () => {
    const session = createLongMessageSession();
    const saveRunSession = vi.fn().mockResolvedValue(undefined);
    const store = createStore({ id: 'agent-1', providerId: 'openai', model: 'gpt-4o' });
    const service = new AgentRunService(
      store as any,
      createContext({
        getSession: vi.fn().mockResolvedValue(session),
        getSessionTurnMessages: vi.fn().mockReturnValue(session.messages),
        saveRunSession,
      }) as any,
    );

    const result = await service.compactSessionContext('session-compact');

    expect(result.compacted).toBe(true);
    expect(result.beforeMessages).toBe(session.messages.length);
    expect(result.afterMessages).toBeLessThan(session.messages.length);
    expect(result.afterMessages).toBeLessThanOrEqual(31);
    expect(saveRunSession).toHaveBeenCalledTimes(1);
    const saved = saveRunSession.mock.calls[0][0];
    expect(saved.messages.length).toBe(result.afterMessages);
  });

  it('reports compacted=false when session is already small', async () => {
    const messages = [
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
    ];
    const saveRunSession = vi.fn().mockResolvedValue(undefined);
    const store = createStore({ id: 'agent-1' });
    const service = new AgentRunService(
      store as any,
      createContext({
        getSession: vi.fn().mockResolvedValue({
          sessionId: 's',
          runId: 'r',
          status: 'succeeded',
          source: 'api',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          messages,
          events: [],
          checkpoints: [],
          artifacts: [],
          metadata: { agentId: 'agent-1' },
        }),
        getSessionTurnMessages: vi.fn().mockReturnValue(messages),
        saveRunSession,
      }) as any,
    );

    const result = await service.compactSessionContext('s');

    expect(result.compacted).toBe(false);
    expect(saveRunSession).not.toHaveBeenCalled();
  });
});
