import { describe, expect, it } from 'vitest';

import {
  attachToolsToAssistantMessage,
  buildToolResultsIndex,
  extractAssistantTools,
} from './historyToolPayload';
import type { BackendAgentMessageDto } from '../types/message';

describe('extractAssistantTools', () => {
  it('merges tool_call and tool_result content parts with identity mapping and pluginState', () => {
    const message: BackendAgentMessageDto = {
      id: 'm-tools',
      role: 'assistant',
      content: [
        {
          kind: 'tool_call',
          data: {
            id: 'tc-1',
            toolName: 'query_knowledge',
            arguments: { query: '选题趋势' },
          },
        },
        {
          kind: 'tool_result',
          data: {
            toolCallId: 'tc-1',
            toolName: 'query_knowledge',
            content: '找到 3 条结果',
            data: { hits: [{ title: 'A' }, { title: 'B' }, { title: 'C' }] },
            durationMs: 1200,
            success: true,
          },
        },
        { kind: 'text', text: '根据知识库结果，建议关注 AI 监管。' },
      ],
      createdAt: '2026-06-20T07:36:35.878Z',
    };

    const { tools } = extractAssistantTools(message, new Map());

    expect(tools).toHaveLength(1);
    expect(tools[0]).toMatchObject({
      id: 'tc-1',
      toolCallId: 'tc-1',
      identifier: 'linkloom-knowledge-base',
      apiName: 'searchKnowledgeBase',
      plugin: 'linkloom-knowledge-base',
      state: 'success',
      arguments: { query: '选题趋势' },
      resultText: '找到 3 条结果',
      duration: '1.2s',
      pluginState: { hits: [{ title: 'A' }, { title: 'B' }, { title: 'C' }] },
    });
  });

  it('reconstructs tools from metadata.toolCalls and merges tool role results', () => {
    const backendMessages: BackendAgentMessageDto[] = [
      {
        role: 'user',
        content: '查一下',
      },
      {
        id: 'm-assistant',
        role: 'assistant',
        content: '已查询完成。',
        metadata: {
          toolCalls: [
            {
              id: 'tc-2',
              name: 'query_data',
              arguments: { startDate: '2026-06-01', endDate: '2026-06-20' },
            },
          ],
        },
      },
      {
        role: 'tool',
        toolCallId: 'tc-2',
        name: 'query_data',
        content: JSON.stringify({
          data: { items: [{ title: 'News 1' }] },
          summary: '共 1 条',
        }),
      },
    ];

    const toolResultsByCallId = buildToolResultsIndex(backendMessages);
    const assistant = backendMessages[1];
    const { tools, absorbedToolCallIds } = extractAssistantTools(assistant, toolResultsByCallId);

    expect(absorbedToolCallIds).toEqual(['tc-2']);
    expect(tools[0]).toMatchObject({
      identifier: 'linkloom-data',
      apiName: 'queryData',
      state: 'success',
      pluginState: { items: [{ title: 'News 1' }] },
      resultText: '共 1 条',
    });
  });

  it('maps custom user denial reason to rejected state', () => {
    const message: BackendAgentMessageDto = {
      id: 'm-deny',
      role: 'assistant',
      content: [
        {
          kind: 'tool_call',
          data: {
            id: 'call_cmd',
            toolName: 'execute_command',
            arguments: { command: 'rm -f p.py' },
          },
        },
        {
          kind: 'tool_result',
          data: {
            toolCallId: 'call_cmd',
            toolName: 'execute_command',
            success: false,
            error: '说错了，我要删除workspace下的所有文件',
            data: {
              success: false,
              status: 'user_denied',
              error: '说错了，我要删除workspace下的所有文件',
            },
          },
        },
      ],
      createdAt: '2026-06-20T07:36:35.878Z',
    };

    const { tools } = extractAssistantTools(message, new Map());

    expect(tools[0]).toMatchObject({
      state: 'rejected',
      rejectedReason: '说错了，我要删除workspace下的所有文件',
      error: undefined,
    });
  });
});

describe('attachToolsToAssistantMessage', () => {
  it('uses message.tool for a single tool and message.tools for multiple', () => {
    const base = {
      id: 'm-1',
      role: 'assistant' as const,
      content: 'done',
      createdAt: '2026-06-20T07:36:35.878Z',
    };
    const one = attachToolsToAssistantMessage(base, [
      { id: 'tc-1', toolCallId: 'tc-1', identifier: 'linkloom-data', apiName: 'queryData', state: 'success' },
    ]);
    const many = attachToolsToAssistantMessage(base, [
      { id: 'tc-1', toolCallId: 'tc-1', identifier: 'linkloom-data', apiName: 'queryData', state: 'success' },
      { id: 'tc-2', toolCallId: 'tc-2', identifier: 'linkloom-knowledge-base', apiName: 'searchKnowledgeBase', state: 'success' },
    ]);

    expect(one.tool?.toolCallId).toBe('tc-1');
    expect(one.tools).toBeUndefined();
    expect(many.tools).toHaveLength(2);
    expect(many.tool).toBeUndefined();
  });
});
