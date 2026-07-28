import { afterEach, describe, expect, it, vi } from 'vitest';

import { createStreamTimingMeta, reduceStreamEvent } from './streamReducer';
import type { StreamEvent } from './streamEvent';
import type { StreamingMessage } from '../../stores/types';

function baseMessage(): StreamingMessage {
  return { id: 'a-1', role: 'assistant', content: '', streaming: true, segments: [] };
}

function run(events: StreamEvent[]): StreamingMessage {
  let message = baseMessage();
  let meta = createStreamTimingMeta();
  for (const event of events) {
    const result = reduceStreamEvent(message, event, meta);
    message = result.message;
    meta = result.meta;
  }
  return message;
}

describe('reduceStreamEvent tool_calls behaviour', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('preserves api-mapped tool payloads without showcase injection', () => {
    vi.stubEnv('VITE_AGENT_CONSOLE_DATA', 'api');
    const message = run([
      {
        type: 'tool_calls',
        tools: [
          {
            id: 'tc-1',
            toolCallId: 'tc-1',
            identifier: 'linkloom-knowledge-base',
            apiName: 'searchKnowledgeBase',
            plugin: 'linkloom-knowledge-base',
            state: 'executing',
            arguments: { query: '选题趋势' },
            params: { query: '选题趋势' },
          },
        ],
      },
      {
        type: 'tool_calls',
        tools: [
          {
            id: 'tc-1',
            toolCallId: 'tc-1',
            identifier: 'linkloom-knowledge-base',
            apiName: 'searchKnowledgeBase',
            plugin: 'linkloom-knowledge-base',
            state: 'success',
            duration: '1.2s',
            resultText: '找到 3 条结果',
            resultContent: '找到 3 条结果',
            pluginState: { hits: 3 },
          },
        ],
      },
    ]);

    const toolSeg = message.segments?.find((segment) => segment.kind === 'tool');
    expect(toolSeg?.kind === 'tool' ? toolSeg.tool.customTitle : undefined).toBeUndefined();
    expect(toolSeg?.kind === 'tool' ? toolSeg.tool.resultText : undefined).toBe('找到 3 条结果');
    expect(toolSeg?.kind === 'tool' ? toolSeg.tool.settingsSchema : undefined).toBeUndefined();
  });

  it('does not inject showcase defaults for unidentified tools in api mode', () => {
    vi.stubEnv('VITE_AGENT_CONSOLE_DATA', 'api');

    const message = run([
      {
        type: 'tool_calls',
        tools: [{ id: 'tc-x', state: 'executing' }],
      },
    ]);

    const toolSeg = message.segments?.find((segment) => segment.kind === 'tool');
    expect(toolSeg?.kind === 'tool' ? toolSeg.tool.customTitle : undefined).toBeUndefined();
    expect(toolSeg?.kind === 'tool' ? toolSeg.tool.resultText : undefined).toBeUndefined();
    expect(toolSeg?.kind === 'tool' ? toolSeg.tool.params : undefined).toBeUndefined();
  });
});

describe('reduceStreamEvent reasoning behaviour', () => {
  it('streams reasoning then content in separate segments', () => {
    const message = run([
      { type: 'reasoning_part', content: '先比较', text: '先比较', block: 1 },
      { type: 'content_part', content: '9.92 更大', text: '9.92 更大' },
      { type: 'stop' },
    ]);

    expect(message.segments?.[0]?.kind).toBe('reasoning');
    if (message.segments?.[0]?.kind === 'reasoning') {
      expect(message.segments[0].block.text).toBe('先比较');
      expect(message.segments[0].block.thinking).toBe(false);
    }
    expect(message.segments?.[1]?.kind).toBe('text');
    if (message.segments?.[1]?.kind === 'text') {
      expect(message.segments[1].text).toBe('9.92 更大');
    }
    expect(message.content).toBe('9.92 更大');
  });

  it('inserts pre-tool reasoning before an existing tool when block is 1', () => {
    const message = run([
      {
        type: 'tool_calls',
        tools: [
          {
            id: 'tc-1',
            toolCallId: 'tc-1',
            identifier: 'linkloom-local-system',
            apiName: 'runCommand',
            state: 'executing',
          },
        ],
      },
      {
        type: 'reasoning_part',
        content: '先列出目录',
        text: '先列出目录',
        block: 1,
      },
      { type: 'stop' },
    ]);

    expect(message.segments?.map((segment) => segment.kind)).toEqual(['reasoning', 'tool']);
  });

  it('interleaves reasoning, tool, reasoning, and second tool linearly', () => {
    const message = run([
      { type: 'reasoning_part', content: '先想', text: '先想', block: 1 },
      {
        type: 'tool_calls',
        tools: [
          {
            id: 'tc-1',
            toolCallId: 'tc-1',
            identifier: 'linkloom-skill',
            apiName: 'searchSkill',
            state: 'success',
          },
        ],
      },
      { type: 'reasoning_part', content: '再想', text: '再想', block: 2 },
      {
        type: 'tool_calls',
        tools: [
          {
            id: 'tc-2',
            toolCallId: 'tc-2',
            identifier: 'linkloom-skill',
            apiName: 'readReference',
            state: 'success',
          },
        ],
      },
      { type: 'content_part', content: '总结', text: '总结' },
      { type: 'stop' },
    ]);

    expect(message.segments?.map((segment) => segment.kind)).toEqual([
      'reasoning',
      'tool',
      'reasoning',
      'tool',
      'text',
    ]);
  });

  it('interleaves text between reasoning and tool calls in arrival order', () => {
    const message = run([
      { type: 'reasoning_part', content: '先思考', text: '先思考', block: 1 },
      { type: 'content_part', content: '我先把', text: '我先把' },
      { type: 'content_part', content: '思路说清楚', text: '思路说清楚' },
      {
        type: 'tool_calls',
        tools: [
          {
            id: 'tc-1',
            toolCallId: 'tc-1',
            identifier: 'linkloom-skill',
            apiName: 'searchSkill',
            state: 'success',
          },
        ],
      },
      { type: 'reasoning_part', content: '看完结果', text: '看完结果', block: 2 },
      { type: 'content_part', content: '再补充', text: '再补充' },
      {
        type: 'tool_calls',
        tools: [
          {
            id: 'tc-2',
            toolCallId: 'tc-2',
            identifier: 'linkloom-skill',
            apiName: 'readReference',
            state: 'success',
          },
        ],
      },
      { type: 'content_part', content: '最终结论', text: '最终结论' },
      { type: 'stop' },
    ]);

    expect(message.segments?.map((segment) => segment.kind)).toEqual([
      'reasoning',
      'text',
      'tool',
      'reasoning',
      'text',
      'tool',
      'text',
    ]);

    // Consecutive content_part chunks merge into one text segment instead of
    // producing one block per token.
    const firstText = message.segments?.find(
      (segment, index) => segment.kind === 'text' && index === 1,
    );
    expect(firstText?.kind === 'text' ? firstText.text : '').toBe('我先把思路说清楚');

    // content snapshot still keeps the full concatenated answer text.
    expect(message.content).toBe('我先把思路说清楚再补充最终结论');
  });
});
