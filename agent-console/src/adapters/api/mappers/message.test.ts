import { describe, expect, it } from 'vitest';
import { mapBackendMessageToDomain, mapBackendMessagesToDomain } from './message';

describe('mapBackendMessageToDomain', () => {
  it('preserves ISO createdAt for assistant messages', () => {
    const message = mapBackendMessageToDomain(
      {
        id: 'm-1',
        role: 'assistant',
        content: '回答正文',
        createdAt: '2026-06-20T07:36:35.878Z',
      },
      0,
      'session-1',
    );

    expect(message?.createdAt).toBe('2026-06-20T07:36:35.878Z');
  });

  it('maps reasoning content parts into reasoningBeforeTool', () => {
    const message = mapBackendMessageToDomain(
      {
        id: 'm-2',
        role: 'assistant',
        content: [
          {
            kind: 'reasoning',
            text: '先分析用户意图\n\n再比较大小',
            metadata: { durationSec: '6.8' },
          },
          { kind: 'text', text: '9.92 更大。' },
        ],
        createdAt: '2026-06-20T07:36:35.878Z',
      },
      1,
      'session-1',
    );

    expect(message?.content).toBe('9.92 更大。');
    expect(message?.reasoningBeforeTool?.paragraphs).toEqual([
      '先分析用户意图',
      '再比较大小',
    ]);
    expect(message?.reasoningBeforeTool?.label).toBe('已深度思考（6.8s）');
  });

  it('maps user turn metadata into imageList, fileList, and editorData', () => {
    const message = mapBackendMessageToDomain(
      {
        id: 'm-user',
        role: 'user',
        content: '看一下',
        createdAt: '2026-06-20T07:36:35.878Z',
        metadata: {
          editorData: { root: { children: [] } },
          imageList: [{ alt: 'shot.png', id: 'img-1', url: '/api/agent-uploads/img-1' }],
          fileList: [
            {
              fileType: 'application/pdf',
              id: 'doc-1',
              name: 'report.pdf',
              size: 22016,
              url: '/api/agent-uploads/doc-1',
            },
          ],
        },
      },
      0,
      'session-1',
    );

    expect(message?.content).toBe('看一下');
    expect(message?.imageList).toEqual([
      {
        alt: 'shot.png',
        id: 'img-1',
        url: expect.stringContaining('/api/agent-uploads/img-1'),
      },
    ]);
    expect(message?.fileList?.[0]).toMatchObject({
      id: 'doc-1',
      name: 'report.pdf',
      size: 22016,
      fileType: 'application/pdf',
    });
    expect(message?.editorData).toEqual({ root: { children: [] } });
  });

  it('treats null assistant content as empty string', () => {
    const message = mapBackendMessageToDomain(
      {
        id: 'm-null',
        role: 'assistant',
        content: null,
        createdAt: '2026-06-24T08:00:00.000Z',
      },
      0,
      'session-1',
    );

    expect(message?.content).toBe('');
  });

  it('maps persisted error metadata into stopped assistant messages', () => {
    const message = mapBackendMessageToDomain(
      {
        id: 'm-error',
        role: 'assistant',
        content: '502 upstream request failed',
        createdAt: '2026-06-22T08:00:05.000Z',
        metadata: {
          stopped: true,
          stopReason: 'failed',
        },
      },
      2,
      'session-1',
    );

    expect(message?.content).toBe('502 upstream request failed');
    expect(message?.stopped).toBe(true);
  });

  it('maps assistant tool content parts into message.tools and hides absorbed tool role messages', () => {
    const messages = mapBackendMessagesToDomain(
      [
        { role: 'user', content: '搜索知识库' },
        {
          id: 'm-assistant',
          role: 'assistant',
          content: [
            {
              kind: 'tool_call',
              data: { id: 'tc-kb', toolName: 'query_knowledge', arguments: { query: 'AI' } },
            },
            {
              kind: 'tool_result',
              data: {
                toolCallId: 'tc-kb',
                data: { hits: 2 },
                content: '2 hits',
                success: true,
              },
            },
            { kind: 'text', text: '知识库有 2 条相关内容。' },
          ],
          createdAt: '2026-06-20T07:36:35.878Z',
        },
        {
          role: 'tool',
          toolCallId: 'tc-kb',
          name: 'query_knowledge',
          content: '{"data":{"hits":2},"summary":"2 hits"}',
        },
      ],
      'session-1',
    );

    const assistant = messages.find((message) => message.role === 'assistant');
    expect(assistant?.content).toBe('知识库有 2 条相关内容。');
    expect(assistant?.tool).toMatchObject({
      identifier: 'linkloom-knowledge-base',
      apiName: 'searchKnowledgeBase',
      pluginState: { hits: 2 },
      resultText: '2 hits',
      state: 'success',
    });
    expect(messages.some((message) => message.role === 'tool')).toBe(false);
  });
});
