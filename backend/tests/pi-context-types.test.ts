import { describe, expect, it } from 'vitest';
import {
  PI_CONTEXT_PROTOCOL_VERSION,
  createTurnContext,
  type ContextMessage,
} from '../src/services/agents/context/PiContextTypes.js';

describe('pi context types', () => {
  it('uses the new protocol version and marks external data as non-persistent', () => {
    expect(PI_CONTEXT_PROTOCOL_VERSION).toBe('pi-context-v2');

    const message: ContextMessage = {
      id: 'turn-1:knowledge:0',
      turnId: 'turn-1',
      source: 'knowledge',
      content: 'reference',
      trust: 'untrusted_data',
      instructionPolicy: 'reference_only',
      persist: false,
    };

    expect(message.persist).toBe(false);
    expect(message.instructionPolicy).toBe('reference_only');
  });

  it('creates a deterministic turn fingerprint without wall-clock fields', () => {
    const first = createTurnContext({
      turnId: 'turn-1',
      sources: [
        { source: 'knowledge', content: 'A' },
        { source: 'memory', content: 'B' },
      ],
    });
    const second = createTurnContext({
      turnId: 'turn-1',
      sources: [
        { source: 'knowledge', content: 'A' },
        { source: 'memory', content: 'B' },
      ],
    });

    expect(first.fingerprint).toBe(second.fingerprint);
    expect(first.fingerprint).not.toContain('createdAt');
    expect(first.sources).toHaveLength(2);
  });
});
