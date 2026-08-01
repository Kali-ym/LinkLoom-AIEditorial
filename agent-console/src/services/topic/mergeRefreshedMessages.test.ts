import { describe, expect, it } from 'vitest';

import type { Message } from '../../domain/types';
import { mergeRefreshedMessages } from './mergeRefreshedMessages';

describe('mergeRefreshedMessages', () => {
  it('keeps local pending intervention turnSegments over API error history', () => {
    const local: Message[] = [
      {
        id: 'a-1',
        role: 'assistant',
        content: '',
        createdAt: '2026-06-24T08:24:40.000Z',
        turnSegments: [
          {
            kind: 'tool',
            id: 'call-1',
            tool: {
              id: 'call-1',
              toolCallId: 'call-1',
              permissionId: 'perm-1',
              identifier: 'linkloom-local-system',
              apiName: 'runCommand',
              state: 'executing',
              intervention: { status: 'pending' },
            },
          },
        ],
      },
    ];

    const api: Message[] = [
      {
        id: 'a-1',
        role: 'assistant',
        content: '',
        createdAt: '2026-06-24T08:24:40.000Z',
        turnSegments: [
          {
            kind: 'tool',
            id: 'call-1',
            tool: {
              id: 'call-1',
              toolCallId: 'call-1',
              identifier: 'linkloom-local-system',
              apiName: 'runCommand',
              state: 'error',
              error: 'Permission required for tool "execute_command"',
            },
          },
        ],
      },
    ];

    const merged = mergeRefreshedMessages(local, api);
    const tool = merged[0]?.turnSegments?.[0];
    expect(tool?.kind === 'tool' ? tool.tool.intervention?.status : undefined).toBe('pending');
    expect(tool?.kind === 'tool' ? tool.tool.state : undefined).toBe('executing');
  });

  it('preserves local rejected turn segment state over api error refresh', () => {
    const local: Message[] = [
      {
        id: 'run-1:thread:assistant',
        role: 'assistant',
        content: '',
        createdAt: '2026-06-24T10:00:10.000Z',
        turnSegments: [
          {
            kind: 'tool',
            id: 'call_cmd',
            tool: {
              id: 'call_cmd',
              toolCallId: 'call_cmd',
              identifier: 'linkloom-local-system',
              apiName: 'runCommand',
              state: 'rejected',
              rejectedReason: '直接用 rm -rf',
              intervention: { status: 'resolved' },
            },
          },
        ],
      },
    ];

    const api: Message[] = [
      {
        id: 'run-1:thread:assistant',
        role: 'assistant',
        content: '',
        createdAt: '2026-06-24T10:00:11.000Z',
        turnSegments: [
          {
            kind: 'tool',
            id: 'call_cmd',
            tool: {
              id: 'call_cmd',
              toolCallId: 'call_cmd',
              identifier: 'linkloom-local-system',
              apiName: 'runCommand',
              state: 'error',
              error: '直接用 rm -rf',
            },
          },
        ],
      },
    ];

    const merged = mergeRefreshedMessages(local, api);
    const tool = merged[0]?.turnSegments?.[0];
    expect(tool?.kind === 'tool' ? tool.tool.state : undefined).toBe('rejected');
    expect(tool?.kind === 'tool' ? tool.tool.rejectedReason : undefined).toBe('直接用 rm -rf');
    expect(tool?.kind === 'tool' ? tool.tool.error : undefined).toBeUndefined();
  });

  it('matches orphan local assistant to api assistant when ids differ', () => {
    const local: Message[] = [
      {
        id: 'a-stream-1',
        role: 'assistant',
        content: '',
        createdAt: '2026-06-24T08:24:40.000Z',
        turnSegments: [
          {
            kind: 'tool',
            id: 'call-1',
            tool: {
              id: 'call-1',
              toolCallId: 'call-1',
              permissionId: 'perm-1',
              identifier: 'linkloom-local-system',
              apiName: 'runCommand',
              state: 'executing',
              intervention: { status: 'pending' },
            },
          },
        ],
      },
    ];

    const api: Message[] = [
      {
        id: 'run-1:thread:assistant',
        role: 'assistant',
        content: '',
        createdAt: '2026-06-24T08:24:41.000Z',
        turnSegments: [
          {
            kind: 'tool',
            id: 'call-1',
            tool: {
              id: 'call-1',
              toolCallId: 'call-1',
              identifier: 'linkloom-local-system',
              apiName: 'runCommand',
              state: 'error',
              error: 'Permission required for tool "execute_command"',
            },
          },
        ],
      },
    ];

    const merged = mergeRefreshedMessages(local, api);
    const tool = merged[0]?.turnSegments?.[0];
    expect(merged[0]?.id).toBe('run-1:thread:assistant');
    expect(merged).toHaveLength(1);
    expect(tool?.kind === 'tool' ? tool.tool.intervention?.status : undefined).toBe('pending');
  });

  it('rehydrates pending intervention from API permission pause errors', () => {
    const api: Message[] = [
      {
        id: 'run-1:thread:assistant',
        role: 'assistant',
        content: '',
        createdAt: '2026-06-24T08:24:41.000Z',
        turnSegments: [
          {
            kind: 'tool',
            id: 'call-1',
            tool: {
              id: 'call-1',
              toolCallId: 'call-1',
              identifier: 'linkloom-local-system',
              apiName: 'runCommand',
              state: 'error',
              error: 'Permission required for tool "execute_command"',
            },
          },
        ],
      },
    ];

    const merged = mergeRefreshedMessages([], api);
    const tool = merged[0]?.turnSegments?.[0];
    expect(tool?.kind === 'tool' ? tool.tool.intervention?.status : undefined).toBe('pending');
    expect(tool?.kind === 'tool' ? tool.tool.state : undefined).toBe('pending');
  });

  it('does not resurrect resolved permission-pause tools from API history', () => {
    const api: Message[] = [
      {
        id: 'run-1:thread:assistant',
        role: 'assistant',
        content: '',
        createdAt: '2026-06-24T08:24:41.000Z',
        turnSegments: [
          {
            kind: 'tool',
            id: 'call-write',
            tool: {
              id: 'call-write',
              toolCallId: 'call-write',
              identifier: 'linkloom-local-system',
              apiName: 'writeFile',
              state: 'error',
              error: 'Permission required for tool "write_file"',
              intervention: { status: 'resolved' },
            },
          },
        ],
      },
    ];

    const merged = mergeRefreshedMessages([], api);
    const tool = merged[0]?.turnSegments?.[0];
    expect(tool?.kind === 'tool' ? tool.tool.state : undefined).toBe('error');
    expect(tool?.kind === 'tool' ? tool.tool.intervention?.status : undefined).toBe('resolved');
  });

  it('preserves richer local turnSegments for earlier assistant turns by index', () => {
    const local: Message[] = [
      { id: 'u-1', role: 'user', content: '列出工作区文件', createdAt: '2026-06-24T10:00:00.000Z' },
      {
        id: 'run-1:thread:assistant',
        role: 'assistant',
        content: '',
        createdAt: '2026-06-24T10:00:10.000Z',
        turnSegments: [
          {
            kind: 'tool',
            id: 'call-list',
            tool: {
              id: 'call-list',
              toolCallId: 'call-list',
              identifier: 'linkloom-local-system',
              apiName: 'runCommand',
              state: 'success',
              resultText: 'prime.py\nREADME.md',
            },
          },
        ],
      },
      { id: 'u-2', role: 'user', content: '删掉 workspace 下的所有文件', createdAt: '2026-06-24T10:01:00.000Z' },
    ];

    const api: Message[] = [
      local[0]!,
      {
        id: 'run-1:thread:assistant',
        role: 'assistant',
        content: '',
        createdAt: '2026-06-24T10:00:10.000Z',
        turnSegments: [
          {
            kind: 'tool',
            id: 'call-list',
            tool: {
              id: 'call-list',
              toolCallId: 'call-list',
              identifier: 'linkloom-local-system',
              apiName: 'runCommand',
              state: 'error',
              error: '未完成',
            },
          },
        ],
      },
      local[2]!,
    ];

    const merged = mergeRefreshedMessages(local, api);
    const firstAssistant = merged.find((message) => message.id === 'run-1:thread:assistant');
    const tool = firstAssistant?.turnSegments?.[0];
    expect(tool?.kind === 'tool' ? tool.tool.state : undefined).toBe('success');
    expect(tool?.kind === 'tool' ? tool.tool.resultText : undefined).toContain('prime.py');
  });

  it('uses API turnSegments when replay includes reasoning_snapshot (no local override needed)', () => {
    const api: Message[] = [
      { id: 'u-1', role: 'user', content: '读脚本', createdAt: '2026-06-26T08:00:00.000Z' },
      {
        id: 'run-api:assistant',
        role: 'assistant',
        content: '工作区里有 3 个脚本',
        createdAt: '2026-06-26T08:00:10.000Z',
        turnSegments: [
          {
            kind: 'reasoning',
            id: 'run-api:reasoning:1',
            reasoning: {
              id: 'run-api:reasoning:1',
              label: '已深度思考（2.1s）',
              duration: '2.1',
              thinking: false,
              open: false,
              paragraphs: ['要读工作区脚本'],
            },
          },
          {
            kind: 'tools',
            id: 'run-api:tools:1',
            tools: [
              {
                id: 'tc-read',
                toolCallId: 'tc-read',
                identifier: 'linkloom-local-system',
                apiName: 'readFile',
                state: 'success',
              },
            ],
          },
          {
            kind: 'reasoning',
            id: 'run-api:reasoning:2',
            reasoning: {
              id: 'run-api:reasoning:2',
              label: '已深度思考（0.9s）',
              duration: '0.9',
              thinking: false,
              open: false,
              paragraphs: ['已读完，给用户总结'],
            },
          },
          { kind: 'text', id: 'run-api:text:1', text: '工作区里有 3 个脚本' },
        ],
      },
    ];

    const local: Message[] = [
      api[0]!,
      {
        ...api[1]!,
        turnSegments: [
          {
            kind: 'tools',
            id: 'stream-tools-1',
            tools: [{ id: 'tc-read', toolCallId: 'tc-read', state: 'success' } as never],
          },
          {
            kind: 'reasoning',
            id: 'stream-reasoning-1',
            reasoning: {
              id: 'stream-reasoning-1',
              label: '已深度思考（2.1s）',
              duration: '2.1',
              thinking: false,
              open: false,
              paragraphs: ['要读工作区脚本'],
            },
          },
        ],
      },
    ];

    const merged = mergeRefreshedMessages(local, api);
    const assistant = merged.find((message) => message.id === 'run-api:assistant');
    expect(assistant?.turnSegments?.map((segment) => segment.kind)).toEqual([
      'reasoning',
      'tools',
      'reasoning',
      'text',
    ]);
  });

  it('preserves local user messages when API refresh omits them', () => {
    const local: Message[] = [
      {
        id: 'u-local-1',
        role: 'user',
        content: '你好',
        createdAt: '2026-06-29T08:00:00.000Z',
      },
      {
        id: 'a-1',
        role: 'assistant',
        content: '你好！又见面了',
        createdAt: '2026-06-29T08:00:05.000Z',
      },
    ];

    const api: Message[] = [
      {
        id: 'a-1',
        role: 'assistant',
        content: '你好！又见面了',
        createdAt: '2026-06-29T08:00:05.000Z',
      },
    ];

    const merged = mergeRefreshedMessages(local, api);
    expect(merged).toHaveLength(2);
    expect(merged[0]?.role).toBe('user');
    expect(merged[0]?.content).toBe('你好');
    expect(merged[1]?.role).toBe('assistant');
  });

  it('does not keep the optimistic user bubble beside its refreshed API copy', () => {
    const local: Message[] = [
      {
        id: 'u-optimistic',
        role: 'user',
        content: '你是什么模型',
        createdAt: '2026-06-29T08:00:00.000Z',
      },
      {
        id: 'run-local:thread:assistant',
        role: 'assistant',
        content: '我是一个 AI 助手',
        createdAt: '2026-06-29T08:00:05.000Z',
      },
    ];
    const api: Message[] = [
      {
        id: 'run-api:input:0',
        role: 'user',
        content: '你是什么模型',
        // A slow run can cross a minute boundary before the refresh arrives.
        createdAt: '2026-06-29T08:01:10.000Z',
      },
      {
        id: 'run-api:thread:assistant',
        role: 'assistant',
        content: '我是一个 AI 助手',
        createdAt: '2026-06-29T08:01:15.000Z',
      },
    ];

    const merged = mergeRefreshedMessages(local, api);

    expect(merged.filter((message) => message.role === 'user')).toHaveLength(1);
    expect(merged[0]?.content).toBe('你是什么模型');
  });

  it('keeps paused askUser assistant before a newer superseded user turn', () => {
    const local: Message[] = [
      {
        id: 'u-ask',
        role: 'user',
        content: '问我一个问题',
        createdAt: '2026-06-29T08:00:00.000Z',
      },
      {
        id: 'a-paused-ask',
        role: 'assistant',
        content: '',
        createdAt: '2026-06-29T08:00:05.000Z',
        turnSegments: [
          {
            kind: 'tool',
            id: 'tc_ask_1',
            tool: {
              id: 'tc_ask_1',
              toolCallId: 'tc_ask_1',
              apiName: 'askUserQuestion',
              identifier: 'linkloom-user-interaction',
              state: 'executing',
              intervention: { status: 'pending' },
              hitlKind: 'needs_input',
            },
          },
        ],
      },
      {
        id: 'u-new',
        role: 'user',
        content: '写个文件',
        createdAt: '2026-06-29T08:01:00.000Z',
      },
      {
        id: 'a-new',
        role: 'assistant',
        content: '好的',
        createdAt: '2026-06-29T08:01:05.000Z',
      },
    ];
    const api: Message[] = [
      {
        id: 'run-ask:input:0',
        role: 'user',
        content: '问我一个问题',
        createdAt: '2026-06-29T08:00:00.000Z',
      },
      {
        id: 'run-new:input:0',
        role: 'user',
        content: '写个文件',
        createdAt: '2026-06-29T08:01:00.000Z',
      },
      {
        id: 'a-new',
        role: 'assistant',
        content: '好的',
        createdAt: '2026-06-29T08:01:05.000Z',
      },
    ];

    const merged = mergeRefreshedMessages(local, api);
    const roles = merged.map((message) => `${message.role}:${message.content || message.id}`);
    expect(roles).toEqual([
      'user:问我一个问题',
      'assistant:a-paused-ask',
      'user:写个文件',
      'assistant:好的',
    ]);
  });
});
