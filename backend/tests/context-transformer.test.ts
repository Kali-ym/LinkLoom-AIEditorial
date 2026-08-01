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
});
