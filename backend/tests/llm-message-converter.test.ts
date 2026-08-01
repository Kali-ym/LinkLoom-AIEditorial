import { describe, expect, it } from 'vitest';
import {
  convertToLlmMessages,
  convertToProviderRequest,
  toChatCompletionsApiMessages,
  toMessagesApiMessages,
  toResponsesApiInputItems,
} from '../src/services/agents/context/LlmMessageConverter.js';
import { createTurnContext } from '../src/services/agents/context/PiContextTypes.js';

describe('convertToLlmMessages', () => {
  it('keeps low-priority context request-only after the current user turn', () => {
    const trajectory = [
      { role: 'user' as const, content: 'question' },
      {
        role: 'assistant' as const,
        content: null,
        tool_calls: [{ id: 'call-1', name: 'query', arguments: {} }],
      },
      { role: 'tool' as const, tool_call_id: 'call-1', content: '{"ok":true}' },
    ];
    const turn = createTurnContext({
      turnId: 'turn-1',
      sources: [{ source: 'knowledge', content: 'reference text' }],
    });

    const output = convertToLlmMessages({
      trajectory,
      ephemeralMessages: turn.sources,
    });

    expect(output.map((message) => message.role)).toEqual(['user', 'user', 'assistant', 'tool']);
    expect(output[1]?.content).toContain('source="knowledge"');
    expect(output[1]?.content).toContain('reference text');
    expect(trajectory).toHaveLength(3);
  });

  it('converts the same request into provider-specific message shapes', () => {
    const request = {
      systemInstruction: 'stable',
      messages: [{ role: 'user' as const, content: 'hello' }],
      providerTools: [],
      ephemeralMessages: [],
      turnContextFingerprint: 'turn-fingerprint',
    };

    expect(convertToProviderRequest({
      request,
      format: 'chat_completions',
    })).toMatchObject({
      systemInstruction: 'stable',
      messages: [{ role: 'user', content: 'hello' }],
      tools: [],
    });
    expect(convertToProviderRequest({
      request,
      format: 'responses',
    })).toMatchObject({
      instructions: 'stable',
      input: [{ role: 'user', content: 'hello' }],
      tools: [],
    });
    expect(convertToProviderRequest({
      request,
      format: 'anthropic',
    })).toMatchObject({
      system: 'stable',
      messages: [{ role: 'user', content: 'hello' }],
      tools: [],
    });
  });

  it('omits unrepresentable ephemeral sources with diagnostics and leaves systemInstruction untouched', () => {
    const privateErrorText = 'Error: private retrieval stack\n    at KnowledgeService.retrieve:42';
    const request = {
      systemInstruction: 'stable',
      messages: [
        { role: 'user' as const, content: 'hello' },
        // Ephemeral slot: system-role messages are skipped by provider serializers.
        { role: 'system' as const, content: privateErrorText },
      ],
      providerTools: [],
      ephemeralMessages: [
        {
          id: 'turn-1:knowledge:0',
          turnId: 'turn-1',
          source: 'knowledge' as const,
          content: privateErrorText,
          trust: 'untrusted_data' as const,
          instructionPolicy: 'reference_only' as const,
          persist: false as const,
        },
      ],
      turnContextFingerprint: 'turn-fingerprint',
    };

    for (const format of ['chat_completions', 'responses', 'anthropic'] as const) {
      const result = convertToProviderRequest({ request, format });

      expect(result.conversionDiagnostics).toEqual(['context_conversion_unsupported']);
      expect(JSON.stringify(result)).not.toContain('private retrieval stack');
      expect(JSON.stringify(result)).not.toContain('KnowledgeService.retrieve');

      if (format === 'chat_completions') {
        expect(result.systemInstruction).toBe('stable');
        expect(result.messages).toEqual([{ role: 'user', content: 'hello' }]);
      } else if (format === 'responses') {
        expect(result.instructions).toBe('stable');
        expect(result.input).toEqual([{ role: 'user', content: 'hello' }]);
        expect(result.systemInstruction).toBeUndefined();
      } else {
        expect(result.system).toBe('stable');
        expect(result.messages).toEqual([{ role: 'user', content: 'hello' }]);
        expect(result.systemInstruction).toBeUndefined();
      }
    }
  });

  it('keeps the persistent trajectory prefix when ephemeral changes across rounds', () => {
    const firstTurn = createTurnContext({
      turnId: 'turn-1',
      sources: [{ source: 'knowledge', content: 'reference text from run one' }],
    });
    const secondTurn = createTurnContext({
      turnId: 'turn-2',
      sources: [{ source: 'knowledge', content: 'reference text from run two' }],
    });
    const firstTrajectory = [{ role: 'user' as const, content: 'question' }];
    const secondTrajectory = [
      ...firstTrajectory,
      {
        role: 'assistant' as const,
        content: null,
        tool_calls: [{ id: 'call-1', name: 'query', arguments: {} }],
      },
      { role: 'tool' as const, tool_call_id: 'call-1', content: '{"ok":true}' },
    ];
    const roundOne = convertToLlmMessages({
      trajectory: firstTrajectory,
      ephemeralMessages: firstTurn.sources,
    });
    const roundTwo = convertToLlmMessages({
      trajectory: secondTrajectory,
      ephemeralMessages: secondTurn.sources,
    });

    const firstPersistentInput = toResponsesApiInputItems(firstTrajectory);
    const secondPersistentInput = toResponsesApiInputItems(secondTrajectory);
    const roundOneInput = toResponsesApiInputItems(roundOne);
    const roundTwoInput = toResponsesApiInputItems(roundTwo);

    expect(roundOneInput[0]).toEqual(firstPersistentInput[0]);
    expect(secondPersistentInput.slice(0, firstPersistentInput.length)).toEqual(firstPersistentInput);
    expect(
      roundTwoInput.filter(
        (item) => !String(item.content ?? '').includes('<linkloom_context'),
      ),
    ).toEqual(secondPersistentInput);
    expect(
      roundOneInput.find((item) => String(item.content ?? '').includes('<linkloom_context'))?.content,
    ).toContain('reference text from run one');
    expect(
      roundTwoInput.find((item) => String(item.content ?? '').includes('<linkloom_context'))?.content,
    ).toContain('reference text from run two');
  });

  it('uses linkloom_context markers when declared ephemeral count drifts after react rounds', () => {
    const request = {
      systemInstruction: 'stable',
      messages: [
        { role: 'user' as const, content: 'hello' },
        {
          role: 'assistant' as const,
          content: null,
          tool_calls: [{ id: 'call-1', name: 'query', arguments: {} }],
        },
        { role: 'tool' as const, tool_call_id: 'call-1', name: 'query', content: '{"ok":true}' },
        {
          role: 'user' as const,
          content: '<linkloom_context source="knowledge">reference text</linkloom_context>',
        },
      ],
      providerTools: [],
      ephemeralMessages: [
        {
          id: 'turn-1:knowledge:0',
          turnId: 'turn-1',
          source: 'knowledge' as const,
          content: 'reference text',
          trust: 'untrusted_data' as const,
          instructionPolicy: 'reference_only' as const,
          persist: false as const,
        },
      ],
      ephemeralMessageCount: 2,
      turnContextFingerprint: 'turn-fingerprint',
    };

    const result = convertToProviderRequest({ request, format: 'chat_completions' });
    expect(result.messages?.map((message) => message.role)).toEqual(['user', 'assistant', 'tool', 'user']);
    expect(String(result.messages?.at(-1)?.content)).toContain('<linkloom_context');
  });

  it('does not insert ephemeral context into the persistent ReAct suffix', () => {
    const output = convertToLlmMessages({
      trajectory: [
        { role: 'user', content: '历史问题' },
        { role: 'assistant', content: '历史回答' },
        { role: 'user', content: '本轮问题' },
        { role: 'assistant', content: null, tool_calls: [{ id: 'tc-1', name: 'query', arguments: {} }] },
        { role: 'tool', tool_call_id: 'tc-1', content: '结果' },
      ],
      ephemeralMessages: [
        {
          id: 'turn-1:knowledge:0',
          turnId: 'turn-1',
          source: 'knowledge',
          content: '参考资料',
          trust: 'untrusted_data',
          instructionPolicy: 'reference_only',
          persist: false,
        },
      ],
    });

    expect(output.map((message) => message.role)).toEqual([
      'user',
      'assistant',
      'user',
      'user',
      'assistant',
      'tool',
    ]);
    expect(String(output[3]?.content)).toContain('<linkloom_context');
  });

  it('serializes tool results deterministically and bounds oversized outputs', () => {
    const first = toChatCompletionsApiMessages([
      {
        role: 'tool',
        tool_call_id: 'call-1',
        content: { z: 1, a: ['stable', 'result'] },
      } as never,
    ]);
    const second = toChatCompletionsApiMessages([
      {
        role: 'tool',
        tool_call_id: 'call-1',
        content: { a: ['stable', 'result'], z: 1 },
      } as never,
    ]);
    expect(first).toEqual(second);

    const oversized = toMessagesApiMessages([
      {
        role: 'tool',
        tool_call_id: 'call-large',
        content: 'x'.repeat(20_000),
      } as never,
    ]);
    const serialized = JSON.stringify(oversized);
    expect(serialized.length).toBeLessThan(20_000);
    expect(serialized).toContain('linkloom_tool_result_truncated');
  });

  it('preserves complete Responses output items when reasoning continuity is enabled', () => {
    const rawParts = [
      { type: 'reasoning', id: 'rs_1', summary: [{ type: 'summary_text', text: 'step' }] },
      { type: 'function_call', call_id: 'call-1', name: 'query', arguments: '{}' },
    ];
    expect(
      toResponsesApiInputItems([
        { role: 'assistant', content: '', raw_parts: rawParts } as never,
      ]),
    ).toEqual([]);
    expect(
      toResponsesApiInputItems(
        [{ role: 'assistant', content: '', raw_parts: rawParts } as never],
        { keepHistoryReasoning: true },
      ),
    ).toEqual(rawParts);
  });
});
