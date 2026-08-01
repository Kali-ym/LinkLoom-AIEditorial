import { describe, expect, it } from 'vitest';
import {
  convertToLlmMessages,
  convertToProviderRequest,
} from '../src/services/agents/context/LlmMessageConverter.js';
import { createTurnContext } from '../src/services/agents/context/PiContextTypes.js';

describe('convertToLlmMessages', () => {
  it('preserves trajectory and appends low-priority context as user messages', () => {
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

    expect(output.map((message) => message.role)).toEqual(['user', 'assistant', 'tool', 'user']);
    expect(output.at(-1)?.content).toContain('source="knowledge"');
    expect(output.at(-1)?.content).toContain('reference text');
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
});
