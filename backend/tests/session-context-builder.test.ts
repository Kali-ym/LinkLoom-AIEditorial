import { describe, expect, it } from 'vitest';
import { SessionContextBuilder } from '../src/services/agents/context/SessionContextBuilder.js';

describe('SessionContextBuilder', () => {
  it('separates stable prompt, variant messages, trajectory, and tools', () => {
    const context = new SessionContextBuilder().build({
      stableSystemPrompt: 'stable',
      variantMessages: [{ role: 'system', content: 'skill metadata' }],
      trajectory: [{ role: 'user', content: 'hello' }],
      providerTools: [{ name: 'read_skill', description: 'read', parameters: {} }],
    });

    expect(context.protocolVersion).toBe('pi-context-v2');
    expect(context.stableSystemPrompt).toBe('stable');
    expect(context.variantMessages).toEqual([{ role: 'system', content: 'skill metadata' }]);
    expect(context.trajectory).toEqual([{ role: 'user', content: 'hello' }]);
    expect(context.providerTools).toHaveLength(1);
    expect(context.stablePrefixHash).toBeTruthy();
    expect(context.variantHash).toBeTruthy();
    expect(context.toolsetHash).toBeTruthy();
  });

  it('deep-clones mutable inputs and changes fingerprints when stable inputs change', () => {
    const trajectory = [{ role: 'user' as const, content: 'hello' }];
    const tools = [{ name: 'read_skill', description: 'read', parameters: {} }];
    const builder = new SessionContextBuilder();
    const first = builder.build({
      stableSystemPrompt: 'stable',
      trajectory,
      providerTools: tools,
    });

    first.trajectory[0]!.content = 'changed';
    first.providerTools[0]!.description = 'changed';

    const second = builder.build({
      stableSystemPrompt: 'stable',
      trajectory,
      providerTools: tools,
    });
    const changed = builder.build({
      stableSystemPrompt: 'changed',
      trajectory,
      providerTools: tools,
    });

    expect(trajectory[0]!.content).toBe('hello');
    expect(tools[0]!.description).toBe('read');
    expect(second.stablePrefixHash).toBe(first.stablePrefixHash);
    expect(changed.stablePrefixHash).not.toBe(first.stablePrefixHash);
  });
});
