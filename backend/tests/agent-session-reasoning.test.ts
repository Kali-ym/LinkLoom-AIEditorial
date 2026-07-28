import { describe, expect, it } from 'vitest';
import { AgentSessionManager } from '../src/services/agents/managers/AgentSessionManager.js';
import type { AgentSession } from '../src/services/agents/engine/AgentSession.js';

describe('AgentSessionManager reasoning persistence', () => {
  const manager = new AgentSessionManager();

  it('builds assistant reasoning from reasoning_snapshot when no reasoning_delta exists', () => {
    const session: AgentSession = {
      runId: 'run-2',
      sessionId: 'session-1',
      threadId: 'thread-1',
      status: 'succeeded',
      source: 'api',
      createdAt: '2026-06-20T08:00:00.000Z',
      updatedAt: '2026-06-20T08:00:10.000Z',
      messages: [{ role: 'user', content: '第二题' }],
      events: [
        {
          id: 'e1',
          runId: 'run-2',
          sessionId: 'session-1',
          type: 'reasoning_snapshot',
          sequence: 1,
          timestamp: '2026-06-20T08:00:09.000Z',
          payload: { round: 1, content: '晚到的推理摘要', durationMs: 1200, phase: 'final' },
        },
        {
          id: 'e2',
          runId: 'run-2',
          sessionId: 'session-1',
          type: 'model_finished',
          sequence: 2,
          timestamp: '2026-06-20T08:00:10.000Z',
          payload: { content: '回答', reasoning: '晚到的推理摘要' },
        },
      ],
      checkpoints: [],
      artifacts: [],
      output: { content: '回答', stopReason: 'completed' },
    };

    const messages = manager.getSessionMessages(session);
    const assistant = messages.find((message) => message.role === 'assistant');
    const parts = assistant?.content as Array<{ kind: string; text?: string }>;
    expect(parts[0]?.kind).toBe('reasoning');
    expect(parts[0]?.text).toBe('晚到的推理摘要');
  });

  it('dedupes mirrored model_delta when message_delta carries the same chunk', () => {
    const session: AgentSession = {
      runId: 'run-dedupe',
      sessionId: 'session-1',
      threadId: 'thread-1',
      status: 'cancelled',
      source: 'api',
      createdAt: '2026-06-20T08:02:00.000Z',
      updatedAt: '2026-06-20T08:02:05.000Z',
      messages: [{ role: 'user', content: '读一下页面' }],
      events: [
        {
          id: 'e1',
          runId: 'run-dedupe',
          sessionId: 'session-1',
          type: 'model_delta',
          sequence: 1,
          timestamp: '2026-06-20T08:02:04.000Z',
          payload: { content: '这个', round: 1 },
        },
        {
          id: 'e2',
          runId: 'run-dedupe',
          sessionId: 'session-1',
          type: 'message_delta',
          sequence: 2,
          timestamp: '2026-06-20T08:02:04.001Z',
          payload: { role: 'assistant', content: '这个', round: 1 },
        },
        {
          id: 'e3',
          runId: 'run-dedupe',
          sessionId: 'session-1',
          type: 'model_delta',
          sequence: 3,
          timestamp: '2026-06-20T08:02:04.100Z',
          payload: { content: '页面', round: 1 },
        },
        {
          id: 'e4',
          runId: 'run-dedupe',
          sessionId: 'session-1',
          type: 'message_delta',
          sequence: 4,
          timestamp: '2026-06-20T08:02:04.101Z',
          payload: { role: 'assistant', content: '页面', round: 1 },
        },
      ],
      checkpoints: [],
      artifacts: [],
      output: { content: '', stopReason: 'cancelled' },
    };

    const messages = manager.getThreadRunMessages(session);
    const assistant = messages.find((message) => message.role === 'assistant');
    expect(assistant?.content).toBe('这个页面');
  });

  it('collects assistant text from model_delta when message_delta is absent', () => {
    const session: AgentSession = {
      runId: 'run-3',
      sessionId: 'session-1',
      threadId: 'thread-1',
      status: 'succeeded',
      source: 'api',
      createdAt: '2026-06-20T08:01:00.000Z',
      updatedAt: '2026-06-20T08:01:05.000Z',
      messages: [{ role: 'user', content: '狼和狗' }],
      events: [
        {
          id: 'e1',
          runId: 'run-3',
          sessionId: 'session-1',
          type: 'model_delta',
          sequence: 1,
          timestamp: '2026-06-20T08:01:04.000Z',
          payload: { content: '狼吻细、耳竖。', round: 1 },
        },
      ],
      checkpoints: [],
      artifacts: [],
      output: { content: '', stopReason: 'completed' },
    };

    const messages = manager.getThreadRunMessages(session);
    const assistant = messages.find((message) => message.role === 'assistant');
    expect(assistant?.content).toBe('狼吻细、耳竖。');
  });

  it('includes reasoning content part in session messages', () => {
    const session: AgentSession = {
      runId: 'run-1',
      sessionId: 'session-1',
      threadId: 'thread-1',
      status: 'succeeded',
      source: 'api',
      createdAt: '2026-06-20T07:36:00.000Z',
      updatedAt: '2026-06-20T07:36:35.878Z',
      messages: [{ role: 'user', content: '9.1 和 9.92 哪个大？' }],
      events: [
        {
          id: 'e1',
          runId: 'run-1',
          sessionId: 'session-1',
          type: 'model_started',
          sequence: 1,
          timestamp: '2026-06-20T07:36:28.000Z',
          payload: { round: 1 }
        },
        {
          id: 'e2',
          runId: 'run-1',
          sessionId: 'session-1',
          type: 'reasoning_delta',
          sequence: 2,
          timestamp: '2026-06-20T07:36:30.000Z',
          payload: { content: '比较两个小数', round: 1 }
        },
        {
          id: 'e3',
          runId: 'run-1',
          sessionId: 'session-1',
          type: 'message_delta',
          sequence: 3,
          timestamp: '2026-06-20T07:36:35.000Z',
          payload: { role: 'assistant', content: '9.92 更大。', round: 1 }
        }
      ],
      checkpoints: [],
      artifacts: [],
      output: { content: '9.92 更大。', stopReason: 'completed' }
    };

    const messages = manager.getSessionMessages(session);
    const assistant = messages.find((message) => message.role === 'assistant');
    expect(assistant).toBeTruthy();
    expect(Array.isArray(assistant?.content)).toBe(true);
    const parts = assistant?.content as Array<{ kind: string; text?: string }>;
    expect(parts[0]?.kind).toBe('reasoning');
    expect(parts[0]?.text).toBe('比较两个小数');
    expect(parts[1]?.kind).toBe('text');
    expect(parts[1]?.text).toBe('9.92 更大。');
    expect(assistant?.metadata?.reasoning).toEqual({
      text: '比较两个小数',
      durationSec: '7.0'
    });
  });

  it('persists run_failed error as assistant message after refresh', () => {
    const session: AgentSession = {
      runId: 'run-fail',
      sessionId: 'session-1',
      threadId: 'thread-1',
      status: 'failed',
      source: 'api',
      createdAt: '2026-06-22T08:00:00.000Z',
      updatedAt: '2026-06-22T08:00:05.000Z',
      messages: [{ role: 'user', content: '你是谁？' }],
      events: [
        {
          id: 'e1',
          runId: 'run-fail',
          sessionId: 'session-1',
          type: 'run_failed',
          sequence: 1,
          timestamp: '2026-06-22T08:00:05.000Z',
          payload: {
            status: 'failed',
            error: '502 upstream request failed',
            durationMs: 1200
          }
        }
      ],
      checkpoints: [],
      artifacts: []
    };

    const messages = manager.getThreadRunMessages(session);
    const assistant = messages.find((message) => message.role === 'assistant');
    expect(assistant?.content).toBe('502 upstream request failed');
    expect(assistant?.metadata?.stopped).toBe(true);
  });

  it('persists empty_response as assistant error message', () => {
    const session: AgentSession = {
      runId: 'run-empty',
      sessionId: 'session-1',
      threadId: 'thread-1',
      status: 'succeeded',
      source: 'api',
      createdAt: '2026-06-22T08:01:00.000Z',
      updatedAt: '2026-06-22T08:01:08.000Z',
      messages: [{ role: 'user', content: '第二题' }],
      events: [
        {
          id: 'e1',
          runId: 'run-empty',
          sessionId: 'session-1',
          type: 'custom',
          sequence: 1,
          timestamp: '2026-06-22T08:01:08.000Z',
          payload: {
            name: 'stream_final_trace',
            data: { stopReason: 'empty_response' }
          }
        }
      ],
      checkpoints: [],
      artifacts: [],
      output: { content: '', stopReason: 'empty_response' }
    };

    const messages = manager.getThreadRunMessages(session);
    const assistant = messages.find((message) => message.role === 'assistant');
    expect(assistant?.content).toBe('模型未返回内容');
    expect(assistant?.metadata?.stopped).toBe(true);
    expect(assistant?.metadata?.stopReason).toBe('empty_response');
  });

  it('persists tool calls in assistant metadata after refresh', () => {
    const session: AgentSession = {
      runId: 'run-tools',
      sessionId: 'session-1',
      threadId: 'thread-1',
      status: 'succeeded',
      source: 'api',
      createdAt: '2026-06-23T08:00:00.000Z',
      updatedAt: '2026-06-23T08:00:12.000Z',
      messages: [{ role: 'user', content: '列出技能' }],
      events: [
        {
          id: 'e1',
          runId: 'run-tools',
          sessionId: 'session-1',
          type: 'model_started',
          sequence: 1,
          timestamp: '2026-06-23T08:00:01.000Z',
          payload: { round: 1 },
        },
        {
          id: 'e2',
          runId: 'run-tools',
          sessionId: 'session-1',
          type: 'reasoning_delta',
          sequence: 2,
          timestamp: '2026-06-23T08:00:02.000Z',
          payload: { content: '先列出技能', round: 1 },
        },
        {
          id: 'e3',
          runId: 'run-tools',
          sessionId: 'session-1',
          type: 'tool_call_requested',
          sequence: 3,
          timestamp: '2026-06-23T08:00:03.000Z',
          payload: {
            toolCallId: 'tc-1',
            toolName: 'list_skill',
            arguments: {},
            round: 1,
          },
        },
        {
          id: 'e4',
          runId: 'run-tools',
          sessionId: 'session-1',
          type: 'tool_finished',
          sequence: 4,
          timestamp: '2026-06-23T08:00:05.000Z',
          payload: {
            toolCallId: 'tc-1',
            toolName: 'list_skill',
            success: true,
            content: '3 skills',
            durationMs: 1800,
            round: 1,
          },
        },
        {
          id: 'e5',
          runId: 'run-tools',
          sessionId: 'session-1',
          type: 'model_started',
          sequence: 5,
          timestamp: '2026-06-23T08:00:06.000Z',
          payload: { round: 2 },
        },
        {
          id: 'e6',
          runId: 'run-tools',
          sessionId: 'session-1',
          type: 'reasoning_delta',
          sequence: 6,
          timestamp: '2026-06-23T08:00:07.000Z',
          payload: { content: '整理结果', round: 2 },
        },
        {
          id: 'e7',
          runId: 'run-tools',
          sessionId: 'session-1',
          type: 'message_delta',
          sequence: 7,
          timestamp: '2026-06-23T08:00:12.000Z',
          payload: { role: 'assistant', content: '当前共有 3 个 skill', round: 2 },
        },
      ],
      checkpoints: [],
      artifacts: [],
      output: { content: '当前共有 3 个 skill', stopReason: 'completed' },
    };

    const messages = manager.getThreadRunMessages(session);
    const assistant = messages.find((message) => message.role === 'assistant');
    expect(assistant?.metadata?.toolCalls).toEqual([
      expect.objectContaining({
        id: 'tc-1',
        name: 'list_skill',
        content: '3 skills',
        durationMs: 1800,
        success: true,
      }),
    ]);
    expect(assistant?.metadata?.reasoning).toEqual(
      expect.objectContaining({ text: '先列出技能' }),
    );
    expect(assistant?.metadata?.reasoningAfter).toEqual(
      expect.objectContaining({ text: '整理结果' }),
    );
    expect(assistant?.metadata?.turnSegments).toEqual([
      expect.objectContaining({ kind: 'reasoning', text: '先列出技能' }),
      expect.objectContaining({ kind: 'tool', toolCallId: 'tc-1' }),
      expect.objectContaining({
        kind: 'reasoning',
        text: '整理结果',
        durationSec: expect.not.stringMatching(/^0\.0$/),
      }),
      expect.objectContaining({ kind: 'text', text: '当前共有 3 个 skill' }),
    ]);
  });

  it('backfills mid-round text from model_finished when message_delta is missing', () => {
    const session: AgentSession = {
      runId: 'run-backfill',
      sessionId: 'session-1',
      threadId: 'thread-1',
      status: 'cancelled',
      source: 'api',
      createdAt: '2026-06-26T08:00:00.000Z',
      updatedAt: '2026-06-26T08:00:10.000Z',
      messages: [{ role: 'user', content: '写个脚本' }],
      events: [
        {
          id: 'e1',
          runId: 'run-backfill',
          sessionId: 'session-1',
          type: 'reasoning_delta',
          sequence: 1,
          timestamp: '2026-06-26T08:00:02.000Z',
          payload: { content: '先建脚本', round: 1 },
        },
        {
          id: 'e2',
          runId: 'run-backfill',
          sessionId: 'session-1',
          type: 'model_finished',
          sequence: 2,
          timestamp: '2026-06-26T08:00:04.000Z',
          payload: { content: '先把脚本改成 /bin/sh 可运行', round: 1 },
        },
        {
          id: 'e3',
          runId: 'run-backfill',
          sessionId: 'session-1',
          type: 'tool_call_requested',
          sequence: 3,
          timestamp: '2026-06-26T08:00:05.000Z',
          payload: { toolCallId: 'tc-1', toolName: 'create_file', arguments: {}, round: 1 },
        },
        {
          id: 'e4',
          runId: 'run-backfill',
          sessionId: 'session-1',
          type: 'tool_finished',
          sequence: 4,
          timestamp: '2026-06-26T08:00:06.000Z',
          payload: { toolCallId: 'tc-1', toolName: 'create_file', success: true, content: 'ok', round: 1 },
        },
      ],
      checkpoints: [],
      artifacts: [],
      output: { content: '先把脚本改成 /bin/sh 可运行', stopReason: 'cancelled' },
    };

    const messages = manager.getThreadRunMessages(session);
    const assistant = messages.find((message) => message.role === 'assistant');
    const turnSegments = assistant?.metadata?.turnSegments as Array<{ kind: string; text?: string }> | undefined;
    expect(turnSegments).toEqual([
      expect.objectContaining({ kind: 'reasoning', text: '先建脚本' }),
      expect.objectContaining({ kind: 'text', text: '先把脚本改成 /bin/sh 可运行' }),
      expect.objectContaining({ kind: 'tool', toolCallId: 'tc-1' }),
    ]);
  });

  it('rebuilds turn segments from reasoning_snapshot before tools (authoritative replay)', () => {
    const session: AgentSession = {
      runId: 'run-snapshot',
      sessionId: 'session-1',
      threadId: 'thread-1',
      status: 'succeeded',
      source: 'api',
      createdAt: '2026-06-26T08:00:00.000Z',
      updatedAt: '2026-06-26T08:00:10.000Z',
      messages: [{ role: 'user', content: '读脚本' }],
      events: [
        {
          id: 'e1',
          runId: 'run-snapshot',
          sessionId: 'session-1',
          type: 'reasoning_snapshot',
          sequence: 1,
          timestamp: '2026-06-26T08:00:02.000Z',
          payload: { round: 1, content: '要读工作区里的脚本看看', durationMs: 2100, phase: 'pre_tool' },
        },
        {
          id: 'e2',
          runId: 'run-snapshot',
          sessionId: 'session-1',
          type: 'tool_call_requested',
          sequence: 2,
          timestamp: '2026-06-26T08:00:03.000Z',
          payload: { toolCallId: 'tc-read', toolName: 'readFile', arguments: {}, round: 1 },
        },
        {
          id: 'e3',
          runId: 'run-snapshot',
          sessionId: 'session-1',
          type: 'tool_finished',
          sequence: 3,
          timestamp: '2026-06-26T08:00:04.000Z',
          payload: { toolCallId: 'tc-read', toolName: 'readFile', success: true, content: 'ok', round: 1 },
        },
        {
          id: 'e4',
          runId: 'run-snapshot',
          sessionId: 'session-1',
          type: 'model_finished',
          sequence: 4,
          timestamp: '2026-06-26T08:00:05.000Z',
          payload: { round: 1, reasoning: '要读工作区里的脚本看看' },
        },
      ],
      checkpoints: [],
      artifacts: [],
      output: { content: '', stopReason: 'final' },
    };

    const messages = manager.getThreadRunMessages(session);
    const assistant = messages.find((message) => message.role === 'assistant');
    const turnSegments = assistant?.metadata?.turnSegments as Array<{ kind: string; text?: string; durationSec?: string }> | undefined;
    expect(turnSegments?.map((segment) => segment.kind)).toEqual(['reasoning', 'tool']);
    expect(turnSegments?.[0]).toEqual(
      expect.objectContaining({ kind: 'reasoning', text: '要读工作区里的脚本看看', durationSec: '2.1' }),
    );
    expect(turnSegments?.[1]).toEqual(expect.objectContaining({ kind: 'tool', toolCallId: 'tc-read' }));
  });

  it('does not infer reasoning segments from model_finished without reasoning_snapshot', () => {
    const session: AgentSession = {
      runId: 'run-no-snapshot',
      sessionId: 'session-1',
      threadId: 'thread-1',
      status: 'succeeded',
      source: 'api',
      createdAt: '2026-06-26T08:00:00.000Z',
      updatedAt: '2026-06-26T08:00:10.000Z',
      messages: [{ role: 'user', content: '读工作区脚本' }],
      events: [
        {
          id: 'e1',
          runId: 'run-no-snapshot',
          sessionId: 'session-1',
          type: 'tool_call_requested',
          sequence: 1,
          timestamp: '2026-06-26T08:00:02.000Z',
          payload: { toolCallId: 'tc-read', toolName: 'readFile', arguments: { path: 'a.sh' }, round: 1 },
        },
        {
          id: 'e2',
          runId: 'run-no-snapshot',
          sessionId: 'session-1',
          type: 'tool_finished',
          sequence: 2,
          timestamp: '2026-06-26T08:00:03.000Z',
          payload: { toolCallId: 'tc-read', toolName: 'readFile', success: true, content: 'ok', round: 1 },
        },
        {
          id: 'e3',
          runId: 'run-no-snapshot',
          sessionId: 'session-1',
          type: 'model_finished',
          sequence: 3,
          timestamp: '2026-06-26T08:00:04.000Z',
          payload: { reasoning: '要读工作区里的脚本看看', round: 1 },
        },
      ],
      checkpoints: [],
      artifacts: [],
      output: { content: '', stopReason: 'final' },
    };

    const messages = manager.getThreadRunMessages(session);
    const assistant = messages.find((message) => message.role === 'assistant');
    const turnSegments = assistant?.metadata?.turnSegments as Array<{ kind: string }> | undefined;
    expect(turnSegments?.map((segment) => segment.kind)).toEqual(['tool']);
  });

  it('appends round-2 reasoning_snapshot after round-1 tools on replay', () => {
    const session: AgentSession = {
      runId: 'run-two-rounds',
      sessionId: 'session-1',
      threadId: 'thread-1',
      status: 'succeeded',
      source: 'api',
      createdAt: '2026-06-26T08:00:00.000Z',
      updatedAt: '2026-06-26T08:00:12.000Z',
      messages: [{ role: 'user', content: '读脚本' }],
      events: [
        {
          id: 'e1',
          runId: 'run-two-rounds',
          sessionId: 'session-1',
          type: 'reasoning_snapshot',
          sequence: 1,
          timestamp: '2026-06-26T08:00:02.000Z',
          payload: { round: 1, content: '要读工作区脚本', durationMs: 1500, phase: 'pre_tool' },
        },
        {
          id: 'e2',
          runId: 'run-two-rounds',
          sessionId: 'session-1',
          type: 'tool_call_requested',
          sequence: 2,
          timestamp: '2026-06-26T08:00:03.000Z',
          payload: { toolCallId: 'tc-read', toolName: 'readFile', arguments: {}, round: 1 },
        },
        {
          id: 'e3',
          runId: 'run-two-rounds',
          sessionId: 'session-1',
          type: 'tool_finished',
          sequence: 3,
          timestamp: '2026-06-26T08:00:04.000Z',
          payload: { toolCallId: 'tc-read', toolName: 'readFile', success: true, content: 'ok', round: 1 },
        },
        {
          id: 'e4',
          runId: 'run-two-rounds',
          sessionId: 'session-1',
          type: 'reasoning_snapshot',
          sequence: 4,
          timestamp: '2026-06-26T08:00:06.000Z',
          payload: { round: 2, content: '已读完，给用户总结', durationMs: 900, phase: 'final' },
        },
        {
          id: 'e5',
          runId: 'run-two-rounds',
          sessionId: 'session-1',
          type: 'model_finished',
          sequence: 5,
          timestamp: '2026-06-26T08:00:08.000Z',
          payload: { reasoning: '已读完，给用户总结', content: '工作区里有 3 个脚本', round: 2 },
        },
      ],
      checkpoints: [],
      artifacts: [],
      output: { content: '工作区里有 3 个脚本', stopReason: 'final' },
    };

    const messages = manager.getThreadRunMessages(session);
    const assistant = messages.find((message) => message.role === 'assistant');
    expect(assistant?.metadata?.turnSegments?.map((segment) => segment.kind)).toEqual([
      'reasoning',
      'tool',
      'reasoning',
      'text',
    ]);
  });

  it('dedupes repeated tool_call_requested for the same toolCallId after permission resume replay', () => {
    const session: AgentSession = {
      runId: 'run-dup-tool',
      sessionId: 'session-1',
      threadId: 'thread-1',
      status: 'succeeded',
      source: 'api',
      createdAt: '2026-06-24T08:00:00.000Z',
      updatedAt: '2026-06-24T08:00:12.000Z',
      messages: [{ role: 'user', content: '列工作区文件' }],
      events: [
        {
          id: 'e1',
          runId: 'run-dup-tool',
          sessionId: 'session-1',
          type: 'tool_call_requested',
          sequence: 1,
          timestamp: '2026-06-24T08:00:03.000Z',
          payload: { toolCallId: 'tc-dup', toolName: 'execute_command', arguments: {}, round: 1 },
        },
        {
          id: 'e2',
          runId: 'run-dup-tool',
          sessionId: 'session-1',
          type: 'tool_finished',
          sequence: 2,
          timestamp: '2026-06-24T08:00:04.000Z',
          payload: {
            toolCallId: 'tc-dup',
            toolName: 'execute_command',
            success: false,
            content: 'Permission required',
            round: 1,
          },
        },
        {
          id: 'e3',
          runId: 'run-dup-tool',
          sessionId: 'session-1',
          type: 'tool_call_requested',
          sequence: 3,
          timestamp: '2026-06-24T08:00:08.000Z',
          payload: { toolCallId: 'tc-dup', toolName: 'execute_command', arguments: {}, round: 1 },
        },
        {
          id: 'e4',
          runId: 'run-dup-tool',
          sessionId: 'session-1',
          type: 'tool_finished',
          sequence: 4,
          timestamp: '2026-06-24T08:00:09.000Z',
          payload: {
            toolCallId: 'tc-dup',
            toolName: 'execute_command',
            success: true,
            content: '.',
            durationMs: 300,
            round: 1,
          },
        },
        {
          id: 'e5',
          runId: 'run-dup-tool',
          sessionId: 'session-1',
          type: 'message_delta',
          sequence: 5,
          timestamp: '2026-06-24T08:00:12.000Z',
          payload: { role: 'assistant', content: '工作区是空的', round: 2 },
        },
      ],
      checkpoints: [],
      artifacts: [],
      output: { content: '工作区是空的', stopReason: 'completed' },
    };

    const messages = manager.getThreadRunMessages(session);
    const assistant = messages.find((message) => message.role === 'assistant');
    const toolSegments = (assistant?.metadata?.turnSegments as Array<{ kind: string }> | undefined)?.filter(
      (segment) => segment.kind === 'tool' || segment.kind === 'tools',
    );
    expect(toolSegments).toHaveLength(1);
  });
});
