import { describe, expect, it } from 'vitest';

import { toMessagesApiMessages } from '../src/services/AIProvider.js';
import type { AgentMessage } from '../src/services/agents/engine/AgentRunSpec.js';
import { expandAgentMessageToRuntimeMessages } from '../src/services/agents/runtime/persistedToolHistory.js';

describe('expandAgentMessageToRuntimeMessages', () => {
  it('expands persisted assistant toolCalls into assistant + tool messages', () => {
    const message: AgentMessage = {
      id: 'run-1:thread:assistant',
      role: 'assistant',
      content: '查询完成',
      metadata: {
        toolCalls: [
          {
            id: 'call_00_abc',
            name: 'list_schedules',
            arguments: { enabled: true },
            content: '{"count":2}',
            success: true,
          },
        ],
      },
    };

    expect(expandAgentMessageToRuntimeMessages(message)).toEqual([
      {
        role: 'assistant',
        content: '查询完成',
        name: undefined,
        reasoning: undefined,
        tool_calls: [{ id: 'call_00_abc', name: 'list_schedules', arguments: { enabled: true } }],
        raw_parts: undefined,
        canonical_message_version: 'canonical-message-v1',
      },
      {
        role: 'tool',
        tool_call_id: 'call_00_abc',
        name: 'list_schedules',
        content: '{"count":2}',
        canonical_message_version: 'canonical-message-v1',
      },
    ]);
  });

  it('produces Anthropic-valid message pairs for multi-turn history', () => {
    const runtimeMessages = [
      { role: 'user' as const, content: '列出定时任务' },
      ...expandAgentMessageToRuntimeMessages({
        id: 'run-1:thread:assistant',
        role: 'assistant',
        content: '已查询',
        metadata: {
          toolCalls: [
            {
              id: 'call_00_abc',
              name: 'list_schedules',
              arguments: {},
              content: '[]',
              success: true,
            },
          ],
        },
      }),
      { role: 'user' as const, content: '再查一次' },
    ];

    expect(toMessagesApiMessages(runtimeMessages)).toEqual([
      { role: 'user', content: '列出定时任务' },
      {
        role: 'assistant',
        content: [
          { type: 'text', text: '已查询' },
          { type: 'tool_use', id: 'call_00_abc', name: 'list_schedules', input: {} },
        ],
      },
      {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: 'call_00_abc', content: '[]' }],
      },
      { role: 'user', content: '再查一次' },
    ]);
  });

  it('replays the frozen canonical tool message instead of observation preview', () => {
    const messages = expandAgentMessageToRuntimeMessages({
      id: 'run-1:thread:assistant',
      role: 'assistant',
      content: '已查询',
      metadata: {
        toolCalls: [
          {
            id: 'call_00_artifact',
            name: 'read_document',
            arguments: { id: 'doc-1' },
            content: '预览：旧观测内容',
            canonicalMessageContent: '工具结果已保存为 artifact_artifact-1\n预览：旧观测内容',
            success: true,
          },
        ],
      },
    });

    expect(messages[1]).toMatchObject({
      role: 'tool',
      content: '工具结果已保存为 artifact_artifact-1\n预览：旧观测内容',
    });
  });

  it('replays turnSegments as interleaved assistant and tool messages', () => {
    const messages = expandAgentMessageToRuntimeMessages({
      id: 'run-1:thread:assistant',
      role: 'assistant',
      content: '最终答案',
      metadata: {
        toolCalls: [
          {
            id: 'tc-1',
            name: 'read_file',
            arguments: { path: 'a.txt' },
            content: 'file-a',
            success: true,
          },
          {
            id: 'tc-2',
            name: 'read_file',
            arguments: { path: 'b.txt' },
            content: 'file-b',
            success: true,
          },
        ],
        turnSegments: [
          { kind: 'reasoning', text: '先读第一个文件' },
          { kind: 'tool', toolCallId: 'tc-1' },
          { kind: 'reasoning', text: '再读第二个文件' },
          { kind: 'tool', toolCallId: 'tc-2' },
          { kind: 'text', text: '最终答案' },
        ],
      },
    });

    expect(messages).toEqual([
      {
        role: 'assistant',
        content: null,
        name: undefined,
        reasoning: '先读第一个文件',
        tool_calls: [{ id: 'tc-1', name: 'read_file', arguments: { path: 'a.txt' } }],
        canonical_message_version: 'canonical-message-v1',
      },
      {
        role: 'tool',
        tool_call_id: 'tc-1',
        name: 'read_file',
        content: 'file-a',
        canonical_message_version: 'canonical-message-v1',
      },
      {
        role: 'assistant',
        content: null,
        name: undefined,
        reasoning: '再读第二个文件',
        tool_calls: [{ id: 'tc-2', name: 'read_file', arguments: { path: 'b.txt' } }],
        canonical_message_version: 'canonical-message-v1',
      },
      {
        role: 'tool',
        tool_call_id: 'tc-2',
        name: 'read_file',
        content: 'file-b',
        canonical_message_version: 'canonical-message-v1',
      },
      {
        role: 'assistant',
        content: '最终答案',
        name: undefined,
        reasoning: undefined,
        raw_parts: undefined,
        canonical_message_version: 'canonical-message-v1',
      },
    ]);
  });
});
