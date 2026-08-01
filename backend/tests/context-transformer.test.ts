import { describe, expect, it } from 'vitest';
import { ContextTransformer } from '../src/services/agents/context/ContextTransformer.js';
import { SessionContextBuilder } from '../src/services/agents/context/SessionContextBuilder.js';
import { createTurnContext } from '../src/services/agents/context/PiContextTypes.js';

describe('ContextTransformer', () => {
  it('returns one request copy without mutating SessionContext', () => {
    const session = new SessionContextBuilder().build({
      stableSystemPrompt: 'stable',
      trajectory: [{ role: 'user', content: 'question' }],
      providerTools: [],
    });
    const turn = createTurnContext({
      turnId: 'turn-1',
      sources: [
        { source: 'knowledge', content: 'kb' },
        { source: 'memory', content: 'memory' },
      ],
    });

    const result = new ContextTransformer().transform({ session, turn });

    expect(result.systemInstruction).toBe('stable');
    expect(result.messages).toHaveLength(3);
    expect(result.messages.at(-1)?.role).toBe('user');
    expect(result.ephemeralMessages).toHaveLength(2);
    expect(session.trajectory).toEqual([{ role: 'user', content: 'question' }]);
  });

  it('does not put ephemeral context into the stable system instruction', () => {
    const session = new SessionContextBuilder().build({
      stableSystemPrompt: 'stable',
      variantMessages: [{ role: 'system', content: 'skill metadata' }],
      trajectory: [],
      providerTools: [],
    });
    const turn = createTurnContext({
      turnId: 'turn-1',
      sources: [{ source: 'knowledge', content: 'kb' }],
    });

    const result = new ContextTransformer().transform({ session, turn });

    expect(result.systemInstruction).toContain('stable');
    expect(result.systemInstruction).toContain('skill metadata');
    expect(result.systemInstruction).not.toContain('kb');
  });

  it('maps sourceErrors to runtime ephemeral metadata without leaking error text or stack', () => {
    const privateErrorText = 'Error: private retrieval stack\n    at KnowledgeService.retrieve:42';
    const session = new SessionContextBuilder().build({
      stableSystemPrompt: 'stable',
      trajectory: [{ role: 'user', content: 'question' }],
      providerTools: [],
    });
    const turn = createTurnContext({
      turnId: 'turn-1',
      sources: [],
      sourceErrors: [{ source: 'knowledge', code: 'unavailable' }],
    });

    const result = new ContextTransformer().transform({ session, turn });

    expect(result.diagnostics).toEqual(['turn_context_source_failed:knowledge']);
    expect(result.systemInstruction).toBe('stable');
    expect(result.systemInstruction).not.toContain(privateErrorText);
    expect(result.systemInstruction).not.toContain('stack');
    expect(result.systemInstruction).not.toContain('KnowledgeService');

    expect(result.ephemeralMessages).toHaveLength(1);
    expect(result.ephemeralMessages[0]).toMatchObject({
      source: 'runtime',
      trust: 'runtime_metadata',
      instructionPolicy: 'reference_only',
      persist: false,
    });
    expect(result.ephemeralMessages[0]?.content).toContain('knowledge');
    expect(result.ephemeralMessages[0]?.content).toContain('当前不可用');
    expect(result.ephemeralMessages[0]?.content).not.toContain(privateErrorText);
    expect(result.ephemeralMessages[0]?.content).not.toContain('stack');

    const renderedEphemeral = String(result.messages.at(-1)?.content ?? '');
    expect(renderedEphemeral).toContain('source="runtime"');
    expect(renderedEphemeral).toContain('当前不可用');
    expect(renderedEphemeral).not.toContain(privateErrorText);
    expect(renderedEphemeral).not.toContain('stack');
    expect(renderedEphemeral).not.toContain('turn-1');
    expect(JSON.stringify(result)).not.toContain('KnowledgeService.retrieve');
  });
});
