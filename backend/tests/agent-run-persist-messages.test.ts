import { describe, expect, it } from 'vitest';

import { AgentRunManager, resolvePersistedRunMessages } from '../src/services/agents/managers/AgentRunManager.js';
import type { AgentDefinition } from '../src/types/agent.js';
import type { AIMessage } from '../src/types/index.js';

const stubAgentDef = {
  id: 'agent-1',
  name: 'Agent',
  model: 'gpt-4o',
  providerId: 'openai',
  systemPrompt: 'You are helpful.',
} as AgentDefinition;

describe('resolvePersistedRunMessages', () => {
  it('keeps only turnInput user messages', () => {
    expect(
      resolvePersistedRunMessages([
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'first' },
        { role: 'assistant', content: 'ok' },
        { role: 'user', content: 'second', metadata: { turnInput: true } },
      ]),
    ).toEqual([{ role: 'user', content: 'second', metadata: { turnInput: true } }]);
  });

  it('falls back to the last user message when turnInput is missing', () => {
    expect(
      resolvePersistedRunMessages([
        { role: 'user', content: 'only' },
      ]),
    ).toEqual([{ role: 'user', content: 'only' }]);
  });

  it('preserves user turn metadata on persisted messages', () => {
    expect(
      resolvePersistedRunMessages([
        {
          role: 'user',
          content: '**hello**',
          metadata: {
            turnInput: true,
            format: 'markdown',
            imageList: [{ alt: 'a.png', id: 'img-1', url: '/api/agent-uploads/img-1' }],
            fileList: [
              {
                fileType: 'application/pdf',
                id: 'pdf-1',
                name: 'a.pdf',
                size: 10,
                url: '/api/agent-uploads/pdf-1',
              },
            ],
          },
        },
      ]),
    ).toEqual([
      {
        role: 'user',
        content: '**hello**',
        metadata: {
          turnInput: true,
          format: 'markdown',
          imageList: [{ alt: 'a.png', id: 'img-1', url: '/api/agent-uploads/img-1' }],
          fileList: [
            {
              fileType: 'application/pdf',
              id: 'pdf-1',
              name: 'a.pdf',
              size: 10,
              url: '/api/agent-uploads/pdf-1',
            },
          ],
        },
      },
    ]);
  });
});

describe('AgentSessionManager.getThreadRunMessages', () => {
  it('emits only the latest turnInput when older users were incorrectly retained', async () => {
    const { AgentSessionManager } = await import(
      '../src/services/agents/managers/AgentSessionManager.js'
    );
    const manager = new AgentSessionManager();
    const messages = manager.getThreadRunMessages({
      runId: 'run-3',
      sessionId: 'tpc_dup',
      threadId: 'thread-1',
      status: 'succeeded',
      source: 'api',
      createdAt: '2026-08-01T11:00:00.000Z',
      updatedAt: '2026-08-01T11:00:10.000Z',
      messages: [
        { role: 'user', content: '你好', metadata: { turnInput: true, format: 'markdown' } },
        { role: 'assistant', content: '你好！' },
        { role: 'user', content: '你好' },
        { role: 'user', content: '看看智能体' },
        {
          role: 'user',
          content: '看看工作流',
          metadata: { turnInput: true, format: 'markdown' },
        },
      ],
      events: [
        {
          id: 'e1',
          runId: 'run-3',
          sessionId: 'tpc_dup',
          type: 'model_finished',
          sequence: 1,
          timestamp: '2026-08-01T11:00:10.000Z',
          payload: { content: '当前有 2 个工作流', round: 1 },
        },
      ],
      checkpoints: [],
      artifacts: [],
      output: { content: '当前有 2 个工作流', stopReason: 'completed' },
    });

    const users = messages.filter((message) => message.role === 'user');
    expect(users).toHaveLength(1);
    expect(users[0]?.content).toBe('看看工作流');
  });
});

describe('AgentRunManager.createSpec', () => {
  it('persists original user input without runtime file index', () => {
    const runtimeContent =
      '你能看到这个文件吗\n\n[Attached files available via read_upload]\n- report.pdf (fileId: file-1, application/pdf, 1024 bytes)';
    const messages: AIMessage[] = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: runtimeContent },
    ];
    const manager = new AgentRunManager();
    const spec = manager.createSpec({
      agentDef: stubAgentDef,
      input: '你能看到这个文件吗',
      messages,
      tools: [],
      mcpConfigs: [],
      skillInstructions: [],
      userTurnMetadata: {
        format: 'text',
        fileList: [
          {
            fileType: 'application/pdf',
            id: 'file-1',
            name: 'report.pdf',
            size: 1024,
            url: '/api/agent-uploads/file-1',
          },
        ],
      },
    });

    const persisted = resolvePersistedRunMessages(spec.input.messages);
    expect(persisted).toEqual([
      expect.objectContaining({
        role: 'user',
        content: '你能看到这个文件吗',
        metadata: expect.objectContaining({
          turnInput: true,
          fileList: [
            expect.objectContaining({ id: 'file-1', name: 'report.pdf' }),
          ],
        }),
      }),
    ]);
  });
});
